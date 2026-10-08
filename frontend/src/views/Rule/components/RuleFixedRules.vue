<template>
  <el-card
    class="fixed-rule-card"
    shadow="never"
  >
    <div class="fixed-rule-heading">
      <div>
        <strong>固定审核规则</strong>
        <span>由系统规则引擎执行，当前不可在此页修改</span>
      </div>
      <el-button link>
        查看规则说明
      </el-button>
    </div>
    <div class="fixed-rule-grid">
      <div>
        <span>商品单价</span>
        <p>小于 500 元为材料；500 至小于 1000 元需支付凭证；1000 元及以上为资产。</p>
      </div>
      <div>
        <span>自然周累计</span>
        <p>不超过 1000 元正常继续；超过 1000 元至 3000 元待补凭证；超过 3000 元不通过。</p>
      </div>
      <div>
        <span>支付凭证</span>
        <p>每个凭证组必须同时包含订单截图和支付记录，并由管理员人工核验。</p>
      </div>
    </div>
  </el-card>
</template>

<style scoped>
.fixed-rule-card {
  margin-bottom: 20px;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
}

.fixed-rule-heading,
.fixed-rule-heading > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.fixed-rule-heading {
  margin-bottom: 18px;
}

.fixed-rule-heading strong {
  margin-right: 10px;
}

.fixed-rule-heading span {
  color: #94a3b8;
  font-size: 12px;
}

.fixed-rule-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.fixed-rule-grid > div {
  padding: 14px;
  border-radius: 10px;
  background: #f8fafc;
}

.fixed-rule-grid span {
  color: #334155;
  font-size: 13px;
  font-weight: 700;
}

.fixed-rule-grid p {
  margin: 8px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.65;
}

@media (max-width: 1000px) {
  .fixed-rule-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .fixed-rule-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .fixed-rule-grid {
    grid-template-columns: 1fr;
  }
}
</style>
