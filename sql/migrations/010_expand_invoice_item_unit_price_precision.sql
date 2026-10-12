-- 保留电子发票中的高精度含税单价，避免入库时按两位小数截断。
-- 明细金额、税额和价税合计仍按货币金额保留两位小数。
ALTER TABLE invoice_items
  MODIFY COLUMN unit_price DECIMAL(24, 13) NOT NULL
  COMMENT '商品含税单价，保留发票原始精度，用于资产/低值品判断';
