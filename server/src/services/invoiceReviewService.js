const { pool } = require('../config/database')
const invoiceRepository = require('../repositories/invoiceRepository')
const invoiceReviewRepository = require('../repositories/invoiceReviewRepository')
const voucherRepository = require('../repositories/voucherRepository')
const weeklyVoucherRequirementRepository = require('../repositories/weeklyVoucherRequirementRepository')
const {
  PRICE_TYPES,
  classifyUnitPrice,
} = require('./priceJudgmentService')
const {
  getDataIssueReason,
  getManualProcessingContext,
  toDataIssues,
  validateStoredInvoiceData,
} = require('./invoiceDataValidationService')
const {
  buildSuspectedDuplicateReason,
  getSuspectedDuplicateInvoiceId,
  isSuspectedDuplicateReason,
} = require('../utils/duplicateInvoice')

const ALLOWED_RESULTS = new Set(['可以', '存疑', '不可以'])
const QUALIFICATION_ACTIONS = new Set([
  'execute_rules',
  'abandon',
])
const DUPLICATE_REVIEW_DECISIONS = new Set([
  'duplicate',
  'not_duplicate',
])
const ABANDONABLE_QUALIFICATION_STATUSES = new Set([
  'pending',
  'pending_voucher',
  'pending_manual',
  'rejected',
])

// 创建http错误码
function createHttpError(statusCode, message) {
  const error = new Error(message)
  error.statusCode = statusCode
  error.expose = true
  return error
}
// 把输入解析为正整数，不合法就抛 400
function parsePositiveInteger(value, fieldName) {
  const parsed = Number(value)

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw createHttpError(400, `${fieldName} 无效`)
  }

  return parsed
}
// 校验并规范化审核备注 note
function validateNote(note, action) {
  if (note !== undefined && note !== null && typeof note !== 'string') {
    throw createHttpError(400, 'note 必须是文本')
  }

  const normalizedNote = typeof note === 'string' ? note.trim() : ''

  if (normalizedNote.length > 2000) {
    throw createHttpError(400, 'note 不能超过 2000 个字符')
  }

  if (action === 'abandon' && !normalizedNote) {
    throw createHttpError(400, '放弃当前发票必须填写放弃原因')
  }

  return normalizedNote || null
}

