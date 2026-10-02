-- 按销售方与提交审核时间锁定自然周发票，供整组提交财务时使用。
CREATE INDEX idx_invoices_seller_submitted_qualification
  ON invoices (seller_tax_id, submitted_at, qualification_status);
