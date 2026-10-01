const { createHash, randomUUID } = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const { pool } = require('../config/database')
const voucherRepository = require('../repositories/voucherRepository')
const { normalizeUploadFileName } = require('../utils/fileName')

const VOUCHER_TYPES = new Set([
  'order_screenshot',
  'payment_record',
])
const REVIEW_RESULTS = new Set([
  'approved',
  'rejected',
])

// 创建一个带 HTTP 状态码的错误。
function createHttpError(statusCode, message) {
  const error = new Error(message)

  error.statusCode = statusCode
  error.expose = true

  return error
}

// 把参数转成正整数。
function parsePositiveInteger(value, fieldName) {
  const parsed = Number(value)

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw createHttpError(400, `${fieldName} 无效`)
  }

  return parsed
}

// 校验并标准化文本字段
function normalizeText(value, fieldName, maxLength) {
  if (value !== undefined && value !== null && typeof value !== 'string') {
    throw createHttpError(400, `${fieldName} 必须是文本`)
  }

  const normalizedValue = typeof value === 'string' ? value.trim() : ''

  if (normalizedValue.length > maxLength) {
    throw createHttpError(400, `${fieldName} 不能超过 ${maxLength} 个字符`)
  }

  return normalizedValue || null
}

// 校验发票是不是“待补凭证”状态。
function assertVoucherInvoice(invoice) {
  if (!invoice) {
    throw createHttpError(404, '发票不存在')
  }

  if (invoice.qualification_status !== 'pending_voucher') {
    throw createHttpError(409, '当前发票不处于待补凭证状态')
  }
}

// 生成凭证文件的存储路径。
function getVoucherStoragePath(invoiceId, fileName) {
  const storageRoot = path.resolve(__dirname, '../../../storage')
  const relativeDirectory = path.posix.join('vouchers', String(invoiceId))
  const relativePath = path.posix.join(
    relativeDirectory,
    `${randomUUID()}-${path.basename(fileName)}`,
  )
  const absolutePath = path.resolve(storageRoot, relativePath)
  const relativeToRoot = path.relative(storageRoot, absolutePath)

  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    throw createHttpError(400, '凭证文件路径无效')
  }

  return {
    absolutePath,
    relativeDirectory,
    storageKey: relativePath,
  }
}

// 创建凭证组
async function createVoucherGroup({
  invoiceId,
  groupName,
  operatorId,
}) {
  const normalizedInvoiceId = parsePositiveInteger(invoiceId, 'invoiceId')
  const normalizedOperatorId = parsePositiveInteger(operatorId, 'operatorId')
  const normalizedGroupName = normalizeText(groupName, 'groupName', 128)
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const invoice = await voucherRepository.findInvoiceById({
      connection,
      invoiceId: normalizedInvoiceId,
      forUpdate: true,
    })

    assertVoucherInvoice(invoice)

    const group = await voucherRepository.createVoucherGroup({
      connection,
      invoiceId: normalizedInvoiceId,
      groupName: normalizedGroupName,
    })

    await voucherRepository.createVoucherOperationLog({
      connection,
      operatorId: normalizedOperatorId,
      groupId: group.id,
      operationType: 'create_voucher_group',
      beforeData: null,
      afterData: group,
    })

    await connection.commit()

    return group
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

// 上传订单截图或支付记录.两类文件齐全后自动改为 pending_review
async function uploadVoucherFile({
  groupId,
  voucherType,
  file,
  operatorId,
}) {
  const normalizedGroupId = parsePositiveInteger(groupId, 'groupId')
  const normalizedOperatorId = parsePositiveInteger(operatorId, 'operatorId')

  if (!VOUCHER_TYPES.has(voucherType)) {
    throw createHttpError(400, 'voucherType 无效')
  }

  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw createHttpError(400, '请上传凭证文件')
  }

  const connection = await pool.getConnection()
  let savedFilePath = null

  try {
    await connection.beginTransaction()

    const group = await voucherRepository.findVoucherGroupById({
      connection,
      groupId: normalizedGroupId,
      forUpdate: true,
    })

    if (!group) {
      throw createHttpError(404, '凭证组不存在')
    }

    const invoice = await voucherRepository.findInvoiceById({
      connection,
      invoiceId: group.invoice_id,
      forUpdate: true,
    })

    assertVoucherInvoice(invoice)

    if (group.review_status === 'approved') {
      throw createHttpError(409, '已审核通过的凭证组不能继续上传文件')
    }

    const originalName = normalizeUploadFileName(file.originalname)
    const storage = getVoucherStoragePath(group.invoice_id, originalName)
    await fs.mkdir(path.dirname(storage.absolutePath), {
      recursive: true,
    })
    await fs.writeFile(storage.absolutePath, file.buffer)
    savedFilePath = storage.absolutePath

    const voucher = await voucherRepository.createVoucherFile({
      connection,
      voucherGroupId: normalizedGroupId,
      voucherType,
      originalName,
      storageKey: storage.storageKey,
      mimeType: file.mimetype || 'application/octet-stream',
      fileSize: file.size,
      sha256: createHash('sha256').update(file.buffer).digest('hex'),
    })
    const completeness = await voucherRepository.getVoucherGroupCompleteness({
      connection,
      groupId: normalizedGroupId,
    })
    const reviewStatus = completeness.hasOrderScreenshot
      && completeness.hasPaymentRecord
      ? 'pending_review'
      : 'pending_upload'

    await voucherRepository.updateVoucherGroupReviewStatus({
      connection,
      groupId: normalizedGroupId,
      reviewStatus,
    })

    await voucherRepository.createVoucherOperationLog({
      connection,
      operatorId: normalizedOperatorId,
      groupId: normalizedGroupId,
      operationType: 'upload_voucher_file',
      beforeData: {
        reviewStatus: group.review_status,
      },
      afterData: {
        voucherId: voucher.id,
        voucherType,
        reviewStatus,
      },
    })

    await connection.commit()

    return {
      voucher,
      reviewStatus,
      completeness,
    }
  } catch (error) {
    await connection.rollback()

    if (savedFilePath) {
      await fs.unlink(savedFilePath).catch(() => undefined)
    }

    throw error
  } finally {
    connection.release()
  }
}

