-- 同销售方同自然周累计超过 1000 元时，保存跨发票凭证补齐任务及关联发票进度。
-- 本文件只提供迁移 SQL，不自动执行。

CREATE TABLE weekly_voucher_requirements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '周累计凭证任务主键',
  seller_tax_id VARCHAR(32) NOT NULL COMMENT '触发任务的销售方纳税人识别号',
  cumulative_week_start DATE NOT NULL COMMENT '累计所属自然周的周一日期',
  trigger_invoice_id BIGINT UNSIGNED NOT NULL COMMENT '触发本次任务的当前发票 ID',
  triggered_cumulative_amount DECIMAL(12, 2) NOT NULL COMMENT '触发时的自然周累计金额',
  status ENUM('pending', 'completed', 'cancelled') NOT NULL DEFAULT 'pending' COMMENT '任务状态：待补齐、已完成、已取消',
  completed_at DATETIME NULL COMMENT '任务完成时间',
  cancelled_at DATETIME NULL COMMENT '任务取消时间',
  active_task_key VARCHAR(80) GENERATED ALWAYS AS (
    CASE
      WHEN status = 'pending' THEN CONCAT(seller_tax_id, '#', TO_DAYS(cumulative_week_start))
      ELSE NULL
    END
  ) STORED COMMENT '进行中任务的销售方与自然周唯一键',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_weekly_voucher_requirements_active_task (active_task_key),
  KEY idx_weekly_voucher_requirements_seller_week_status (seller_tax_id, cumulative_week_start, status),
  KEY idx_weekly_voucher_requirements_trigger_invoice (trigger_invoice_id),
  CONSTRAINT fk_weekly_voucher_requirements_trigger_invoice FOREIGN KEY (trigger_invoice_id) REFERENCES invoices (id),
  CONSTRAINT chk_weekly_voucher_requirements_amount CHECK (
    triggered_cumulative_amount > 1000
    AND triggered_cumulative_amount <= 3000
  )
) ENGINE=InnoDB;

CREATE TABLE weekly_voucher_requirement_invoices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '周累计凭证任务关联发票主键',
  requirement_id BIGINT UNSIGNED NOT NULL COMMENT '所属周累计凭证任务 ID',
  invoice_id BIGINT UNSIGNED NOT NULL COMMENT '关联发票 ID',
  invoice_role ENUM('existing', 'trigger') NOT NULL COMMENT 'existing=既有累计发票，trigger=触发任务的当前发票',
  voucher_status ENUM('pending', 'approved', 'cancelled') NOT NULL DEFAULT 'pending' COMMENT '该发票在任务中的凭证完成状态',
  approved_voucher_group_id BIGINT UNSIGNED NULL COMMENT '满足本任务要求的完整且已审核通过的凭证组 ID',
  completed_at DATETIME NULL COMMENT '该发票凭证满足任务要求的时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_weekly_voucher_requirement_invoices_requirement_invoice (requirement_id, invoice_id),
  KEY idx_weekly_voucher_requirement_invoices_invoice_status (invoice_id, voucher_status),
  KEY idx_weekly_voucher_requirement_invoices_requirement_status (requirement_id, voucher_status),
  CONSTRAINT fk_weekly_voucher_requirement_invoices_requirement FOREIGN KEY (requirement_id) REFERENCES weekly_voucher_requirements (id),
  CONSTRAINT fk_weekly_voucher_requirement_invoices_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id),
  CONSTRAINT fk_weekly_voucher_requirement_invoices_approved_group FOREIGN KEY (approved_voucher_group_id) REFERENCES voucher_groups (id)
) ENGINE=InnoDB;
