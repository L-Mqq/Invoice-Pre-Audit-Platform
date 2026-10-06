const { pool } = require('../config/database')

// 查询同一销售方、同一自然周进行中的凭证补齐任务。
async function findPendingRequirementForWeek({
  connection = pool,
  sellerTaxId,
  cumulativeWeekStart,
  forUpdate = false,
}) {
  const lockClause = forUpdate ? ' FOR UPDATE' : ''
  const [rows] = await connection.execute(
    `SELECT
       id,
       seller_tax_id,
       cumulative_week_start,
       trigger_invoice_id,
       triggered_cumulative_amount,
       status,
       completed_at,
       cancelled_at,
       created_at,
       updated_at
     FROM weekly_voucher_requirements
     WHERE seller_tax_id = ?
       AND cumulative_week_start = ?
       AND status = 'pending'${lockClause}`,
    [
      sellerTaxId,
      cumulativeWeekStart,
    ],
  )

  return rows[0] || null
}

// 按任务主键查询任务；状态变更前可使用 FOR UPDATE 锁定任务。
async function findRequirementById({
  connection = pool,
  requirementId,
  forUpdate = false,
}) {
  const lockClause = forUpdate ? ' FOR UPDATE' : ''
  const [rows] = await connection.execute(
    `SELECT
       id,
       seller_tax_id,
       cumulative_week_start,
       trigger_invoice_id,
       triggered_cumulative_amount,
       status,
       completed_at,
       cancelled_at,
       created_at,
       updated_at
     FROM weekly_voucher_requirements
     WHERE id = ?${lockClause}`,
    [requirementId],
  )

  return rows[0] || null
}

// 查询由指定触发发票创建的进行中任务。
async function findPendingRequirementByTriggerInvoiceId({
  connection = pool,
  triggerInvoiceId,
  forUpdate = false,
}) {
  const lockClause = forUpdate ? ' FOR UPDATE' : ''
  const [rows] = await connection.execute(
    `SELECT
       id,
       seller_tax_id,
       cumulative_week_start,
       trigger_invoice_id,
       triggered_cumulative_amount,
       status,
       completed_at,
       cancelled_at,
       created_at,
       updated_at
     FROM weekly_voucher_requirements
     WHERE trigger_invoice_id = ?
       AND status = 'pending'${lockClause}`,
    [triggerInvoiceId],
  )

  return rows[0] || null
}

// 创建一条同销售方、同自然周的凭证补齐任务。
async function createRequirement({
  connection = pool,
  sellerTaxId,
  cumulativeWeekStart,
  triggerInvoiceId,
  triggeredCumulativeAmount,
}) {
  const [result] = await connection.execute(
    `INSERT INTO weekly_voucher_requirements
      (
        seller_tax_id,
        cumulative_week_start,
        trigger_invoice_id,
        triggered_cumulative_amount,
        status
      )
     VALUES (?, ?, ?, ?, 'pending')`,
    [
      sellerTaxId,
      cumulativeWeekStart,
      triggerInvoiceId,
      triggeredCumulativeAmount,
    ],
  )

  return {
    id: result.insertId,
    sellerTaxId,
    cumulativeWeekStart,
    triggerInvoiceId,
    triggeredCumulativeAmount,
    status: 'pending',
  }
}

