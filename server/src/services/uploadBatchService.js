const AdmZip = require('adm-zip')
const { randomUUID, createHash } = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const { normalizeUploadFileName } = require('../utils/fileName')
const { pool } = require('../config/database')
const uploadBatchRepository = require('../repositories/uploadBatchRepository')
const invoiceFileRepository = require('../repositories/invoiceFileRepository')
const invoiceRepository = require('../repositories/invoiceRepository')
const { inspectPdf } = require('../extractors/pdfTextExtractor')
const { recognizeGeneralInvoice } = require('../extractors/tencentOcrExtractor')
const {
  SOURCE_TYPES,
  isEmptyInvoiceTemplate,
  structureInvoiceText,
} = require('../extractors/agnesInvoiceParser')
const { validateInvoiceExtraction } = require('../validators/invoiceExtractionValidator')
const { judgeItems } = require('./categoryJudgmentService')
const { judgePriceItems } = require('./priceJudgmentService')
const { getExtractionConfig } = require('../config/extraction')
const {
  buildSuspectedDuplicateReason,
} = require('../utils/duplicateInvoice')

function badRequest(message) {
  const error = new Error(message)
  error.statusCode = 400
  error.expose = true
  return error
}

// 判断上传的文件类型
function classify(files) {
  const extensions = files.map((file) => path.extname(file.originalname).toLowerCase())
  const hasZip = extensions.includes('.zip')
  const hasPdf = extensions.includes('.pdf')
  if (hasZip && hasPdf) throw badRequest('暂不支持 PDF 和 ZIP 混合上传')
  if (hasZip && files.length !== 1) throw badRequest('暂时只支持单个 ZIP 文件上传')
  if (!hasZip && !extensions.every((extension) => extension === '.pdf')) throw badRequest('只支持 PDF 文件或 ZIP 文件')
  if (hasZip) return 'zip'
  return files.length === 1 ? 'pdf' : 'multiple_pdf'
}

// 生成pdf文件列表，把文件统一成一个内部结构
function createPdfItem(buffer, originalName, mimeType = 'application/pdf') {
  return { buffer, originalName, mimeType, fileSize: buffer.length }
}

// 解压 ZIP，找出里面所有 PDF。
function extractZip(file, batchId) {
  try {
    const zip = new AdmZip(file.buffer)
    const entries = zip.getEntries()
    const pdfEntries = entries.filter((entry) => !entry.isDirectory && path.extname(entry.entryName).toLowerCase() === '.pdf')
    if (pdfEntries.length === 0) throw badRequest('ZIP 中未找到 PDF 文件')
    return pdfEntries.map((entry) => createPdfItem(
      entry.getData(),
      normalizeUploadFileName(entry.entryName),
    ))
  } catch (error) {
    // 保留业务校验错误，其他 AdmZip/解压异常统一转换为客户端可理解的 400。
    if (error.statusCode === 400 && error.expose) throw error
    throw badRequest('ZIP 文件损坏或格式无效')
  }
}

