<script setup lang="ts">
import { useRouter } from 'vue-router'
import {
  getFinanceStatusLabel,
  getQualificationStatusLabel,
  getReimbursementStatusLabel,
} from '../../utils/status'

const router = useRouter()

const invoice = {
  id: 1,
  invoiceNumber: '031002100111',
  invoiceDate: '2026-09-26',
  sellerName: '上海示例材料有限公司',
  sellerTaxId: '91310000MA1K12345X',
  totalAmount: 860,
  originalName: '1pass.pdf',
  batchId: '3f0108c5-9cea-4548-8182-0984948c85a5',
  createdAt: '2026-09-26 14:32:08',
  qualificationStatus: 'pending_manual',
  financeStatus: 'not_submitted',
  reimbursementStatus: 'not_completed',
  qualificationReason: '商品品类存在存疑项目，需要管理员人工确认。',
}

const items = [
  {
    id: 1,
    name: '建筑用钢材',
    quantity: 2,
    unitPrice: 430,
    amount: 860,
    priceType: 'material',
    categoryResult: '存疑',
    reason: '商品名称与长期品类规则未完全匹配。',
  },
]
const firstItem = items[0]

function goBack() {
  router.push({ name: 'invoice-list' })
}

function formatAmount(amount: number) {
  return `¥${amount.toFixed(2)}`
}
</script>

<template>
  <section class="detail-page">
    <div class="page-heading">
      <div><el-button link type="primary" @click="goBack">← 返回发票列表</el-button><p class="eyebrow">INVOICE DETAIL</p><h1>发票详情</h1><p class="subtitle">查看发票识别信息、商品预审结果和处理状态。</p></div>
      <div class="heading-actions"><el-button>下载发票</el-button><el-button type="primary">预览 PDF</el-button></div>
    </div>

    <div class="status-strip"><div><span>资质审核</span><el-tag type="warning">{{ getQualificationStatusLabel(invoice.qualificationStatus) }}</el-tag></div><div><span>财务提交</span><el-tag effect="plain">{{ getFinanceStatusLabel(invoice.financeStatus) }}</el-tag></div><div><span>最终报销</span><el-tag effect="plain">{{ getReimbursementStatusLabel(invoice.reimbursementStatus) }}</el-tag></div></div>

    <div class="detail-grid">
      <div class="main-column">
        <el-card shadow="never" class="detail-card"><div class="card-title"><h2>发票基础信息</h2><el-tag type="success" effect="plain">识别成功</el-tag></div><div class="info-grid"><div><span>发票号码</span><strong>{{ invoice.invoiceNumber }}</strong></div><div><span>开票日期</span><strong>{{ invoice.invoiceDate }}</strong></div><div><span>销售方名称</span><strong>{{ invoice.sellerName }}</strong></div><div><span>销售方税号</span><strong>{{ invoice.sellerTaxId }}</strong></div><div><span>价税合计</span><strong class="amount">{{ formatAmount(invoice.totalAmount) }}</strong></div><div><span>原始文件</span><strong>{{ invoice.originalName }}</strong></div><div><span>上传批次</span><strong class="muted-value">{{ invoice.batchId }}</strong></div><div><span>上传时间</span><strong>{{ invoice.createdAt }}</strong></div></div></el-card>

        <el-card shadow="never" class="detail-card"><div class="card-title"><h2>商品明细</h2><span class="card-caption">{{ items.length }} 个商品</span></div><el-table :data="items" stripe><el-table-column prop="name" label="商品名称" min-width="170" /><el-table-column prop="quantity" label="数量" width="80" /><el-table-column label="含税单价" width="120"><template #default="{ row }">{{ formatAmount(row.unitPrice) }}</template></el-table-column><el-table-column label="明细金额" width="120"><template #default="{ row }">{{ formatAmount(row.amount) }}</template></el-table-column><el-table-column label="单价分类" width="110"><template #default="{ row }"><el-tag effect="plain">{{ row.priceType === 'material' ? '材料' : row.priceType === 'low_value' ? '低值品' : '资产' }}</el-tag></template></el-table-column><el-table-column label="品类结果" width="100"><template #default="{ row }"><el-tag type="warning" effect="plain">{{ row.categoryResult }}</el-tag></template></el-table-column></el-table><div class="reason-row"><span>判断依据</span><p>{{ firstItem?.reason || '暂无判断依据' }}</p></div></el-card>

        <el-card shadow="never" class="detail-card"><div class="card-title"><h2>预审结果</h2><el-tag type="warning">待人工处理</el-tag></div><div class="review-result"><div><span>品类判断</span><strong>存疑</strong></div><div><span>单价判断</span><strong class="success-text">材料</strong></div><div><span>自然周累计</span><strong>{{ formatAmount(860) }}</strong></div><div><span>累计所属周</span><strong>2026-09-21 至 2026-09-27</strong></div></div><el-alert title="商品品类存在存疑项目，需要管理员人工确认。" type="warning" :closable="false" show-icon /></el-card>
      </div>

      <aside class="side-column"><el-card shadow="never" class="preview-card"><div class="card-title"><h2>原始发票</h2><el-button link type="primary">放大预览</el-button></div><div class="pdf-placeholder"><div class="pdf-icon">PDF</div><strong>{{ invoice.originalName }}</strong><span>点击预览查看原始发票</span><el-button type="primary" plain>预览文件</el-button></div></el-card><el-card shadow="never" class="detail-card"><div class="card-title"><h2>管理员操作</h2></div><el-button type="primary" class="full-button">审核通过</el-button><el-button class="full-button">标记待补凭证</el-button><el-button type="danger" plain class="full-button">审核不通过</el-button><el-input class="note-input" type="textarea" :rows="3" placeholder="填写人工处理备注" /><el-button class="full-button">保存备注</el-button></el-card><el-card shadow="never" class="detail-card"><div class="card-title"><h2>处理记录</h2></div><el-timeline><el-timeline-item timestamp="2026-09-26 14:32" type="primary">文件上传并完成识别</el-timeline-item><el-timeline-item timestamp="2026-09-26 14:33">规则引擎完成初步预审</el-timeline-item><el-timeline-item timestamp="等待处理">等待管理员审核</el-timeline-item></el-timeline></el-card></aside>
    </div>
  </section>