// 判断是不是“普通对象”，排除 null、数组、函数等。
function isPlainObject(value) {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
}
// 判断对象有没有这个字段
function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key)
}
// 校验并标准化文本字段
function normalizeOptionalText({
  value,
  fieldName,
  maxLength,
}) {
  if (value === undefined) {
    return undefined
  }

  if (value !== null && typeof value !== 'string') {
    throw createHttpError(400, `${fieldName} 必须是文本`)
  }

  const normalizedValue = typeof value === 'string'
    ? value.trim()
    : ''

  if (normalizedValue.length > maxLength) {
    throw createHttpError(400, `${fieldName} 不能超过 ${maxLength} 个字符`)
  }

  return normalizedValue || null
}
// 校验日期字段
function normalizeOptionalDate(value) {
  if (value === undefined) {
    return undefined
  }

  if (value === null || value === '') {
    return null
  }

  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw createHttpError(400, 'invoiceDate 必须是 YYYY-MM-DD 格式')
  }

  const date = new Date(`${value}T00:00:00.000Z`)

  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw createHttpError(400, 'invoiceDate 无效')
  }

  return value
}
// 校验非负数字、
function normalizeNonNegativeNumber({
  value,
  fieldName,
}) {
  if (value === null || value === undefined || value === '') {
    throw createHttpError(400, `${fieldName} 不能为空`)
  }

  const normalizedValue = typeof value === 'number'
    ? value
    : Number(value)

  if (!Number.isFinite(normalizedValue) || normalizedValue < 0) {
    throw createHttpError(400, `${fieldName} 必须是大于等于 0 的数字`)
  }

  return normalizedValue
}
// 校验“人工补全说明”、
function normalizeManualNote(note) {
  const normalizedNote = normalizeOptionalText({
    value: note,
    fieldName: 'note',
    maxLength: 2000,
  })

  if (!normalizedNote) {
    throw createHttpError(400, '人工补全资料必须填写处理说明')
  }

  return normalizedNote
}
// 校验“发票基础信息的修改”
function normalizeInvoicePatch(invoice) {
  if (invoice === undefined || invoice === null) {
    return {}
  }

  if (!isPlainObject(invoice)) {
    throw createHttpError(400, 'invoice 必须是对象')
  }

  const patch = {}

  if (hasOwn(invoice, 'invoiceNumber')) {
    patch.invoiceNumber = normalizeOptionalText({
      value: invoice.invoiceNumber,
      fieldName: 'invoiceNumber',
      maxLength: 64,
    })
  }

  if (hasOwn(invoice, 'sellerName')) {
    patch.sellerName = normalizeOptionalText({
      value: invoice.sellerName,
      fieldName: 'sellerName',
      maxLength: 255,
    })
  }

  if (hasOwn(invoice, 'sellerTaxId')) {
    patch.sellerTaxId = normalizeOptionalText({
      value: invoice.sellerTaxId,
      fieldName: 'sellerTaxId',
      maxLength: 32,
    })
  }

  if (hasOwn(invoice, 'invoiceDate')) {
    patch.invoiceDate = normalizeOptionalDate(invoice.invoiceDate)
  }

  if (hasOwn(invoice, 'totalAmount')) {
    patch.totalAmount = normalizeNonNegativeNumber({
      value: invoice.totalAmount,
      fieldName: 'totalAmount',
    })
  }

  return patch
}
// 校验“单个商品明细”
function normalizeManualItem({
  item,
  index,
}) {
  if (!isPlainObject(item)) {
    throw createHttpError(400, `items[${index}] 必须是对象`)
  }

  let itemId = null

  if (hasOwn(item, 'itemId')) {
    itemId = parsePositiveInteger(item.itemId, `items[${index}].itemId`)
  }

  const itemName = normalizeOptionalText({
    value: item.itemName,
    fieldName: `items[${index}].itemName`,
    maxLength: 255,
  })

  if (!itemName) {
    throw createHttpError(400, `items[${index}].itemName 不能为空`)
  }

  return {
    itemId,
    itemName,
    quantity: normalizeNonNegativeNumber({
      value: item.quantity,
      fieldName: `items[${index}].quantity`,
    }),
    unitPrice: normalizeNonNegativeNumber({
      value: item.unitPrice,
      fieldName: `items[${index}].unitPrice`,
    }),
    lineAmount: normalizeNonNegativeNumber({
      value: item.lineAmount,
      fieldName: `items[${index}].lineAmount`,
    }),
  }
}
// 校验“商品明细数组”
function normalizeManualItems(items) {
  if (items === undefined || items === null) {
    return []
  }

  if (!Array.isArray(items)) {
    throw createHttpError(400, 'items 必须是数组')
  }

  const itemIds = new Set()

  return items.map((item, index) => {
    const normalizedItem = normalizeManualItem({
      item,
      index,
    })

    if (normalizedItem.itemId) {
      if (itemIds.has(normalizedItem.itemId)) {
        throw createHttpError(400, 'items 不允许包含重复的 itemId')
      }

      itemIds.add(normalizedItem.itemId)
    }

    return normalizedItem
  })
}
// 把日期转成“可比较的字符串”
function toComparableDate(value) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  return String(value).slice(0, 10)
}
// 判断两个数字“相等”（容忍浮点误差）
function isSameNumber(left, right) {
  return Math.abs(Number(left) - Number(right)) < 0.000001
}
// 算出“修改后的最终值”
function resolveEffectiveInvoiceData({
  invoice,
  patch,
}) {
  return {
    invoiceNumber: patch.invoiceNumber === undefined
      ? invoice.invoice_number
      : patch.invoiceNumber,
    sellerName: patch.sellerName === undefined
      ? invoice.seller_name
      : patch.sellerName,
    sellerTaxId: patch.sellerTaxId === undefined
      ? invoice.seller_tax_id
      : patch.sellerTaxId,
    invoiceDate: patch.invoiceDate === undefined
      ? toComparableDate(invoice.invoice_date)
      : patch.invoiceDate,
    totalAmount: patch.totalAmount === undefined
      ? Number(invoice.total_amount)
      : patch.totalAmount,
  }
}
// 判断发票基础信息“有没有变”
function hasInvoiceDataChanged({
  invoice,
  effectiveInvoiceData,
}) {
  return invoice.seller_name !== effectiveInvoiceData.sellerName
    || invoice.invoice_number !== effectiveInvoiceData.invoiceNumber
    || invoice.seller_tax_id !== effectiveInvoiceData.sellerTaxId
    || toComparableDate(invoice.invoice_date) !== effectiveInvoiceData.invoiceDate
    || !isSameNumber(invoice.total_amount, effectiveInvoiceData.totalAmount)
}
// 判断商品明细“有没有变”
function hasItemDataChanged({
  item,
  input,
}) {
  return item.item_name !== input.itemName
    || !isSameNumber(item.quantity, input.quantity)
    || !isSameNumber(item.unit_price, input.unitPrice)
    || !isSameNumber(item.line_amount, input.lineAmount)
}
// 根据商品品类结果判断发票是否能通过
function getCategoryDecision(items) {
  if (items.length === 0) {
    return {
      status: 'pending_manual',
      reason: '发票暂无商品明细，无法完成资质审核',
    }
  }

  const rejectedItems = items.filter(
    (item) => item.final_category_result === '不可以',
  )

  if (rejectedItems.length > 0) {
    return {
      status: 'rejected',
      reason: `商品“${rejectedItems[0].item_name}”品类判定为不可以`,
    }
  }

  const unresolvedItems = items.filter(
    (item) => item.final_category_result !== '可以',
  )

  if (unresolvedItems.length > 0) {
    return {
      status: 'pending_manual',
      reason: `商品“${unresolvedItems[0].item_name}”品类仍需人工确认`,
    }
  }

  return null
}
// 根据商品单价判断价格类型
function getPriceDecision(items) {
  const results = items.map((item) => ({
    item,
    result: classifyUnitPrice(item.unit_price),
  }))
  const invalidItem = results.find((entry) => !entry.result.valid)

  if (invalidItem) {
    return {
      status: 'pending_manual',
      reason: `商品“${invalidItem.item.item_name}”单价无效，需人工处理`,
      hasLowValue: false,
    }
  }

  const assetItem = results.find(
    (entry) => entry.result.priceType === PRICE_TYPES.ASSET,
  )

  if (assetItem) {
    return {
      status: 'rejected',
      reason: `商品“${assetItem.item.item_name}”单价达到资产标准，不能走材料费流程`,
      hasLowValue: false,
    }
  }

  return {
    status: null,
    reason: null,
    hasLowValue: results.some(
      (entry) => entry.result.priceType === PRICE_TYPES.LOW_VALUE,
    ),
  }
}
// 金额转「分」做整数运算，避免浮点误差
function amountToCents(value) {
  return Math.round(Number(value || 0) * 100)
}

// 计算累计金额
function sumInvoiceAmountsInCents(invoices) {
  return invoices.reduce(
    (total, invoice) => total + amountToCents(invoice.total_amount),
    0,
  )
}

