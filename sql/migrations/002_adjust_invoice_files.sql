-- 让文件记录可以先归属于上传批次，解析成功后再关联 invoices。
-- 适用于已经执行过 sql/schema.sql 的数据库。

ALTER TABLE invoice_files
  ADD COLUMN batch_id CHAR(36) NULL COMMENT '所属上传批次 UUID' AFTER id,
  MODIFY COLUMN invoice_id BIGINT UNSIGNED NULL COMMENT '解析成功后关联的发票 ID，解析失败时为空';

ALTER TABLE invoice_files
  ADD KEY idx_invoice_files_batch (batch_id),
  ADD CONSTRAINT fk_invoice_files_batch
    FOREIGN KEY (batch_id) REFERENCES upload_batches (id) ON DELETE CASCADE;
