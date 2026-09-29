-- 材料费发票智能预审与管理平台
-- MySQL 8.0+
--
-- 文件用途：初始化数据库、核心业务表、索引和外键。
-- 数据流：上传批次/文件 -> 发票 -> 商品明细 -> 规则审核 -> 支付凭证 -> 财务/报销状态。
-- 当前版本实际使用 admin 角色，其他角色仅作为后续扩展预留。
--
-- 业务规则由 Node.js 规则引擎执行：
-- 1. 单价 < 500 元为材料；500 <= 单价 < 1000 元为低值品，必须提供支付凭证；
--    单价 >= 1000 元为资产，直接不能走材料费流程。
-- 2. 自然周按周一至周日计算，累计依据是提交审核时间、销售方税号和价税合计。
-- 3. 有效累计 <= 1000 元正常继续；>1000 且 <=3000 元进入待补凭证；>3000 元当前发票直接不通过。
-- 4. AI 原始结果不能被人工结果覆盖，人工修改应通过 operation_logs 留痕。
--
-- 说明：本文件已处理批次、凭证多文件和重复文件约束问题。

CREATE DATABASE IF NOT EXISTS invoice_pre_audit
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE invoice_pre_audit;

CREATE TABLE IF NOT EXISTS users (
  -- 管理员账号；当前页面和接口只开放 admin。
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户主键',
  username VARCHAR(64) NOT NULL COMMENT '登录用户名',
  password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希，不保存明文密码',
  role ENUM('admin', 'user', 'finance', 'reviewer') NOT NULL DEFAULT 'admin' COMMENT '用户角色，当前主要使用 admin',
  is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '账号是否启用',
  last_login_at DATETIME NULL COMMENT '最近一次登录时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_username (username)
) ENGINE=InnoDB;

