-- 保留既有 category_reason，并新增自动与人工品类判断依据字段。
-- 本文件只提供迁移 SQL，不自动执行。

ALTER TABLE invoice_items
  ADD COLUMN ai_category_reason TEXT NULL
  COMMENT 'AI 或长期品类规则的原始判断依据'
  AFTER ai_category_result;

ALTER TABLE invoice_items
  ADD COLUMN manual_category_reason TEXT NULL
  COMMENT '管理员人工品类判断依据'
  AFTER manual_category_result;
