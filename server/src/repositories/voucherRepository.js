const { pool } = require('../config/database')

// 查询发票信息
async function findInvoiceById({
  connection = pool,
  invoiceId,
  forUpdate = false,
}) {
  const lockClause = forUpdate ? ' FOR UPDATE' : ''
  const [rows] = await connection.execute(
    `SELECT
       id,
       submitted_at,
       qualification_status,
       qualification_reason
       FROM invoices
      WHERE id = ?${lockClause}`,
    [invoiceId],
  )

  return rows[0] || null
}

// 创建凭证组
async function createVoucherGroup({
  connection = pool,
  invoiceId,
  groupName,
}) {
  const [result] = await connection.execute(
    `INSERT INTO voucher_groups
      (invoice_id, group_name, review_status)
     VALUES (?, ?, 'pending_upload')`,
    [invoiceId, groupName],
  )

  return {
    id: result.insertId,
    invoiceId,
    groupName,
    reviewStatus: 'pending_upload',
  }
}

// 获取凭证组的信息
async function findVoucherGroupById({
  connection = pool,
  groupId,
  forUpdate = false,
}) {
  const lockClause = forUpdate ? ' FOR UPDATE' : ''
  const [rows] = await connection.execute(
    `SELECT
       id,
       invoice_id,
       group_name,
       review_status,
       reviewed_by,
       reviewed_at,
       review_note,
       created_at,
       updated_at
     FROM voucher_groups
     WHERE id = ?${lockClause}`,
    [groupId],
  )

  return rows[0] || null
}

// 获取凭证文件的信息
async function findVoucherFileById({
  connection = pool,
  voucherId,
}) {
  const [rows] = await connection.execute(
    `SELECT
       id,
       voucher_group_id,
       voucher_type,
       original_name,
       storage_key,
       mime_type,
       file_size
     FROM vouchers
     WHERE id = ?`,
    [voucherId],
  )

  return rows[0] || null
}