// 创建上传批次
async function createUploadBatch({ files, createdBy = null }) {
  if (!Array.isArray(files) || files.length === 0) throw badRequest('请至少上传一个 PDF 或 ZIP 文件')
  const normalizedFiles = files.map((file) => ({
    ...file,
    originalname: normalizeUploadFileName(file.originalname),
  }))
  const fileType = classify(normalizedFiles)
  const batchId = randomUUID()
  const pdfFiles = fileType === 'zip' ? extractZip(normalizedFiles[0], batchId) : normalizedFiles.map((file) => createPdfItem(file.buffer, file.originalname, file.mimetype))
  const storageDirectory = path.resolve(__dirname, '../../../storage', batchId)
  const savedPaths = []
  const connection = await pool.getConnection()

  try {
    await fs.mkdir(storageDirectory, { recursive: true })
    await connection.beginTransaction()
    const batch = await uploadBatchRepository.createBatch({ connection, id: batchId, originalName: normalizedFiles.length === 1 ? normalizedFiles[0].originalname : `${normalizedFiles.length} 个 PDF 文件`, fileType, totalCount: pdfFiles.length, createdBy })
    const storedFiles = []

    for (const file of pdfFiles) {
      const sha256 = createHash('sha256').update(file.buffer).digest('hex')
      const safeName = `${randomUUID()}-${path.basename(file.originalName)}`
      const absolutePath = path.join(storageDirectory, safeName)
      await fs.writeFile(absolutePath, file.buffer)
      savedPaths.push(absolutePath)
      const invoice = await invoiceRepository.createDraft({ connection, sourceBatchId: batchId, createdBy })
      storedFiles.push(await invoiceFileRepository.createFile({ connection, batchId, invoiceId: invoice.id, originalName: file.originalName, storageKey: path.posix.join(batchId, safeName), mimeType: file.mimeType, fileSize: file.fileSize, sha256 }))
    }

    await uploadBatchRepository.updateStatus({ connection, id: batchId, status: 'processing' })
    await connection.commit()
    const results = []
    for (let index = 0; index < storedFiles.length; index += 1) {
      const storedFile = storedFiles[index]
      try {
        const extraction = await processFile(pdfFiles[index])
        const resultConnection = await pool.getConnection()
        try {
          await resultConnection.beginTransaction()
          await invoiceRepository.updateExtractionResult({
            connection: resultConnection,
            id: storedFile.invoiceId,
            data: extraction.structured.data,
            rawResult: extraction.structured.rawResult,
            valid: extraction.validation.valid,
            errors: extraction.validation.errors,
          })
          if (extraction.validation.valid) {
            const createdItems = await invoiceRepository.createItems({
              connection: resultConnection,
              invoiceId: storedFile.invoiceId,
              items: extraction.validation.data.items,
            })
            
            //判断商品品类
            const categoryJudgment = await judgeItems({ connection: resultConnection, items: createdItems, persist: true })
            await invoiceRepository.updateQualificationByCategory({
              connection: resultConnection,
              id: storedFile.invoiceId,
              categoryResult: categoryJudgment.invoiceCategoryResult,
              reason: categoryJudgment.reason,
            })
            const priceJudgment = await judgePriceItems({
              connection: resultConnection,
              items: createdItems,
              persist: true,
              updateItem: invoiceRepository.updateItemPriceType,
            })
            // 新建低值品发票必须先补充并核验支付凭证，不能在上传阶段跳过该前置条件。
            await invoiceRepository.updateQualificationByPrice({
              connection: resultConnection,
              id: storedFile.invoiceId,
              priceResult: priceJudgment.invoicePriceResult,
              reason: priceJudgment.reason,
            })

            const duplicateInvoice = await invoiceRepository.findDuplicateInvoice({
              connection: resultConnection,
              invoiceId: storedFile.invoiceId,
              sellerTaxId: extraction.structured.data.sellerTaxId,
              invoiceNumber: extraction.structured.data.invoiceNumber,
            })

            if (duplicateInvoice) {
              const qualificationReason = buildSuspectedDuplicateReason({
                duplicateInvoiceId: duplicateInvoice.id,
              })

              await invoiceRepository.markSuspectedDuplicate({
                connection: resultConnection,
                invoiceId: storedFile.invoiceId,
                qualificationReason,
              })

              await invoiceRepository.createOperationLog({
                connection: resultConnection,
                operationType: 'duplicate_detected',
                resourceId: storedFile.invoiceId,
                beforeData: {
                  duplicateInvoiceId: duplicateInvoice.id,
                },
                afterData: {
                  qualificationStatus: 'pending_manual',
                  qualificationReason,
                  duplicateInvoiceId: duplicateInvoice.id,
                  duplicateRule: 'seller_tax_id_and_invoice_number',
                },
              })
            }
          }
          await invoiceFileRepository.updateExtractionStatus({ connection: resultConnection, id: storedFile.id, status: 'success' })
          await resultConnection.commit()
        } catch (error) {
          await resultConnection.rollback()
          throw error
        } finally {
          resultConnection.release()
        }
        await uploadBatchRepository.incrementResult({ id: batchId, success: true })
        results.push({ fileId: storedFile.id, status: 'success', extraction })
      } catch (error) {
        const resultConnection = await pool.getConnection()
        try {
          await resultConnection.beginTransaction()
          await invoiceFileRepository.updateExtractionStatus({ connection: resultConnection, id: storedFile.id, status: 'failed', error: error.message })
          await invoiceRepository.markExtractionFailure({ connection: resultConnection, id: storedFile.invoiceId, error: error.message })
          await resultConnection.commit()
        } catch (updateError) {
          await resultConnection.rollback()
          throw updateError
        } finally {
          resultConnection.release()
        }
        await uploadBatchRepository.incrementResult({ id: batchId, success: false })
        results.push({ fileId: storedFile.id, status: 'failed', error: error.message })
      }
    }
    const successCount = results.filter((item) => item.status === 'success').length
    const finalStatus = successCount === 0 ? 'failed' : successCount === results.length ? 'completed' : 'partial_failed'
    await uploadBatchRepository.updateStatus({ id: batchId, status: finalStatus })
    return { ...batch, status: finalStatus, totalCount: pdfFiles.length, files: storedFiles, results }
  } catch (error) {
    await connection.rollback()
    await Promise.allSettled(savedPaths.map((filePath) => fs.unlink(filePath)))
    throw error
  } finally {
    connection.release()
  }
}