</template>

<style scoped>
.detail-page {
  max-width: 1240px;
  margin: 0 auto;
  padding-bottom: 40px;
  color: #0f172a;
}

.page-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 22px;
}

.eyebrow {
  margin: 16px 0 6px;
  color: #2563eb;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .14em;
}

.page-heading h1 {
  margin: 0;
  font-size: 28px;
}

.subtitle {
  margin: 8px 0 0;
  color: #64748b;
  font-size: 14px;
}

.heading-actions {
  display: flex;
  gap: 10px;
}

.heading-actions .el-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.heading-actions :deep(.el-button > span) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  text-align: center;
}

.status-strip {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  margin-bottom: 20px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #e2e8f0;
  overflow: hidden;
}

.status-strip > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: #fff;
}

.status-strip span {
  color: #64748b;
  font-size: 13px;
}

.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(300px, .8fr);
  gap: 20px;
}

.main-column,
.side-column {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-card,
.preview-card {
  border: 1px solid #e2e8f0;
  border-radius: 14px;
}

.card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.card-title h2 {
  margin: 0;
  font-size: 17px;
}

.card-caption {
  color: #94a3b8;
  font-size: 12px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18px 24px;
}

.info-grid div {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-grid span,
.review-result span {
  color: #94a3b8;
  font-size: 12px;
}

.info-grid strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}

.amount {
  color: #2563eb;
  font-size: 18px !important;
}

.muted-value {
  color: #64748b;
  font-size: 12px !important;
}

.reason-row {
  display: flex;
  gap: 16px;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid #f1f5f9;
  color: #64748b;
  font-size: 12px;
}

.reason-row p {
  margin: 0;
  color: #475569;
}

.review-result {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 18px;
}

.review-result div {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.review-result strong {
  font-size: 15px;
}

.success-text {
  color: #16a34a;
}

.pdf-placeholder {
  min-height: 350px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 1px dashed #bfdbfe;
  border-radius: 10px;
  background: #f8fbff;
  color: #64748b;
  text-align: center;
}

.pdf-icon {
  width: 58px;
  height: 68px;
  border-radius: 8px;
  background: #fee2e2;
  color: #dc2626;
  font-size: 14px;
  font-weight: 700;
  line-height: 68px;
}

.pdf-placeholder strong {
  color: #334155;
}

.pdf-placeholder span {
  font-size: 12px;
}

.full-button {
  width: 100%;
  margin: 0 0 10px;
}

.note-input {
  margin: 5px 0 10px;
}

.side-column :deep(.el-timeline) {
  padding-left: 4px;
}

@media (max-width: 900px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }

  .preview-card {
    order: -1;
  }
}

@media (max-width: 600px) {
  .page-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .heading-actions,
  .heading-actions .el-button {
    width: 100%;
  }

  .status-strip {
    grid-template-columns: 1fr;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