// 创建上传凭证文件
async function createVoucherFile({
  connection = pool,
  voucherGroupId,
  voucherType,
  originalName,
  storageKey,
  mimeType,
  fileSize,
  sha256,
}) {
  const [result] = await connection.execute(
    `INSERT INTO vouchers
      (
        voucher_group_id,
        voucher_type,
        original_name,
        storage_key,
        mime_type,
        file_size,
        sha256
      )
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      voucherGroupId,
      voucherType,
      originalName,
      storageKey,
      mimeType,
      fileSize,
      sha256,
    ],
  )

  return {
    id: result.insertId,
    voucherGroupId,
    voucherType,
    originalName,
    storageKey,
    mimeType,
    fileSize,
    sha256,
  }
}

// 判断订单截图、支付记录是否齐全
async function getVoucherGroupCompleteness({
  connection = pool,
  groupId,
}) {
  const [rows] = await connection.execute(
    `SELECT
       SUM(voucher_type = 'order_screenshot') AS order_screenshot_count,
       SUM(voucher_type = 'payment_record') AS payment_record_count
     FROM vouchers
     WHERE voucher_group_id = ?`,
    [groupId],
  )
  const result = rows[0] || {}

  return {
    hasOrderScreenshot: Number(result.order_screenshot_count || 0) > 0,
    hasPaymentRecord: Number(result.payment_record_count || 0) > 0,
  }
}

// 更新凭证组核验状态
async function updateVoucherGroupReviewStatus({
  connection = pool,
  groupId,
  reviewStatus,
  reviewedBy = null,
  reviewedAt = null,
  reviewNote = null,
}) {
  await connection.execute(
    `UPDATE voucher_groups
        SET review_status = ?,
            reviewed_by = ?,
            reviewed_at = ?,
            review_note = ?
      WHERE id = ?`,
    [
      reviewStatus,
      reviewedBy,
      reviewedAt,
      reviewNote,
      groupId,
    ],
  )
}

// 查询发票全部凭证组及文件
async function findGroupsByInvoiceId({
  connection = pool,
  invoiceId,
}) {
  const [groups] = await connection.execute(
    `SELECT
       id,
       invoice_id,
       group_name,
       review_status,
       reviewed_by,
       reviewed_at,
       review_note,
       created_at,
       updated_at
     FROM voucher_groups
     WHERE invoice_id = ?
     ORDER BY created_at DESC, id DESC`,
    [invoiceId],
  )

  if (groups.length === 0) {
    return []
  }

  const groupIds = groups.map((group) => group.id)
  const placeholders = groupIds.map(() => '?').join(', ')
  const [files] = await connection.execute(
    `SELECT
       id,
       voucher_group_id,
       voucher_type,
       original_name,
       mime_type,
       file_size,
       created_at,
       updated_at
     FROM vouchers
     WHERE voucher_group_id IN (${placeholders})
     ORDER BY created_at ASC, id ASC`,
    groupIds,
  )
  const filesByGroupId = new Map()

  for (const file of files) {
    const groupFiles = filesByGroupId.get(file.voucher_group_id) || []
    groupFiles.push(file)
    filesByGroupId.set(file.voucher_group_id, groupFiles)
  }

  return groups.map((group) => ({
    ...group,
    files: filesByGroupId.get(group.id) || [],
  }))
}

// 查询完整且已审核通过的凭证组；创建周累计任务时可复用该凭证组。
async function findApprovedCompleteGroup({
  connection = pool,
  invoiceId,
  forUpdate = false,
}) {
  const lockClause = forUpdate ? ' FOR UPDATE' : ''
  const [rows] = await connection.execute(
    `SELECT
       vg.id,
       vg.invoice_id,
       vg.group_name,
       vg.review_status,
       vg.reviewed_by,
       vg.reviewed_at,
       vg.review_note
       FROM voucher_groups vg
      WHERE vg.invoice_id = ?
        AND vg.review_status = 'approved'
        AND EXISTS (
          SELECT 1
            FROM vouchers v1
           WHERE v1.voucher_group_id = vg.id
             AND v1.voucher_type = 'order_screenshot'
        )
        AND EXISTS (
          SELECT 1
            FROM vouchers v2
           WHERE v2.voucher_group_id = vg.id
             AND v2.voucher_type = 'payment_record'
        )
      ORDER BY vg.reviewed_at DESC, vg.id DESC
      LIMIT 1${lockClause}`,
    [invoiceId],
  )

  return rows[0] || null
}

// 判断是否存在完整且审核通过的凭证组。
async function hasApprovedCompleteGroup({
  connection = pool,
  invoiceId,
}) {
  const group = await findApprovedCompleteGroup({
    connection,
    invoiceId,
  })

  return Boolean(group)
}

// 写入凭证组操作日志
async function createVoucherOperationLog({
  connection = pool,
  operatorId,
  groupId,
  operationType,
  beforeData,
  afterData,
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
     VALUES (?, ?, 'voucher_group', ?, ?, ?)`,
    [
      operatorId,
      operationType,
      groupId,
      JSON.stringify(beforeData),
      JSON.stringify(afterData),
    ],
  )
}

// 更新发票为pending在凭证通过之后
async function updateInvoiceAfterVoucherApproval({
  connection = pool,
  invoiceId,
  qualificationReason,
}) {
  await connection.execute(
    `UPDATE invoices
        SET qualification_status = 'pending',
            qualification_reason = ?
      WHERE id = ?
        AND qualification_status = 'pending_voucher'`,
    [qualificationReason, invoiceId],
  )
}

// 更新凭证审核的日志
async function createInvoiceVoucherResolutionLog({
  connection = pool,
  operatorId,
  invoiceId,
  beforeData,
  afterData,
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
     VALUES (?, 'voucher_requirement_satisfied', 'invoice', ?, ?, ?)`,
    [
      operatorId,
      invoiceId,
      JSON.stringify(beforeData),
      JSON.stringify(afterData),
    ],
  )
}

module.exports = {
  createInvoiceVoucherResolutionLog,
  createVoucherOperationLog,
  createVoucherFile,
  createVoucherGroup,
  findApprovedCompleteGroup,
  findGroupsByInvoiceId,
  findInvoiceById,
  findVoucherFileById,
  findVoucherGroupById,
  getVoucherGroupCompleteness,
  hasApprovedCompleteGroup,
  updateInvoiceAfterVoucherApproval,
  updateVoucherGroupReviewStatus,
}