// 获取批次信息
async function getUploadBatch(batchId) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(batchId))) {
    const error = new Error('batchId invalid')
    error.statusCode = 400
    error.expose = true
    throw error
  }
  const batch = await uploadBatchRepository.findById(batchId)
  if (!batch) { const error = new Error('上传批次不存在'); error.statusCode = 404; error.expose = true; throw error }
  const detailRows = await invoiceFileRepository.findDetailsByBatchId(batchId)
  const invoiceIds = detailRows.map((row) => row.invoice_id)
  const itemRows = await invoiceRepository.findItemsByInvoiceIds(invoiceIds)
  const itemsByInvoiceId = new Map()

  for (const item of itemRows) {
    const items = itemsByInvoiceId.get(item.invoice_id) || []
    items.push({
      id: item.id,
      invoiceId: item.invoice_id,
      itemName: item.item_name,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      priceType: item.price_type,
      lineAmount: item.line_amount,
      aiCategoryResult: item.ai_category_result,
      aiCategoryReason: item.ai_category_reason,
      manualCategoryResult: item.manual_category_result,
      manualCategoryReason: item.manual_category_reason,
      finalCategoryResult: item.final_category_result,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    })
    itemsByInvoiceId.set(item.invoice_id, items)
  }

  const files = detailRows.map((row) => ({
    id: row.file_id,
    batchId: row.batch_id,
    invoiceId: row.invoice_id,
    originalName: row.original_name,
    storageKey: row.storage_key,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    sha256: row.sha256,
    extractionStatus: row.extraction_status,
    extractionError: row.extraction_error,
    createdAt: row.file_created_at,
    updatedAt: row.file_updated_at,
    invoice: {
      invoiceNumber: row.invoice_number,
      invoiceDate: row.invoice_date,
      sellerName: row.seller_name,
      sellerTaxId: row.seller_tax_id,
      totalAmount: row.total_amount,
      submittedAt: row.submitted_at,
      qualificationStatus: row.qualification_status,
      qualificationReason: row.qualification_reason,
      cumulativeAmount: row.cumulative_amount,
      cumulativeWeekStart: row.cumulative_week_start,
      financeStatus: row.finance_status,
      reimbursementStatus: row.reimbursement_status,
      manualNote: row.manual_note,
      createdAt: row.invoice_created_at,
      updatedAt: row.invoice_updated_at,
    },
    items: itemsByInvoiceId.get(row.invoice_id) || [],
  }))

  return {
    id: batch.id,
    originalName: batch.original_name,
    fileType: batch.file_type,
    status: batch.status,
    totalCount: batch.total_count,
    successCount: batch.success_count,
    failedCount: batch.failed_count,
    errorMessage: batch.error_message,
    createdBy: batch.created_by,
    createdAt: batch.created_at,
    updatedAt: batch.updated_at,
    files,
  }
}

