const { createHash, randomUUID } = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const { pool } = require('../config/database')
const voucherRepository = require('../repositories/voucherRepository')
const weeklyVoucherRequirementRepository = require('../repositories/weeklyVoucherRequirementRepository')
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

// 查询发票是否可处理凭证：单票待补凭证，或周累计任务中尚未完成凭证的关联发票。
async function getVoucherInvoiceContext({
  connection,
  invoiceId,
}) {
  const invoice = await voucherRepository.findInvoiceById({
    connection,
    invoiceId,
    forUpdate: true,
  })

  if (!invoice) {
    throw createHttpError(404, '发票不存在')
  }

  const pendingRequirements = await weeklyVoucherRequirementRepository.findPendingRequirementsByInvoiceId({
    connection,
    invoiceId,
    forUpdate: true,
  })
  const pendingRequirementInvoices = pendingRequirements.filter((requirement) => {
    return requirement.voucher_status === 'pending'
  })

  if (
    pendingRequirements.length > 0
    && pendingRequirementInvoices.length === 0
  ) {
    throw createHttpError(409, '当前发票的周累计凭证已完成，正在等待其他关联发票完成')
  }

  if (
    invoice.qualification_status !== 'pending_voucher'
    && pendingRequirementInvoices.length === 0
  ) {
    throw createHttpError(409, '当前发票不处于待补凭证状态，也没有待完成的周累计凭证任务')
  }

  return {
    invoice,
    pendingRequirementInvoices,
  }
}

// 标记当前发票在周累计凭证任务中的完成状态；全部完成后使触发发票恢复待审核。
async function resolveWeeklyVoucherRequirementsAfterApproval({
  connection,
  invoiceContext,
  approvedVoucherGroup,
  operatorId,
  reviewedAt,
}) {
  const completedRequirementIds = []
  const triggerInvoiceTransitions = []

  for (const requirement of invoiceContext.pendingRequirementInvoices) {
    await weeklyVoucherRequirementRepository.updateRequirementInvoiceVoucherStatus({
      connection,
      requirementInvoiceId: requirement.requirement_invoice_id,
      voucherStatus: 'approved',
      approvedVoucherGroupId: approvedVoucherGroup.id,
      completedAt: reviewedAt,
    })

    await weeklyVoucherRequirementRepository.createWeeklyVoucherRequirementOperationLog({
      connection,
      operatorId,
      requirementId: requirement.id,
      operationType: 'complete_weekly_voucher_requirement_invoice',
      beforeData: {
        requirementInvoiceId: requirement.requirement_invoice_id,
        invoiceId: requirement.invoice_id,
        voucherStatus: requirement.voucher_status,
        approvedVoucherGroupId: requirement.approved_voucher_group_id,
        completedAt: requirement.completed_at,
      },
      afterData: {
        requirementInvoiceId: requirement.requirement_invoice_id,
        invoiceId: requirement.invoice_id,
        voucherStatus: 'approved',
        approvedVoucherGroupId: approvedVoucherGroup.id,
        completedAt: reviewedAt,
      },
    })

    await weeklyVoucherRequirementRepository.findRequirementInvoices({
      connection,
      requirementId: requirement.id,
      forUpdate: true,
    })
    const progress = await weeklyVoucherRequirementRepository.getRequirementProgress({
      connection,
      requirementId: requirement.id,
    })

    if (
      progress.totalCount === 0
      || progress.pendingCount > 0
      || progress.cancelledCount > 0
    ) {
      continue
    }

    await weeklyVoucherRequirementRepository.completeRequirement({
      connection,
      requirementId: requirement.id,
      completedAt: reviewedAt,
    })

    await weeklyVoucherRequirementRepository.createWeeklyVoucherRequirementOperationLog({
      connection,
      operatorId,
      requirementId: requirement.id,
      operationType: 'complete_weekly_voucher_requirement',
      beforeData: {
        status: requirement.status,
      },
      afterData: {
        status: 'completed',
        completedAt: reviewedAt,
        completionReason: '全部关联发票的凭证均已审核通过',
      },
    })

    const triggerInvoice = await voucherRepository.findInvoiceById({
      connection,
      invoiceId: requirement.trigger_invoice_id,
      forUpdate: true,
    })

    if (!triggerInvoice) {
      throw createHttpError(409, '周累计凭证任务的触发发票不存在')
    }

    const qualificationReason = '周累计关联发票的支付凭证均已核验通过，等待重新执行规则审核'

    await voucherRepository.updateInvoiceAfterVoucherApproval({
      connection,
      invoiceId: triggerInvoice.id,
      qualificationReason,
    })

    await voucherRepository.createInvoiceVoucherResolutionLog({
      connection,
      operatorId,
      invoiceId: triggerInvoice.id,
      beforeData: {
        qualificationReason: triggerInvoice.qualification_reason,
        qualificationStatus: triggerInvoice.qualification_status,
        submittedAt: triggerInvoice.submitted_at,
      },
      afterData: {
        qualificationReason,
        qualificationStatus: 'pending',
        submittedAt: triggerInvoice.submitted_at,
        weeklyVoucherRequirementId: requirement.id,
      },
    })

    completedRequirementIds.push(requirement.id)
    triggerInvoiceTransitions.push({
      invoiceId: triggerInvoice.id,
      qualificationReason,
      qualificationStatus: 'pending',
    })
  }

  return {
    completedRequirementIds,
    triggerInvoiceTransitions,
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

    await getVoucherInvoiceContext({
      connection,
      invoiceId: normalizedInvoiceId,
    })

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

    await getVoucherInvoiceContext({
      connection,
      invoiceId: group.invoice_id,
    })

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

    const invoiceContext = await getVoucherInvoiceContext({
      connection,
      invoiceId: group.invoice_id,
    })

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

    let invoiceQualificationStatus = invoiceContext.invoice.qualification_status
    let invoiceQualificationReason = null
    let completedRequirementIds = []
    let triggerInvoiceIdsReadyForRuleReview = []

    if (reviewStatus === 'approved') {
      const weeklyResolution = await resolveWeeklyVoucherRequirementsAfterApproval({
        connection,
        invoiceContext,
        approvedVoucherGroup: group,
        operatorId: normalizedOperatorId,
        reviewedAt: new Date(),
      })
      const currentInvoiceTransition = weeklyResolution.triggerInvoiceTransitions.find((transition) => {
        return transition.invoiceId === group.invoice_id
      })

      completedRequirementIds = weeklyResolution.completedRequirementIds
      triggerInvoiceIdsReadyForRuleReview = weeklyResolution.triggerInvoiceTransitions.map((transition) => {
        return transition.invoiceId
      })

      if (currentInvoiceTransition) {
        invoiceQualificationStatus = currentInvoiceTransition.qualificationStatus
        invoiceQualificationReason = currentInvoiceTransition.qualificationReason
      } else if (invoiceContext.pendingRequirementInvoices.length === 0) {
        invoiceQualificationReason = invoiceContext.invoice.submitted_at
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
            qualificationReason: invoiceContext.invoice.qualification_reason,
            qualificationStatus: invoiceContext.invoice.qualification_status,
            submittedAt: invoiceContext.invoice.submitted_at,
          },
          afterData: {
            qualificationReason: invoiceQualificationReason,
            qualificationStatus: invoiceQualificationStatus,
            submittedAt: invoiceContext.invoice.submitted_at,
          },
        })
      }
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
      completedRequirementIds,
      triggerInvoiceIdsReadyForRuleReview,
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