// 将一张发票加入凭证补齐任务。
async function createRequirementInvoice({
  connection = pool,
  requirementId,
  invoiceId,
  invoiceRole,
  voucherStatus = 'pending',
  approvedVoucherGroupId = null,
  completedAt = null,
}) {
  const [result] = await connection.execute(
    `INSERT INTO weekly_voucher_requirement_invoices
      (
        requirement_id,
        invoice_id,
        invoice_role,
        voucher_status,
        approved_voucher_group_id,
        completed_at
      )
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      requirementId,
      invoiceId,
      invoiceRole,
      voucherStatus,
      approvedVoucherGroupId,
      completedAt,
    ],
  )

  return {
    id: result.insertId,
    requirementId,
    invoiceId,
    invoiceRole,
    voucherStatus,
    approvedVoucherGroupId,
    completedAt,
  }
}

// 记录周累计凭证任务及关联发票的状态变更，保证任务生命周期可追溯。
async function createWeeklyVoucherRequirementOperationLog({
  connection = pool,
  operatorId = null,
  requirementId,
  operationType,
  beforeData = null,
  afterData = null,
}) {
  await connection.execute(
    `INSERT INTO operation_logs
      (
        operator_id,
        operation_type,
        resource_type,
        resource_id,
        before_data,
        after_data
      )
     VALUES (?, ?, 'weekly_voucher_requirement', ?, ?, ?)`,
    [
      operatorId,
      operationType,
      requirementId,
      JSON.stringify(beforeData),
      JSON.stringify(afterData),
    ],
  )
}

// 查询任务下的全部关联发票与凭证完成状态。
async function findRequirementInvoices({
  connection = pool,
  requirementId,
  forUpdate = false,
}) {
  const lockClause = forUpdate ? ' FOR UPDATE' : ''
  const [rows] = await connection.execute(
    `SELECT
       wvri.id,
       wvri.requirement_id,
       wvri.invoice_id,
       wvri.invoice_role,
       wvri.voucher_status,
       wvri.approved_voucher_group_id,
       wvri.completed_at,
       wvri.created_at,
       wvri.updated_at,
       i.invoice_number,
       i.seller_name,
       i.total_amount,
       i.qualification_status,
       i.finance_status,
       i.reimbursement_status
     FROM weekly_voucher_requirement_invoices wvri
     JOIN invoices i ON i.id = wvri.invoice_id
     WHERE wvri.requirement_id = ?
     ORDER BY
       CASE wvri.invoice_role
         WHEN 'existing' THEN 0
         ELSE 1
       END,
       wvri.id${lockClause}`,
    [requirementId],
  )

  return rows
}

// 查询发票参与的所有进行中凭证任务，用于财务提交限制和详情展示。
async function findPendingRequirementsByInvoiceId({
  connection = pool,
  invoiceId,
  forUpdate = false,
}) {
  const lockClause = forUpdate ? ' FOR UPDATE' : ''
  const [rows] = await connection.execute(
    `SELECT
       wvr.id,
       wvr.seller_tax_id,
       wvr.cumulative_week_start,
       wvr.trigger_invoice_id,
       wvr.triggered_cumulative_amount,
       wvr.status,
       wvri.id AS requirement_invoice_id,
       wvri.invoice_role,
       wvri.voucher_status,
       wvri.approved_voucher_group_id,
       wvri.completed_at
     FROM weekly_voucher_requirement_invoices wvri
     JOIN weekly_voucher_requirements wvr ON wvr.id = wvri.requirement_id
     WHERE wvri.invoice_id = ?
       AND wvr.status = 'pending'${lockClause}`,
    [invoiceId],
  )

  return rows
}

// 查询发票参与的全部周累计凭证任务，包含进行中和历史任务。
async function findRequirementsByInvoiceId({
  connection = pool,
  invoiceId,
}) {
  const [rows] = await connection.execute(
    `SELECT
       wvr.id,
       wvr.seller_tax_id,
       wvr.cumulative_week_start,
       wvr.trigger_invoice_id,
       wvr.triggered_cumulative_amount,
       wvr.status,
       wvr.completed_at,
       wvr.cancelled_at,
       wvr.created_at,
       wvr.updated_at,
       wvri.id AS requirement_invoice_id,
       wvri.invoice_role,
       wvri.voucher_status,
       wvri.approved_voucher_group_id,
       wvri.completed_at AS invoice_completed_at
     FROM weekly_voucher_requirement_invoices wvri
     JOIN weekly_voucher_requirements wvr ON wvr.id = wvri.requirement_id
     WHERE wvri.invoice_id = ?
     ORDER BY
       CASE wvr.status
         WHEN 'pending' THEN 0
         WHEN 'completed' THEN 1
         ELSE 2
       END,
       wvr.created_at DESC,
       wvr.id DESC`,
    [invoiceId],
  )

  return rows
}

// 更新某张关联发票的凭证完成状态。
async function updateRequirementInvoiceVoucherStatus({
  connection = pool,
  requirementInvoiceId,
  voucherStatus,
  approvedVoucherGroupId = null,
  completedAt = null,
}) {
  await connection.execute(
    `UPDATE weekly_voucher_requirement_invoices
        SET voucher_status = ?,
            approved_voucher_group_id = ?,
            completed_at = ?
      WHERE id = ?`,
    [
      voucherStatus,
      approvedVoucherGroupId,
      completedAt,
      requirementInvoiceId,
    ],
  )
}

// 获取任务当前完成进度；调用方应在同一事务中锁定任务及关联记录后使用。
async function getRequirementProgress({
  connection = pool,
  requirementId,
}) {
  const [rows] = await connection.execute(
    `SELECT
       COUNT(*) AS total_count,
       SUM(voucher_status = 'approved') AS approved_count,
       SUM(voucher_status = 'pending') AS pending_count,
       SUM(voucher_status = 'cancelled') AS cancelled_count
     FROM weekly_voucher_requirement_invoices
     WHERE requirement_id = ?`,
    [requirementId],
  )
  const progress = rows[0] || {}

  return {
    totalCount: Number(progress.total_count || 0),
    approvedCount: Number(progress.approved_count || 0),
    pendingCount: Number(progress.pending_count || 0),
    cancelledCount: Number(progress.cancelled_count || 0),
  }
}

// 将全部关联发票均已满足凭证要求的任务标记为完成。
async function completeRequirement({
  connection = pool,
  requirementId,
  completedAt,
}) {
  await connection.execute(
    `UPDATE weekly_voucher_requirements
        SET status = 'completed',
            completed_at = ?,
            cancelled_at = NULL
      WHERE id = ?
        AND status = 'pending'`,
    [
      completedAt,
      requirementId,
    ],
  )
}

// 取消任务及其所有关联发票要求。
async function cancelRequirement({
  connection = pool,
  requirementId,
  cancelledAt,
}) {
  await connection.execute(
    `UPDATE weekly_voucher_requirement_invoices
        SET voucher_status = 'cancelled',
            approved_voucher_group_id = NULL,
            completed_at = NULL
      WHERE requirement_id = ?
        AND voucher_status <> 'cancelled'`,
    [requirementId],
  )

  await connection.execute(
    `UPDATE weekly_voucher_requirements
        SET status = 'cancelled',
            cancelled_at = ?,
            completed_at = NULL
      WHERE id = ?
        AND status = 'pending'`,
    [
      cancelledAt,
      requirementId,
    ],
  )
}

module.exports = {
  cancelRequirement,
  completeRequirement,
  createRequirement,
  createRequirementInvoice,
  createWeeklyVoucherRequirementOperationLog,
  findPendingRequirementByTriggerInvoiceId,
  findPendingRequirementForWeek,
  findPendingRequirementsByInvoiceId,
  findRequirementsByInvoiceId,
  findRequirementById,
  findRequirementInvoices,
  getRequirementProgress,
  updateRequirementInvoiceVoucherStatus,
}