// 处理累计超过 1000 元时 A/B/C 发票共同补齐支付凭证的任务。
async function resolveWeeklyVoucherRequirement({
  connection,
  invoice,
  cumulativeWeekStart,
  cumulativeAmount,
  persistRequirement,
  operatorId = null,
}) {
  const relatedInvoices = await invoiceReviewRepository.findInvoicesForWeeklyVoucherRequirement({
    connection,
    sellerTaxId: invoice.seller_tax_id,
    cumulativeWeekStart,
    triggerInvoiceId: invoice.id,
    forUpdate: persistRequirement,
  })
  const triggerInvoice = relatedInvoices.find((relatedInvoice) => {
    return Number(relatedInvoice.id) === Number(invoice.id)
  })

  if (!triggerInvoice) {
    throw createHttpError(409, '当前发票未纳入周累计凭证任务范围')
  }

  const evaluatedAt = new Date()
  const relatedInvoiceVouchers = []

  for (const relatedInvoice of relatedInvoices) {
    const approvedVoucherGroup = await voucherRepository.findApprovedCompleteGroup({
      connection,
      invoiceId: relatedInvoice.id,
      forUpdate: persistRequirement,
    })

    relatedInvoiceVouchers.push({
      invoice: relatedInvoice,
      approvedVoucherGroup,
    })
  }

  const allInvoicesHaveApprovedVoucher = relatedInvoiceVouchers.every((entry) => {
    return Boolean(entry.approvedVoucherGroup)
  })

  if (!persistRequirement) {
    return {
      allInvoicesHaveApprovedVoucher,
      relatedInvoiceCount: relatedInvoiceVouchers.length,
      requirement: null,
    }
  }

  const existingRequirement = await weeklyVoucherRequirementRepository.findPendingRequirementForWeek({
    connection,
    sellerTaxId: invoice.seller_tax_id,
    cumulativeWeekStart,
    forUpdate: true,
  })

  if (existingRequirement) {
    throw createHttpError(
      409,
      '同一销售方本自然周已有未完成的凭证补齐任务，请先完成或放弃该任务',
    )
  }

  const requirement = await weeklyVoucherRequirementRepository.createRequirement({
    connection,
    sellerTaxId: invoice.seller_tax_id,
    cumulativeWeekStart,
    triggerInvoiceId: invoice.id,
    triggeredCumulativeAmount: cumulativeAmount,
  })

  const requirementInvoices = []

  for (const entry of relatedInvoiceVouchers) {
    const completedAt = entry.approvedVoucherGroup
      ? entry.approvedVoucherGroup.reviewed_at || evaluatedAt
      : null

    const requirementInvoice = await weeklyVoucherRequirementRepository.createRequirementInvoice({
      connection,
      requirementId: requirement.id,
      invoiceId: entry.invoice.id,
      invoiceRole: Number(entry.invoice.id) === Number(invoice.id)
        ? 'trigger'
        : 'existing',
      voucherStatus: entry.approvedVoucherGroup ? 'approved' : 'pending',
      approvedVoucherGroupId: entry.approvedVoucherGroup?.id || null,
      completedAt,
    })

    requirementInvoices.push(requirementInvoice)
  }

  await weeklyVoucherRequirementRepository.createWeeklyVoucherRequirementOperationLog({
    connection,
    operatorId,
    requirementId: requirement.id,
    operationType: 'create_weekly_voucher_requirement',
    beforeData: null,
    afterData: {
      ...requirement,
      invoiceIds: requirementInvoices.map((requirementInvoice) => {
        return requirementInvoice.invoiceId
      }),
      requirementInvoices,
    },
  })

  if (allInvoicesHaveApprovedVoucher) {
    await weeklyVoucherRequirementRepository.completeRequirement({
      connection,
      requirementId: requirement.id,
      completedAt: evaluatedAt,
    })

    await weeklyVoucherRequirementRepository.createWeeklyVoucherRequirementOperationLog({
      connection,
      operatorId,
      requirementId: requirement.id,
      operationType: 'complete_weekly_voucher_requirement',
      beforeData: {
        status: 'pending',
      },
      afterData: {
        status: 'completed',
        completedAt: evaluatedAt,
        completionReason: '创建任务时全部关联发票已具备已审核通过的完整凭证',
      },
    })

    return {
      allInvoicesHaveApprovedVoucher,
      relatedInvoiceCount: relatedInvoiceVouchers.length,
      requirement: {
        ...requirement,
        status: 'completed',
      },
    }
  }

  return {
    allInvoicesHaveApprovedVoucher,
    relatedInvoiceCount: relatedInvoiceVouchers.length,
    requirement,
  }
}