// 管理员审核通过 / 不通过
// 不通过必须填写说明
async function reviewVoucherGroup({
  groupId,
  reviewStatus,
  note,
  operatorId,
}) {
  const normalizedGroupId = parsePositiveInteger(groupId, 'groupId')
  const normalizedOperatorId = parsePositiveInteger(operatorId, 'operatorId')
  const normalizedNote = normalizeText(note, 'note', 2000)

  if (!REVIEW_RESULTS.has(reviewStatus)) {
    throw createHttpError(400, 'reviewStatus 无效')
  }

  if (reviewStatus === 'rejected' && !normalizedNote) {
    throw createHttpError(400, '凭证审核不通过时必须填写审核说明')
  }

  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const group = await voucherRepository.findVoucherGroupById({
      connection,
      groupId: normalizedGroupId,
      forUpdate: true,
    })

    if (!group) {
      throw createHttpError(404, '凭证组不存在')
    }

    const invoice = await voucherRepository.findInvoiceById({
      connection,
      invoiceId: group.invoice_id,
      forUpdate: true,
    })

    assertVoucherInvoice(invoice)

    if (group.review_status === 'approved') {
      throw createHttpError(409, '凭证组已审核通过，不能重复审核')
    }

    const completeness = await voucherRepository.getVoucherGroupCompleteness({
      connection,
      groupId: normalizedGroupId,
    })

    if (
      reviewStatus === 'approved'
      && (!completeness.hasOrderScreenshot || !completeness.hasPaymentRecord)
    ) {
      throw createHttpError(409, '凭证组必须同时包含订单截图和支付记录才能审核通过')
    }

    await voucherRepository.updateVoucherGroupReviewStatus({
      connection,
      groupId: normalizedGroupId,
      reviewStatus,
      reviewedBy: normalizedOperatorId,
      reviewedAt: new Date(),
      reviewNote: normalizedNote,
    })

    await voucherRepository.createVoucherOperationLog({
      connection,
      operatorId: normalizedOperatorId,
      groupId: normalizedGroupId,
      operationType: 'review_voucher_group',
      beforeData: {
        reviewNote: group.review_note,
        reviewStatus: group.review_status,
      },
      afterData: {
        reviewNote: normalizedNote,
        reviewStatus,
      },
    })

    let invoiceQualificationStatus = invoice.qualification_status
    let invoiceQualificationReason = null

    if (reviewStatus === 'approved') {
      invoiceQualificationReason = invoice.submitted_at
        ? '支付凭证已核验通过，等待重新审核'
        : '支付凭证已核验通过，等待提交审核'

      await voucherRepository.updateInvoiceAfterVoucherApproval({
        connection,
        invoiceId: group.invoice_id,
        qualificationReason: invoiceQualificationReason,
      })

      invoiceQualificationStatus = 'pending'

      await voucherRepository.createInvoiceVoucherResolutionLog({
        connection,
        operatorId: normalizedOperatorId,
        invoiceId: group.invoice_id,
        beforeData: {
          qualificationReason: invoice.qualification_reason,
          qualificationStatus: invoice.qualification_status,
          submittedAt: invoice.submitted_at,
        },
        afterData: {
          qualificationReason: invoiceQualificationReason,
          qualificationStatus: invoiceQualificationStatus,
          submittedAt: invoice.submitted_at,
        },
      })
    }

    await connection.commit()

    return {
      groupId: normalizedGroupId,
      invoiceId: group.invoice_id,
      reviewStatus,
      reviewNote: normalizedNote,
      completeness,
      invoiceQualificationStatus,
      invoiceQualificationReason,
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

// 获取信息凭证组信息
async function listVoucherGroups({ invoiceId }) {
  const normalizedInvoiceId = parsePositiveInteger(invoiceId, 'invoiceId')
  const invoice = await voucherRepository.findInvoiceById({
    invoiceId: normalizedInvoiceId,
  })

  if (!invoice) {
    throw createHttpError(404, '发票不存在')
  }

  const groups = await voucherRepository.findGroupsByInvoiceId({
    invoiceId: normalizedInvoiceId,
  })

  return {
    invoiceId: normalizedInvoiceId,
    groups,
  }
}

module.exports = {
  createVoucherGroup,
  listVoucherGroups,
  reviewVoucherGroup,
  uploadVoucherFile,
}
