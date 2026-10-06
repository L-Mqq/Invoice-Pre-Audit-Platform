<script setup lang="ts">
import type {
  InvoiceDetail,
  InvoiceDetailFile,
} from '../../../apis/invoices'
import {
  formatChinaDate,
  formatChinaDateTime,
} from '../../../utils/date'
import {
  getExtractionStatusLabel,
  getExtractionStatusType,
} from '../../../utils/status'

defineProps<{
  invoice: InvoiceDetail
  selectedFile: InvoiceDetailFile | null
}>()

function formatAmount(amount: number | string | null): string {
  return `¥${Number(amount || 0).toFixed(2)}`
}

</script>

<template>
  <el-card
    shadow="never"
    class="detail-card"
  >
    <div class="card-title">
      <h2>发票基础信息</h2>
      <el-tag
        :type="selectedFile ? getExtractionStatusType(selectedFile.extractionStatus) : 'info'"
        effect="plain"
      >
        文件处理：{{ selectedFile ? getExtractionStatusLabel(selectedFile.extractionStatus) : '无关联文件' }}
      </el-tag>
    </div>

    <div class="info-grid">
      <div>
        <span>发票号码</span>
        <strong>{{ invoice.invoiceNumber || '未识别' }}</strong>
      </div>
      <div>
        <span>开票日期</span>
        <strong>{{ formatChinaDate(invoice.invoiceDate) || '未识别' }}</strong>
      </div>
      <div>
        <span>销售方名称</span>
        <strong>{{ invoice.sellerName || '未识别' }}</strong>
      </div>
      <div>
        <span>销售方税号</span>
        <strong>{{ invoice.sellerTaxId || '未识别' }}</strong>
      </div>
      <div>
        <span>价税合计</span>
        <strong class="amount">{{ formatAmount(invoice.totalAmount) }}</strong>
      </div>
      <div>
        <span>上传批次</span>
        <strong class="muted-value">{{ invoice.sourceBatchId || '无' }}</strong>
      </div>
      <div>
        <span>上传时间</span>
        <strong>{{ formatChinaDateTime(invoice.createdAt) || '未识别' }}</strong>
      </div>
      <div>
        <span>提交审核时间</span>
        <strong>{{ formatChinaDateTime(invoice.submittedAt) || '尚未提交' }}</strong>
      </div>
    </div>
  </el-card>
</template>

<style scoped>
.detail-card {
  border: 1px solid #e2e8f0;
  border-radius: 14px;
}

.card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.card-title h2 {
  margin: 0;
  font-size: 17px;
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

.info-grid span {
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

@media (max-width: 520px) {
  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