// 执行规则审核的完整业务决策链，返回最终状态和累计金额。
async function resolveApprovalDecision({
  connection,
  invoice,
  items,
  findApprovedInvoicesForWeek = invoiceReviewRepository.findApprovedInvoicesForWeek,
  persistWeeklyVoucherRequirement = true,
  operatorId = null,
}) {
  const categoryDecision = getCategoryDecision(items)
  if (categoryDecision) {
    return {
      qualificationStatus: categoryDecision.status,
      qualificationReason: categoryDecision.reason,
      cumulativeAmount: null,
      cumulativeWeekStart: null,
      submittedAt: null,
    }
  }

  const priceDecision = getPriceDecision(items)
  if (priceDecision.status) {
    return {
      qualificationStatus: priceDecision.status,
      qualificationReason: priceDecision.reason,
      cumulativeAmount: null,
      cumulativeWeekStart: null,
      submittedAt: null,
    }
  }

  if (!invoice.seller_tax_id) {
    return {
      qualificationStatus: 'pending_manual',
      qualificationReason: '未识别销售方纳税人识别号，无法计算自然周累计',
      cumulativeAmount: null,
      cumulativeWeekStart: null,
      submittedAt: null,
    }
  }

  const submittedAt = invoice.submitted_at

  if (!submittedAt) {
    throw createHttpError(409, '发票尚未提交审核，无法计算自然周累计')
  }
  const weekStart = await invoiceReviewRepository.getWeekStart({
    connection,
    date: submittedAt,
  })
  const approvedInvoices = await findApprovedInvoicesForWeek({
    connection,
    invoiceId: invoice.id,
    sellerTaxId: invoice.seller_tax_id,
    weekStart,
  })
  const priorCumulativeAmount = sumInvoiceAmountsInCents(approvedInvoices) / 100
  const cumulativeAmount = (
    amountToCents(priorCumulativeAmount) + amountToCents(invoice.total_amount)
  ) / 100

  if (cumulativeAmount > 3000) {
    return {
      qualificationStatus: 'rejected',
      qualificationReason: `同销售方本自然周累计金额为 ${cumulativeAmount.toFixed(2)} 元，超过 3000 元`,
      cumulativeAmount,
      cumulativeWeekStart: weekStart,
      submittedAt,
      priorCumulativeAmount,
    }
  }

  if (cumulativeAmount > 1000) {
    const weeklyVoucherDecision = await resolveWeeklyVoucherRequirement({
      connection,
      invoice,
      cumulativeWeekStart: weekStart,
      cumulativeAmount,
      persistRequirement: persistWeeklyVoucherRequirement,
      operatorId,
    })

    if (!weeklyVoucherDecision.allInvoicesHaveApprovedVoucher) {
      return {
        qualificationStatus: 'pending_voucher',
        qualificationReason: `同销售方本自然周累计金额为 ${cumulativeAmount.toFixed(2)} 元，已关联 ${weeklyVoucherDecision.relatedInvoiceCount} 张发票，需全部补齐并审核通过支付凭证`,
        cumulativeAmount,
        cumulativeWeekStart: weekStart,
        submittedAt,
        priorCumulativeAmount,
        weeklyVoucherRequirement: weeklyVoucherDecision.requirement,
      }
    }

    return {
      qualificationStatus: 'approved',
      qualificationReason: '商品品类、单价、同周关联发票支付凭证和自然周累计规则校验通过',
      cumulativeAmount,
      cumulativeWeekStart: weekStart,
      submittedAt,
      priorCumulativeAmount,
      weeklyVoucherRequirement: weeklyVoucherDecision.requirement,
    }
  }

  if (priceDecision.hasLowValue) {
    const hasVoucher = await voucherRepository.hasApprovedCompleteGroup({
      connection,
      invoiceId: invoice.id,
    })

    if (!hasVoucher) {
      return {
        qualificationStatus: 'pending_voucher',
        qualificationReason: '发票包含低值品，需补充并审核通过订单截图和支付记录',
        cumulativeAmount,
        cumulativeWeekStart: weekStart,
        submittedAt,
        priorCumulativeAmount,
      }
    }
  }

  return {
    qualificationStatus: 'approved',
    qualificationReason: '商品品类、单价、支付凭证和自然周累计规则校验通过',
    cumulativeAmount,
    cumulativeWeekStart: weekStart,
    submittedAt,
    priorCumulativeAmount,
  }
}

// 预览规则计算结果，不更新发票状态、累计字段或操作日志。
async function getInvoiceQualificationPreview({
  invoiceId,
}) {
  const normalizedInvoiceId = parsePositiveInteger(invoiceId, 'invoiceId')
  const invoice = await invoiceReviewRepository.findInvoiceForQualificationPreview({
    invoiceId: normalizedInvoiceId,
  })

  if (!invoice) {
    throw createHttpError(404, '发票不存在')
  }

  if (!invoice.submitted_at) {
    throw createHttpError(409, '请先提交审核，再查看规则预览')
  }

  if (invoice.qualification_status === 'cancelled') {
    throw createHttpError(409, '已取消的发票不能查看审核预览')
  }

  const items = await invoiceReviewRepository.findItemsForQualificationPreview({
    invoiceId: normalizedInvoiceId,
  })
  const decision = await resolveApprovalDecision({
    connection: pool,
    invoice,
    items,
    findApprovedInvoicesForWeek: invoiceReviewRepository.findApprovedInvoicesForWeekPreview,
    persistWeeklyVoucherRequirement: false,
  })

  return {
    invoiceId: normalizedInvoiceId,
    priorCumulativeAmount: decision.priorCumulativeAmount ?? null,
    currentInvoiceAmount: amountToCents(invoice.total_amount) / 100,
    projectedCumulativeAmount: decision.cumulativeAmount,
    cumulativeWeekStart: decision.cumulativeWeekStart,
    projectedQualificationStatus: decision.qualificationStatus,
    projectedQualificationReason: decision.qualificationReason,
    requiresVoucher: decision.qualificationStatus === 'pending_voucher',
    calculable: decision.cumulativeAmount !== null,
  }
}
// 单独审核某个商品的品类（人工改判）
async function reviewItemCategory({ itemId, result, note, operatorId }) {
  if (!Number.isInteger(Number(itemId)) || Number(itemId) <= 0) {
    const error = new Error('itemId 无效')
    error.statusCode = 400
    error.expose = true
    throw error
  }
  if (!ALLOWED_RESULTS.has(result)) {
    const error = new Error('result 必须是可以、存疑或不可以')
    error.statusCode = 400
    error.expose = true
    throw error
  }
  if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > 2000)) {
    const error = new Error('note 必须是不超过 2000 个字符的文本')
    error.statusCode = 400
    error.expose = true
    throw error
  }
  const connection = await pool.getConnection()
  try {
    return await invoiceReviewRepository.reviewItemCategory({ connection, itemId: Number(itemId), result, note, operatorId })
  } finally {
    connection.release()
  }
}

