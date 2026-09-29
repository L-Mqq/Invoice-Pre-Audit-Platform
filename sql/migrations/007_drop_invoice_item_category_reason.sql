-- 自动判断依据统一存储于 ai_category_reason，人工判断依据统一存储于 manual_category_reason。
ALTER TABLE invoice_items
  DROP COLUMN category_reason;