// 逐个处理
async function processFileWithoutFallback(file) {
  const { text: extractedText, pageCount } = await inspectPdf(file.buffer)
  let text = extractedText
  let ocrResult = null
  if (!text) {
    const maxPages = getExtractionConfig().tencent.maxPages
    if (!Number.isInteger(pageCount) || pageCount < 1) {
      const error = new Error('无法读取 PDF 页数')
      error.code = 'PDF_PAGE_COUNT_INVALID'
      throw error
    }
    if (pageCount > maxPages) {
      const error = new Error(`PDF 页数超过 OCR 支持上限（最多 ${maxPages} 页）`)
      error.code = 'PDF_PAGE_LIMIT_EXCEEDED'
      throw error
    }
    ocrResult = await recognizeGeneralInvoice(file.buffer)
    text = ocrResult.text
  }
  const structured = await structureInvoiceText(text)
  const validation = validateInvoiceExtraction(structured.data)
  return { pageCount, text, ocrResult, structured, validation }
}

function validateStructuredInvoice(structured) {
  const validation = validateInvoiceExtraction(structured.data)
  const isEmptyTemplate = isEmptyInvoiceTemplate(structured.data)

  return {
    validation,
    isEmptyTemplate,
    isUsable: validation.valid && !isEmptyTemplate,
  }
}

function assertOcrSupportedPageCount(pageCount) {
  const maxPages = getExtractionConfig().tencent.maxPages

  if (!Number.isInteger(pageCount) || pageCount < 1) {
    const error = new Error('无法读取 PDF 页数')

    error.code = 'PDF_PAGE_COUNT_INVALID'

    throw error
  }

  if (pageCount > maxPages) {
    const error = new Error(`PDF 页数超过 OCR 支持上限（最大 ${maxPages} 页）`)

    error.code = 'PDF_PAGE_LIMIT_EXCEEDED'

    throw error
  }
}

async function structureFromOcr({
  file,
  pageCount,
}) {
  assertOcrSupportedPageCount(pageCount)

  const ocrResult = await recognizeGeneralInvoice(file.buffer)
  const structured = await structureInvoiceText(
    ocrResult.text,
    {
      sourceType: SOURCE_TYPES.TENCENT_OCR,
    },
  )
  const quality = validateStructuredInvoice(structured)

  return {
    ocrResult,
    quality,
    structured,
    text: ocrResult.text,
  }
}

// PDF 文本结构化不合格或出现空模板时，强制 OCR 进行一次兜底。
async function processFile(file) {
  const { text: extractedText, pageCount } = await inspectPdf(file.buffer)

  if (extractedText) {
    let structured
    let quality
    let initialAttempt

    try {
      structured = await structureInvoiceText(
        extractedText,
        {
          sourceType: SOURCE_TYPES.PDF_TEXT,
        },
      )
      quality = validateStructuredInvoice(structured)
      initialAttempt = {
        isEmptyTemplate: quality.isEmptyTemplate,
        sourceType: SOURCE_TYPES.PDF_TEXT,
        validationErrors: quality.validation.errors,
      }
    } catch (error) {
      initialAttempt = {
        error: error.message,
        isEmptyTemplate: false,
        sourceType: SOURCE_TYPES.PDF_TEXT,
        validationErrors: [],
      }
    }

    if (quality?.isUsable) {
      return {
        fallbackUsed: false,
        ocrResult: null,
        pageCount,
        structured,
        text: extractedText,
        validation: quality.validation,
      }
    }

    const ocrExtraction = await structureFromOcr({
      file,
      pageCount,
    })

    return {
      fallbackUsed: true,
      initialAttempt,
      ocrResult: ocrExtraction.ocrResult,
      pageCount,
      structured: ocrExtraction.structured,
      text: ocrExtraction.text,
      validation: ocrExtraction.quality.validation,
    }
  }

  const ocrExtraction = await structureFromOcr({
    file,
    pageCount,
  })

  return {
    fallbackUsed: false,
    ocrResult: ocrExtraction.ocrResult,
    pageCount,
    structured: ocrExtraction.structured,
    text: ocrExtraction.text,
    validation: ocrExtraction.quality.validation,
  }
}

module.exports = {
  createUploadBatch,
  getUploadBatch,
  processFile,
}