// 人工补全识别缺失或异常的发票、商品资料；不覆盖 AI 原始结果。
async function updateInvoiceManualData({
  invoiceId,
  invoice,
  items,
  note,
  operatorId,
}) {
  const normalizedInvoiceId = parsePositiveInteger(invoiceId, 'invoiceId')
  const normalizedOperatorId = parsePositiveInteger(operatorId, 'operatorId')
  const normalizedInvoicePatch = normalizeInvoicePatch(invoice)
  const normalizedItems = normalizeManualItems(items)
  const normalizedNote = normalizeManualNote(note)

  if (
    Object.keys(normalizedInvoicePatch).length === 0
    && normalizedItems.length === 0
  ) {
    throw createHttpError(400, '至少需要补全一项发票或商品资料')
  }

  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const currentInvoice = await invoiceReviewRepository.findInvoiceForManualCompletion({
      connection,
      invoiceId: normalizedInvoiceId,
    })

    if (!currentInvoice) {
      throw createHttpError(404, '发票不存在')
    }

    if (currentInvoice.qualification_status !== 'pending_manual') {
      throw createHttpError(409, '仅待人工处理的发票允许补全资料')
    }

    if (
      currentInvoice.finance_status !== 'not_submitted'
      || currentInvoice.reimbursement_status !== 'not_completed'
    ) {
      throw createHttpError(409, '已进入财务或报销流程的发票不能补全资料')
    }

    if (currentInvoice.submitted_at && normalizedItems.length > 0) {
      throw createHttpError(
        409,
        '已提交审核的发票不能修改商品明细，请联系管理员处理',
      )
    }

    const currentItems = await invoiceReviewRepository.findItemsForManualCompletion({
      connection,
      invoiceId: normalizedInvoiceId,
    })
    const initialValidation = validateStoredInvoiceData({
      invoice: currentInvoice,
      items: currentItems,
    })

    if (initialValidation.valid) {
      throw createHttpError(
        409,
        '当前待人工处理属于商品品类确认，请使用人工确认品类入口',
      )
    }

    const existingItemsById = new Map(
      currentItems.map((item) => {
        return [Number(item.id), item]
      }),
    )
    const effectiveInvoiceData = resolveEffectiveInvoiceData({
      invoice: currentInvoice,
      patch: normalizedInvoicePatch,
    })
    const invoiceDataChanged = hasInvoiceDataChanged({
      invoice: currentInvoice,
      effectiveInvoiceData,
    })
    const changedItemIds = []
    const createdItemIds = []

    for (const item of normalizedItems) {
      const priceJudgment = classifyUnitPrice(item.unitPrice)

      if (item.itemId) {
        const existingItem = existingItemsById.get(item.itemId)

        if (!existingItem) {
          throw createHttpError(400, '商品明细不属于当前发票')
        }

        if (!hasItemDataChanged({
          item: existingItem,
          input: item,
        })) {
          continue
        }

        await invoiceReviewRepository.updateItemManualData({
          connection,
          itemId: existingItem.id,
          itemName: item.itemName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          priceType: priceJudgment.priceType,
          lineAmount: item.lineAmount,
        })
        changedItemIds.push(existingItem.id)
        continue
      }

      const createdItemId = await invoiceReviewRepository.createManualItemData({
        connection,
        invoiceId: normalizedInvoiceId,
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        priceType: priceJudgment.priceType,
        lineAmount: item.lineAmount,
      })
      createdItemIds.push(createdItemId)
    }

    if (
      !invoiceDataChanged
      && changedItemIds.length === 0
      && createdItemIds.length === 0
    ) {
      throw createHttpError(400, '提交的数据未发生变化')
    }

    await invoiceReviewRepository.updateInvoiceManualData({
      connection,
      invoiceId: normalizedInvoiceId,
      invoiceNumber: effectiveInvoiceData.invoiceNumber,
      sellerName: effectiveInvoiceData.sellerName,
      sellerTaxId: effectiveInvoiceData.sellerTaxId,
      invoiceDate: effectiveInvoiceData.invoiceDate,
      totalAmount: effectiveInvoiceData.totalAmount,
      manualNote: normalizedNote,
    })

    const updatedInvoice = await invoiceReviewRepository.findInvoiceForManualCompletion({
      connection,
      invoiceId: normalizedInvoiceId,
    })
    const updatedItems = await invoiceReviewRepository.findItemsForManualCompletion({
      connection,
      invoiceId: normalizedInvoiceId,
    })
    const validation = validateStoredInvoiceData({
      invoice: updatedInvoice,
      items: updatedItems,
    })
    const dataIssues = toDataIssues(validation.errors)
    let qualificationStatus = 'pending_manual'
    let qualificationReason = getDataIssueReason(dataIssues)
    let manualProcessingType = 'data_completion'
    let duplicateInvoice = null

    if (validation.valid) {
      const categoryDecision = getCategoryDecision(updatedItems)

      if (categoryDecision) {
        qualificationStatus = categoryDecision.status
        qualificationReason = categoryDecision.reason
        manualProcessingType = categoryDecision.status === 'pending_manual'
          ? 'category_confirmation'
          : null
      } else {
        duplicateInvoice = await invoiceRepository.findDuplicateInvoice({
          connection,
          invoiceId: normalizedInvoiceId,
          sellerTaxId: updatedInvoice.seller_tax_id,
          invoiceNumber: updatedInvoice.invoice_number,
          forUpdate: true,
        })

        if (duplicateInvoice) {
          qualificationStatus = 'pending_manual'
          qualificationReason = buildSuspectedDuplicateReason({
            duplicateInvoiceId: duplicateInvoice.id,
          })
          manualProcessingType = null
        } else {
          qualificationStatus = 'pending'
          qualificationReason = updatedInvoice.submitted_at
            ? '资料已补全，等待重新执行规则审核'
            : '资料已补全，等待提交审核'
          manualProcessingType = null
        }
      }
    }

    await invoiceReviewRepository.updateManualCompletionState({
      connection,
      invoiceId: normalizedInvoiceId,
      qualificationStatus,
      qualificationReason,
    })

    await invoiceReviewRepository.createQualificationReviewLog({
      connection,
      operatorId: normalizedOperatorId,
      invoiceId: normalizedInvoiceId,
      operationType: 'manual_complete_invoice_data',
      beforeData: {
        invoice: currentInvoice,
        items: currentItems,
      },
      afterData: {
        invoice: {
          invoiceNumber: effectiveInvoiceData.invoiceNumber,
          sellerName: effectiveInvoiceData.sellerName,
          sellerTaxId: effectiveInvoiceData.sellerTaxId,
          invoiceDate: effectiveInvoiceData.invoiceDate,
          totalAmount: effectiveInvoiceData.totalAmount,
          manualNote: normalizedNote,
        },
        changedItemIds,
        createdItemIds,
        dataIssues,
        qualificationStatus,
        qualificationReason,
        duplicateInvoiceId: duplicateInvoice?.id || null,
      },
    })

    if (duplicateInvoice) {
      await invoiceReviewRepository.createQualificationReviewLog({
        connection,
        operatorId: normalizedOperatorId,
        invoiceId: normalizedInvoiceId,
        operationType: 'duplicate_detected',
        beforeData: {
          qualificationStatus: 'pending_manual',
          qualificationReason: '资料补全后执行重复检测',
        },
        afterData: {
          qualificationStatus,
          qualificationReason,
          duplicateInvoiceId: duplicateInvoice.id,
          duplicateRule: 'seller_tax_id_and_invoice_number',
        },
      })
    }

    await connection.commit()

    return {
      id: normalizedInvoiceId,
      qualificationStatus,
      qualificationReason,
      completionRequired: dataIssues.length > 0,
      dataIssues,
      manualProcessingType,
      duplicateInvoiceId: duplicateInvoice?.id || null,
      changedItemIds,
      createdItemIds,
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

// 提交审核的更新submitted_at的时间
async function submitInvoiceForReview({
  invoiceId,
  operatorId,
}) {
  const normalizedInvoiceId = parsePositiveInteger(invoiceId, 'invoiceId')
  const normalizedOperatorId = parsePositiveInteger(operatorId, 'operatorId')
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const invoice = await invoiceReviewRepository.findInvoiceForQualificationReview({
      connection,
      invoiceId: normalizedInvoiceId,
    })

    if (!invoice) {
      throw createHttpError(404, '发票不存在')
    }

    if (invoice.submitted_at) {
      throw createHttpError(409, '发票已提交审核，不能重复提交')
    }

    if (invoice.qualification_status !== 'pending') {
      throw createHttpError(409, '当前发票状态不能提交审核')
    }

    // 仅所有商品最终品类均为“可以”的发票可以提交审核。
    const items = await invoiceReviewRepository.findItemsForQualificationReview({
      connection,
      invoiceId: normalizedInvoiceId,
    })
    const manualProcessing = getManualProcessingContext({
      invoice,
      items,
    })

    if (manualProcessing.completionRequired) {
      throw createHttpError(
        409,
        `资料待补全，不能提交审核：${getDataIssueReason(manualProcessing.dataIssues)}`,
      )
    }

    const duplicateInvoice = await invoiceRepository.findDuplicateInvoice({
      connection,
      invoiceId: normalizedInvoiceId,
      sellerTaxId: invoice.seller_tax_id,
      invoiceNumber: invoice.invoice_number,
      forUpdate: true,
    })

    const hasActiveDuplicateClearDecision = duplicateInvoice
      ? await invoiceReviewRepository.hasActiveDuplicateClearDecision({
        connection,
        invoiceId: normalizedInvoiceId,
        duplicateInvoiceId: duplicateInvoice.id,
        invoiceUpdatedAt: invoice.updated_at,
      })
      : false

    if (duplicateInvoice && !hasActiveDuplicateClearDecision) {
      const qualificationReason = buildSuspectedDuplicateReason({
        duplicateInvoiceId: duplicateInvoice.id,
      })

      await invoiceReviewRepository.updateManualCompletionState({
        connection,
        invoiceId: normalizedInvoiceId,
        qualificationStatus: 'pending_manual',
        qualificationReason,
      })

      await invoiceReviewRepository.createQualificationReviewLog({
        connection,
        operatorId: normalizedOperatorId,
        invoiceId: normalizedInvoiceId,
        operationType: 'duplicate_detected',
        beforeData: {
          qualificationStatus: invoice.qualification_status,
          qualificationReason: invoice.qualification_reason,
          submittedAt: invoice.submitted_at,
        },
        afterData: {
          qualificationStatus: 'pending_manual',
          qualificationReason,
          duplicateInvoiceId: duplicateInvoice.id,
          duplicateRule: 'seller_tax_id_and_invoice_number',
        },
      })

      await connection.commit()

      return {
        id: normalizedInvoiceId,
        qualificationStatus: 'pending_manual',
        qualificationReason,
        submittedAt: null,
      }
    }

    const nonApprovedItem = items.find(
      (item) => item.final_category_result !== '可以',
    )

    if (items.length === 0 || nonApprovedItem) {
      throw createHttpError(
        409,
        `商品“${nonApprovedItem?.item_name || '未知'}”品类不是“可以”，不能提交审核`,
      )
    }

    const submittedAt = new Date()
    const qualificationReason = '管理员已提交审核，等待发票级审核'
    const beforeData = {
      qualificationStatus: invoice.qualification_status,
      qualificationReason: invoice.qualification_reason,
      submittedAt: invoice.submitted_at,
    }

    // 更新发票的资质状态为pending
    await invoiceReviewRepository.updateInvoiceQualificationReview({
      connection,
      invoiceId: normalizedInvoiceId,
      qualificationStatus: 'pending',
      qualificationReason,
      cumulativeAmount: invoice.cumulative_amount,
      cumulativeWeekStart: invoice.cumulative_week_start,
      submittedAt,
      manualNote: invoice.manual_note,
    })

    const afterData = {
      qualificationStatus: 'pending',
      qualificationReason,
      submittedAt,
    }

    // 创建发票的提交时间
    await invoiceReviewRepository.createQualificationReviewLog({
      connection,
      operatorId: normalizedOperatorId,
      invoiceId: normalizedInvoiceId,
      beforeData,
      afterData,
      operationType: 'submit_qualification_review',
    })

    // 提交事务
    await connection.commit()

    return {
      id: normalizedInvoiceId,
      qualificationStatus: 'pending',
      qualificationReason,
      submittedAt,
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

// 管理员只能执行规则审核，或放弃当前发票。
async function reviewInvoiceQualification({
  invoiceId,
  action,
  note,
  operatorId,
}) {
  const normalizedInvoiceId = parsePositiveInteger(invoiceId, 'invoiceId')
  const normalizedOperatorId = parsePositiveInteger(operatorId, 'operatorId')

  if (!QUALIFICATION_ACTIONS.has(action)) {
    throw createHttpError(400, 'action 无效')
  }

  const normalizedNote = validateNote(note, action)

  if (action === 'execute_rules' && normalizedNote) {
    throw createHttpError(400, '执行规则审核不接受审核说明')
  }

  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const invoice = await invoiceReviewRepository.findInvoiceForQualificationReview({
      connection,
      invoiceId: normalizedInvoiceId,
    })

    if (!invoice) {
      throw createHttpError(404, '发票不存在')
    }

    if (!invoice.submitted_at) {
      throw createHttpError(409, '请先提交审核，再进行发票级审核')
    }

    if (invoice.qualification_status === 'cancelled') {
      throw createHttpError(409, '已取消的发票不能执行规则审核或再次放弃')
    }

    if (
      action === 'execute_rules'
      && invoice.qualification_status !== 'pending'
    ) {
      throw createHttpError(409, '当前发票不是待审核状态，不能执行规则审核')
    }

    if (
      action === 'abandon'
      && !ABANDONABLE_QUALIFICATION_STATUSES.has(invoice.qualification_status)
    ) {
      throw createHttpError(409, '当前发票状态不能放弃')
    }

    if (
      action === 'abandon'
      && (
        invoice.finance_status !== 'not_submitted'
        || invoice.reimbursement_status !== 'not_completed'
      )
    ) {
      throw createHttpError(409, '已进入财务或报销流程的发票不能放弃')
    }

    const beforeData = {
      qualificationStatus: invoice.qualification_status,
      qualificationReason: invoice.qualification_reason,
      cumulativeAmount: invoice.cumulative_amount,
      cumulativeWeekStart: invoice.cumulative_week_start,
      submittedAt: invoice.submitted_at,
      manualNote: invoice.manual_note,
    }
    let decision

    if (action === 'execute_rules') {
      const items = await invoiceReviewRepository.findItemsForQualificationReview({
        connection,
        invoiceId: normalizedInvoiceId,
      })
      const manualProcessing = getManualProcessingContext({
        invoice,
        items,
      })

      if (manualProcessing.completionRequired) {
        throw createHttpError(
          409,
          `资料待补全，不能执行规则审核：${getDataIssueReason(manualProcessing.dataIssues)}`,
        )
      }

      decision = await resolveApprovalDecision({
        connection,
        invoice,
        items,
        operatorId: normalizedOperatorId,
      })
    } else {
      const pendingRequirement = await weeklyVoucherRequirementRepository.findPendingRequirementByTriggerInvoiceId({
        connection,
        triggerInvoiceId: normalizedInvoiceId,
        forUpdate: true,
      })

      if (pendingRequirement) {
        const cancelledAt = new Date()

        await weeklyVoucherRequirementRepository.cancelRequirement({
          connection,
          requirementId: pendingRequirement.id,
          cancelledAt,
        })

        await weeklyVoucherRequirementRepository.createWeeklyVoucherRequirementOperationLog({
          connection,
          operatorId: normalizedOperatorId,
          requirementId: pendingRequirement.id,
          operationType: 'cancel_weekly_voucher_requirement',
          beforeData: {
            status: pendingRequirement.status,
            triggerInvoiceId: pendingRequirement.trigger_invoice_id,
          },
          afterData: {
            status: 'cancelled',
            cancelledAt,
            cancellationReason: normalizedNote,
          },
        })
      }

      decision = {
        qualificationStatus: 'cancelled',
        qualificationReason: normalizedNote,
        cumulativeAmount: invoice.cumulative_amount,
        cumulativeWeekStart: invoice.cumulative_week_start,
        submittedAt: invoice.submitted_at,
        weeklyVoucherRequirement: pendingRequirement
          ? {
            id: pendingRequirement.id,
            status: 'cancelled',
          }
          : null,
      }
    }

    const cumulativeAmount = action === 'execute_rules'
      ? decision.cumulativeAmount
      : invoice.cumulative_amount
    const cumulativeWeekStart = action === 'execute_rules'
      ? decision.cumulativeWeekStart
      : invoice.cumulative_week_start
    const submittedAt = decision.submittedAt
    const manualNote = invoice.manual_note

    await invoiceReviewRepository.updateInvoiceQualificationReview({
      connection,
      invoiceId: normalizedInvoiceId,
      qualificationStatus: decision.qualificationStatus,
      qualificationReason: decision.qualificationReason,
      cumulativeAmount,
      cumulativeWeekStart,
      submittedAt,
      manualNote,
    })

    const afterData = {
      action,
      qualificationStatus: decision.qualificationStatus,
      qualificationReason: decision.qualificationReason,
      cumulativeAmount,
      cumulativeWeekStart,
      submittedAt: submittedAt || invoice.submitted_at,
      manualNote,
      weeklyVoucherRequirement: decision.weeklyVoucherRequirement || null,
    }

    await invoiceReviewRepository.createQualificationReviewLog({
      connection,
      operatorId: normalizedOperatorId,
      invoiceId: normalizedInvoiceId,
      beforeData,
      afterData,
      operationType: action === 'execute_rules'
        ? 'execute_qualification_rules'
        : 'abandon_invoice',
    })

    await connection.commit()

    return {
      id: normalizedInvoiceId,
      action,
      qualificationStatus: decision.qualificationStatus,
      qualificationReason: decision.qualificationReason,
      cumulativeAmount,
      cumulativeWeekStart,
      submittedAt: submittedAt || invoice.submitted_at,
      manualNote,
      weeklyVoucherRequirement: decision.weeklyVoucherRequirement || null,
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

// 管理员确认疑似重复发票：确认重复则取消，确认非重复则恢复正常预审流程。
async function reviewInvoiceDuplicate({
  invoiceId,
  decision,
  note,
  operatorId,
}) {
  const normalizedInvoiceId = parsePositiveInteger(invoiceId, 'invoiceId')
  const normalizedOperatorId = parsePositiveInteger(operatorId, 'operatorId')

  if (!DUPLICATE_REVIEW_DECISIONS.has(decision)) {
    throw createHttpError(400, 'decision 无效')
  }

  const normalizedNote = validateNote(note, decision)
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const invoice = await invoiceReviewRepository.findInvoiceForQualificationReview({
      connection,
      invoiceId: normalizedInvoiceId,
    })

    if (!invoice) {
      throw createHttpError(404, '发票不存在')
    }

    if (
      invoice.qualification_status !== 'pending_manual'
      || !isSuspectedDuplicateReason(invoice.qualification_reason)
    ) {
      throw createHttpError(409, '当前发票不是待确认的疑似重复发票')
    }

    if (
      invoice.finance_status !== 'not_submitted'
      || invoice.reimbursement_status !== 'not_completed'
    ) {
      throw createHttpError(409, '已进入财务或报销流程的发票不能进行重复判定')
    }

    const duplicateInvoiceId = getSuspectedDuplicateInvoiceId(
      invoice.qualification_reason,
    )
    const beforeData = {
      qualificationStatus: invoice.qualification_status,
      qualificationReason: invoice.qualification_reason,
      cumulativeAmount: invoice.cumulative_amount,
      cumulativeWeekStart: invoice.cumulative_week_start,
      submittedAt: invoice.submitted_at,
      duplicateInvoiceId,
    }
    let result

    if (decision === 'duplicate') {
      result = {
        qualificationStatus: 'cancelled',
        qualificationReason: normalizedNote
          ? `【重复发票】已确认与发票 #${duplicateInvoiceId || '未知'} 重复：${normalizedNote}`
          : `【重复发票】已确认与发票 #${duplicateInvoiceId || '未知'} 重复，已取消`,
        cumulativeAmount: invoice.cumulative_amount,
        cumulativeWeekStart: invoice.cumulative_week_start,
        submittedAt: invoice.submitted_at,
      }
    } else if (invoice.submitted_at) {
      const items = await invoiceReviewRepository.findItemsForQualificationReview({
        connection,
        invoiceId: normalizedInvoiceId,
      })
      const manualProcessing = getManualProcessingContext({
        invoice,
        items,
      })

      if (manualProcessing.completionRequired) {
        throw createHttpError(
          409,
          `资料待补全，不能继续预审：${getDataIssueReason(manualProcessing.dataIssues)}`,
        )
      }

      result = await resolveApprovalDecision({
        connection,
        invoice,
        items,
        operatorId: normalizedOperatorId,
      })
    } else {
      result = {
        qualificationStatus: 'pending',
        qualificationReason: normalizedNote
          ? `已确认非重复：${normalizedNote}；等待提交审核`
          : '已确认非重复，等待提交审核',
        cumulativeAmount: null,
        cumulativeWeekStart: null,
        submittedAt: null,
      }
    }

    await invoiceReviewRepository.updateInvoiceQualificationReview({
      connection,
      invoiceId: normalizedInvoiceId,
      qualificationStatus: result.qualificationStatus,
      qualificationReason: result.qualificationReason,
      cumulativeAmount: result.cumulativeAmount,
      cumulativeWeekStart: result.cumulativeWeekStart,
      submittedAt: result.submittedAt,
      manualNote: invoice.manual_note,
    })

    const afterData = {
      decision,
      qualificationStatus: result.qualificationStatus,
      qualificationReason: result.qualificationReason,
      cumulativeAmount: result.cumulativeAmount,
      cumulativeWeekStart: result.cumulativeWeekStart,
      submittedAt: result.submittedAt || invoice.submitted_at,
      duplicateInvoiceId,
    }

    await invoiceReviewRepository.createQualificationReviewLog({
      connection,
      operatorId: normalizedOperatorId,
      invoiceId: normalizedInvoiceId,
      beforeData,
      afterData,
      operationType: decision === 'duplicate'
        ? 'duplicate_confirmed'
        : 'duplicate_cleared',
    })

    await connection.commit()

    return {
      id: normalizedInvoiceId,
      decision,
      duplicateInvoiceId,
      qualificationStatus: result.qualificationStatus,
      qualificationReason: result.qualificationReason,
      cumulativeAmount: result.cumulativeAmount,
      cumulativeWeekStart: result.cumulativeWeekStart,
      submittedAt: result.submittedAt || invoice.submitted_at,
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

module.exports = {
  reviewItemCategory,
  updateInvoiceManualData,
  submitInvoiceForReview,
  getInvoiceQualificationPreview,
  reviewInvoiceQualification,
  reviewInvoiceDuplicate,
}