-- 一次 PDF/ZIP 上传任务的批次记录。
-- 批次中的每个 PDF 仍需在 invoices 中独立建档；单个文件失败不影响同批次其他文件。
CREATE TABLE IF NOT EXISTS upload_batches (
  id CHAR(36) NOT NULL COMMENT '上传批次 UUID',
  original_name VARCHAR(255) NOT NULL COMMENT '原始上传文件名',
  file_type ENUM('pdf', 'zip', 'multiple_pdf') NOT NULL COMMENT '上传类型',
  status ENUM('pending', 'processing', 'completed', 'partial_failed', 'failed') NOT NULL DEFAULT 'pending' COMMENT '批次处理状态',
  total_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '批次内待处理 PDF 数量',
  success_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '处理成功文件数量',
  failed_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '处理失败文件数量',
  error_message TEXT NULL COMMENT '批次级错误说明',
  created_by BIGINT UNSIGNED NULL COMMENT '创建批次的用户 ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
  PRIMARY KEY (id),
  KEY idx_upload_batches_status (status),
  KEY idx_upload_batches_created_at (created_at),
  CONSTRAINT fk_upload_batches_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS category_rules (
  -- 管理员维护的长期品类规则，优先级高于 AI 自由判断。
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '品类规则主键',
  rule_name VARCHAR(128) NOT NULL COMMENT '规则名称',
  keyword VARCHAR(128) NOT NULL COMMENT '商品关键词或匹配词',
  category_result ENUM('可以', '存疑', '不可以') NOT NULL COMMENT '规则对应的品类结论',
  priority INT NOT NULL DEFAULT 100 COMMENT '规则优先级，数值越小优先级越高',
  is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '规则是否启用',
  created_by BIGINT UNSIGNED NULL COMMENT '创建规则的用户 ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
  PRIMARY KEY (id),
  KEY idx_category_rules_active_priority (is_active, priority),
  CONSTRAINT fk_category_rules_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS invoices (
  -- 每个 PDF 对应一条发票记录；ZIP 中的每个 PDF 也必须独立建档。
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '发票主键',
  invoice_number VARCHAR(64) NULL COMMENT '发票号码或数电票号码',
  invoice_date DATE NULL COMMENT '发票开票日期，仅用于保存，不参与周累计',
  seller_name VARCHAR(255) NULL COMMENT '销售方名称',
  seller_tax_id VARCHAR(32) NULL COMMENT '销售方纳税人识别号，用于同销售方累计',
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00 COMMENT '价税合计',
  -- 自然周累计只能使用提交审核时间，不能使用 invoice_date。
  submitted_at DATETIME NULL COMMENT '提交审核时间，自然周累计的时间依据',
  --资质审核的状态：
  -- pending=待审核，pending_voucher=待补凭证，pending_manual=待人工处理，
  -- approved=审核通过，rejected=审核不通过，cancelled=已取消。
  qualification_status ENUM('pending', 'pending_voucher', 'pending_manual', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending' COMMENT '资质审核状态',
  -- 财务提交状态必须与资质审核和最终报销状态分开维护。
  finance_status ENUM('not_submitted', 'submitted') NOT NULL DEFAULT 'not_submitted' COMMENT '财务提交状态',
  -- 财务最终结果：未完成、报销成功、报销失败。
  reimbursement_status ENUM('not_completed', 'success', 'failed') NOT NULL DEFAULT 'not_completed' COMMENT '最终报销状态',
  qualification_reason TEXT NULL COMMENT '资质审核结论和原因',
  cumulative_amount DECIMAL(12, 2) NULL COMMENT '本次审核计算出的有效周累计金额快照',
  cumulative_week_start DATE NULL COMMENT '累计所属自然周的周一日期',
  source_batch_id CHAR(36) NULL COMMENT '上传批次 UUID',
  ai_raw_result JSON NULL COMMENT 'AI 原始结构化结果，人工修改不得覆盖',
  manual_note TEXT NULL COMMENT '管理员人工处理说明',
  created_by BIGINT UNSIGNED NULL COMMENT '创建发票记录的用户 ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
  PRIMARY KEY (id),
  KEY idx_invoices_seller_week (seller_tax_id, cumulative_week_start),
  KEY idx_invoices_qualification_status (qualification_status),
  KEY idx_invoices_submitted_at (submitted_at),
  KEY idx_invoices_source_batch (source_batch_id),
  CONSTRAINT fk_invoices_created_by FOREIGN KEY (created_by) REFERENCES users (id),
  CONSTRAINT fk_invoices_source_batch FOREIGN KEY (source_batch_id) REFERENCES upload_batches (id) ON DELETE SET NULL,
  CONSTRAINT chk_invoices_amounts CHECK (total_amount >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS invoice_files (
  -- 发票原始文件定位表，storage_key 应通过后端接口访问。
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '文件主键',
  invoice_id BIGINT UNSIGNED NOT NULL COMMENT '所属发票 ID',
  original_name VARCHAR(255) NOT NULL COMMENT '用户上传时的原始文件名',
  storage_key VARCHAR(512) NOT NULL COMMENT '文件存储标识或相对路径',
  mime_type VARCHAR(128) NOT NULL COMMENT '文件 MIME 类型',
  file_size BIGINT UNSIGNED NOT NULL COMMENT '文件大小，单位字节',
  sha256 CHAR(64) NOT NULL COMMENT '文件 SHA-256 哈希，用于重复检测',
  extraction_status ENUM('pending', 'success', 'failed') NOT NULL DEFAULT 'pending' COMMENT '文本/OCR 提取状态',
  extraction_error TEXT NULL COMMENT '提取失败原因',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
  PRIMARY KEY (id),
  KEY idx_invoice_files_sha256 (sha256),
  KEY idx_invoice_files_invoice (invoice_id),
  CONSTRAINT fk_invoice_files_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS invoice_items (
  -- 发票商品明细；规则引擎必须逐项判断品类和单价。
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '商品明细主键',
  invoice_id BIGINT UNSIGNED NOT NULL COMMENT '所属发票 ID',
  item_name VARCHAR(255) NOT NULL COMMENT '商品名称',
  quantity DECIMAL(12, 4) NULL COMMENT '商品数量',
  unit_price DECIMAL(12, 2) NOT NULL COMMENT '商品含税单价，用于资产/低值品判断',
  price_type ENUM('material', 'low_value', 'asset') NULL COMMENT '单价分类：材料、低值品、资产',
  line_amount DECIMAL(12, 2) NOT NULL COMMENT '商品明细金额',
  -- AI 的原始品类判断，不允许被人工结果覆盖。
  ai_category_result ENUM('可以', '存疑', '不可以') NULL COMMENT 'AI 原始品类判断',
  ai_category_reason TEXT NULL COMMENT 'AI 或长期品类规则的原始判断依据',
  -- 管理员人工修正结果。
  manual_category_result ENUM('可以', '存疑', '不可以') NULL COMMENT '管理员人工品类判断',
  manual_category_reason TEXT NULL COMMENT '管理员人工品类判断依据',
  -- 规则引擎和人工审核后的最终品类结果。
  final_category_result ENUM('可以', '存疑', '不可以') NULL COMMENT '最终品类审核结果',
  category_reason TEXT NULL COMMENT '品类判断依据或人工说明',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
  PRIMARY KEY (id),
  KEY idx_invoice_items_invoice (invoice_id),
  CONSTRAINT fk_invoice_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE,
  CONSTRAINT chk_invoice_items_price CHECK (unit_price >= 0 AND line_amount >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS voucher_groups (
  -- 一张发票可关联多个凭证组；每组必须同时具备订单截图和支付记录。
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '凭证组主键',
  invoice_id BIGINT UNSIGNED NOT NULL COMMENT '所属发票 ID',
  group_name VARCHAR(128) NULL COMMENT '凭证组名称或说明',
  -- pending_upload=待上传，pending_review=待人工审核，approved=审核通过，rejected=审核不通过。
  review_status ENUM('pending_upload', 'pending_review', 'approved', 'rejected') NOT NULL DEFAULT 'pending_upload' COMMENT '凭证审核状态',
  reviewed_by BIGINT UNSIGNED NULL COMMENT '审核管理员 ID',
  reviewed_at DATETIME NULL COMMENT '审核时间',
  review_note TEXT NULL COMMENT '凭证审核意见',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
  PRIMARY KEY (id),
  KEY idx_voucher_groups_invoice (invoice_id),
  CONSTRAINT fk_voucher_groups_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE,
  CONSTRAINT fk_voucher_groups_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vouchers (
  -- 凭证文件表；需求允许一个凭证组包含多张同类型文件。
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '凭证文件主键',
  voucher_group_id BIGINT UNSIGNED NOT NULL COMMENT '所属凭证组 ID',
  voucher_type ENUM('order_screenshot', 'payment_record') NOT NULL COMMENT '凭证类型：订单截图或支付记录',
  original_name VARCHAR(255) NOT NULL COMMENT '原始文件名',
  storage_key VARCHAR(512) NOT NULL COMMENT '文件存储标识或相对路径',
  mime_type VARCHAR(128) NOT NULL COMMENT '文件 MIME 类型',
  file_size BIGINT UNSIGNED NOT NULL COMMENT '文件大小，单位字节',
  sha256 CHAR(64) NOT NULL COMMENT '文件 SHA-256 哈希',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
  PRIMARY KEY (id),
  KEY idx_vouchers_group_type (voucher_group_id, voucher_type),
  KEY idx_vouchers_sha256 (sha256),
  CONSTRAINT fk_vouchers_group FOREIGN KEY (voucher_group_id) REFERENCES voucher_groups (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS operation_logs (
  -- 人工修改、审核、状态变更和规则维护的审计日志。
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '操作日志主键',
  operator_id BIGINT UNSIGNED NULL COMMENT '操作用户 ID',
  operation_type VARCHAR(64) NOT NULL COMMENT '操作类型，如创建、修改、审核、状态变更',
  resource_type VARCHAR(64) NOT NULL COMMENT '资源类型，如 invoice、voucher_group',
  resource_id BIGINT UNSIGNED NULL COMMENT '被操作资源 ID',
  before_data JSON NULL COMMENT '修改前数据快照',
  after_data JSON NULL COMMENT '修改后数据快照',
  ip_address VARCHAR(45) NULL COMMENT '操作来源 IP 地址',
  user_agent VARCHAR(512) NULL COMMENT '操作来源客户端信息',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '日志创建时间',
  PRIMARY KEY (id),
  KEY idx_operation_logs_resource (resource_type, resource_id),
  KEY idx_operation_logs_operator (operator_id),
  KEY idx_operation_logs_created_at (created_at),
  CONSTRAINT fk_operation_logs_operator FOREIGN KEY (operator_id) REFERENCES users (id)
) ENGINE=InnoDB;
