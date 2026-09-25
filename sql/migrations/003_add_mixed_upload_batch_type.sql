-- 支持一次上传 PDF 与 ZIP 混合文件。
ALTER TABLE upload_batches
  MODIFY file_type ENUM('pdf', 'multiple_pdf', 'zip', 'mixed') NOT NULL;