// 查询发票参与的周累计凭证任务及 A/B/C 关联发票进度。
async function getWeeklyVoucherRequirements({ invoiceId }) {
  const normalizedInvoiceId = parsePositiveInteger(invoiceId, 'invoiceId')
  const invoice = await voucherRepository.findInvoiceById({
    invoiceId: normalizedInvoiceId,
  })

  if (!invoice) {
    throw createHttpError(404, '发票不存在')
  }

  const requirementRows = await weeklyVoucherRequirementRepository.findRequirementsByInvoiceId({
    invoiceId: normalizedInvoiceId,
  })
  const requirements = []

  for (const requirementRow of requirementRows) {
    const linkedInvoices = await weeklyVoucherRequirementRepository.findRequirementInvoices({
      requirementId: requirementRow.id,
    })
    const progress = linkedInvoices.reduce((result, linkedInvoice) => {
      result.totalInvoiceCount += 1

      if (linkedInvoice.voucher_status === 'approved') {
        result.approvedInvoiceCount += 1
      }

      if (linkedInvoice.voucher_status === 'pending') {
        result.pendingInvoiceCount += 1
      }

      if (linkedInvoice.voucher_status === 'cancelled') {
        result.cancelledInvoiceCount += 1
      }

      return result
    }, {
      approvedInvoiceCount: 0,
      cancelledInvoiceCount: 0,
      pendingInvoiceCount: 0,
      totalInvoiceCount: 0,
    })

    requirements.push({
      id: requirementRow.id,
      sellerTaxId: requirementRow.seller_tax_id,
      cumulativeWeekStart: requirementRow.cumulative_week_start,
      triggerInvoiceId: requirementRow.trigger_invoice_id,
      triggeredCumulativeAmount: requirementRow.triggered_cumulative_amount,
      status: requirementRow.status,
      completedAt: requirementRow.completed_at,
      cancelledAt: requirementRow.cancelled_at,
      createdAt: requirementRow.created_at,
      updatedAt: requirementRow.updated_at,
      currentInvoice: {
        requirementInvoiceId: requirementRow.requirement_invoice_id,
        invoiceRole: requirementRow.invoice_role,
        voucherStatus: requirementRow.voucher_status,
        approvedVoucherGroupId: requirementRow.approved_voucher_group_id,
        completedAt: requirementRow.invoice_completed_at,
      },
      blocksFinanceSubmission: requirementRow.status === 'pending',
      ...progress,
      invoices: linkedInvoices.map((linkedInvoice) => ({
        requirementInvoiceId: linkedInvoice.id,
        invoiceId: linkedInvoice.invoice_id,
        invoiceNumber: linkedInvoice.invoice_number,
        sellerName: linkedInvoice.seller_name,
        totalAmount: linkedInvoice.total_amount,
        qualificationStatus: linkedInvoice.qualification_status,
        financeStatus: linkedInvoice.finance_status,
        reimbursementStatus: linkedInvoice.reimbursement_status,
        invoiceRole: linkedInvoice.invoice_role,
        voucherStatus: linkedInvoice.voucher_status,
        approvedVoucherGroupId: linkedInvoice.approved_voucher_group_id,
        completedAt: linkedInvoice.completed_at,
        canSubmitVoucher: requirementRow.status === 'pending'
          && linkedInvoice.voucher_status === 'pending',
      })),
    })
  }

  return {
    invoiceId: normalizedInvoiceId,
    requirements,
  }
}

module.exports = {
  createVoucherGroup,
  getWeeklyVoucherRequirements,
  listVoucherGroups,
  reviewVoucherGroup,
  uploadVoucherFile,
}
