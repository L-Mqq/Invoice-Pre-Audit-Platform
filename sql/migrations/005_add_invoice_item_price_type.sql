-- 为商品明细增加单价分类字段。
-- material：单价 < 500；low_value：500 <= 单价 < 1000；asset：单价 >= 1000。
-- 本文件只提供迁移 SQL，不自动执行。

ALTER TABLE invoice_items
  ADD COLUMN price_type ENUM('material', 'low_value', 'asset') NULL
  COMMENT '单价分类：材料、低值品、资产'
  AFTER unit_price;
