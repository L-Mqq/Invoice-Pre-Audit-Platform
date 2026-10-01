<script setup lang="ts">
import type { InvoiceDetail } from '../../../apis/invoices'
import { formatChinaDate } from '../../../utils/date'
import { getQualificationStatusLabel } from '../../../utils/status'

defineProps<{
  invoice: InvoiceDetail
  canSubmitReview: boolean
  canEnterInvoiceReview: boolean
  isCategoryEditable: boolean
  submitReviewLoading: boolean
  isVoucherRequired: boolean
  showVoucherSection: boolean
  voucherStatusLabel: string
  voucherStatusDescription: string
  voucherStatusType: 'success' | 'warning' | 'danger' | 'info'
  primaryVoucherActionLabel: string | null
  canViewVouchers: boolean
  voucherGroupsLoading: boolean
  voucherGroupsError: string
}>()

const emit = defineEmits<{
  submitReview: []
  enterReview: []
  submitVoucher: []
  viewVoucher: []
}>()

function formatAmount(amount: number | string | null): string {
  return `¥${Number(amount || 0).toFixed(2)}`
}

function hasCumulativeResult(invoice: InvoiceDetail): boolean {
  return invoice.cumulativeAmount !== null
    && Boolean(invoice.cumulativeWeekStart)
}

function getCumulativeAmountDisplay(invoice: InvoiceDetail): string {
  if (hasCumulativeResult(invoice)) {
    return formatAmount(invoice.cumulativeAmount)
  }

  if (!invoice.submittedAt || invoice.qualificationStatus === 'pending') {
    return '尚未完成规则审核'
  }

  return '不适用'
}

function getCumulativeWeekDisplay(invoice: InvoiceDetail): string {
  if (hasCumulativeResult(invoice)) {
    return formatChinaDate(invoice.cumulativeWeekStart)
  }

  if (!invoice.submittedAt || invoice.qualificationStatus === 'pending') {
    return '尚未完成规则审核'
  }

  return '不适用'
}

function getReviewStatusLabel(invoice: InvoiceDetail): string {
  if (invoice.qualificationStatus === 'pending' && !invoice.submittedAt) {
    return '待提交审核'
  }

  return getQualificationStatusLabel(invoice.qualificationStatus)
}

// 品类的样式
function getReviewStatusType(
  invoice: InvoiceDetail,
): 'success' | 'warning' | 'danger' | 'info' {
  if (invoice.qualificationStatus === 'approved') {
    return 'success'
  }

  if (invoice.qualificationStatus === 'rejected') {
    return 'danger'
  }

  if (
    invoice.qualificationStatus === 'pending_manual'
    || invoice.qualificationStatus === 'pending_voucher'
  ) {
    return 'warning'
  }

  return 'info'
}
</script>

<template>
  <el-card
    shadow="never"
    class="detail-card"
  >
    <div class="card-title">
      <h2>预审结果</h2>
      <el-tag :type="getReviewStatusType(invoice)">
        {{ getReviewStatusLabel(invoice) }}
      </el-tag>
    </div>

    <div class="review-result">
      <div>
        <span>预审原因</span>
        <strong>{{ invoice.qualificationReason || '暂无预审结论' }}</strong>
      </div>
      <div>
        <span>自然周累计</span>
        <strong>{{ getCumulativeAmountDisplay(invoice) }}</strong>
      </div>
      <div>
        <span>累计所属周</span>
        <strong>{{ getCumulativeWeekDisplay(invoice) }}</strong>
      </div>
      <div>
        <span>人工处理备注</span>
        <strong>{{ invoice.manualNote || '暂无备注' }}</strong>
      </div>
    </div>

    <div
      v-if="showVoucherSection"
      class="voucher-actions"
    >
      <div class="voucher-status">
        <span>凭证状态</span>
        <el-tag
          :type="voucherStatusType"
          effect="plain"
        >
          {{ voucherStatusLabel }}
        </el-tag>
        <small>{{ voucherStatusDescription }}</small>
      </div>

      <el-alert
        v-if="voucherGroupsError"
        class="voucher-load-error"
        :title="voucherGroupsError"
        type="error"
        :closable="false"
        show-icon
      />

      <div class="voucher-action-buttons">
        <el-button
          v-if="isVoucherRequired && primaryVoucherActionLabel"
          type="primary"
          :loading="voucherGroupsLoading"
          :disabled="Boolean(voucherGroupsError)"
          @click="emit('submitVoucher')"
        >
          {{ primaryVoucherActionLabel }}
        </el-button>
        <el-button
          v-if="canViewVouchers"
          :disabled="voucherGroupsLoading || Boolean(voucherGroupsError)"
          @click="emit('viewVoucher')"
        >
          查看凭证
        </el-button>
      </div>
    </div>

    <div class="review-actions">
      <div v-if="canSubmitReview">
        <strong>提交审核</strong>
        <span>确认商品品类结果后，提交整张发票进入审核队列。</span>
      </div>
      <div v-else-if="canEnterInvoiceReview">
        <strong>管理员审核</strong>
        <span>确认整张发票的处理结论。</span>
      </div>
      <div v-else-if="isCategoryEditable">
        <strong>待完成商品确认</strong>
        <span>请先处理所有“存疑”或未判断的商品品类。</span>
      </div>
      <div v-else>
        <strong>当前无可用审核操作</strong>
        <span>请根据当前发票状态继续处理。</span>
      </div>
      <el-button
        v-if="canSubmitReview"
        type="primary"
        :loading="submitReviewLoading"
        @click="emit('submitReview')"
      >
        提交审核
      </el-button>
      <el-button
        v-else-if="canEnterInvoiceReview"
        type="primary"
        @click="emit('enterReview')"
      >
        进入审核
      </el-button>
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

.review-result {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.review-result div,
.review-actions > div {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.review-result span,
.review-actions span {
  color: #94a3b8;
  font-size: 12px;
}

.review-result strong,
.review-actions strong {
  color: #334155;
  font-size: 14px;
}

.review-result strong {
  line-height: 1.6;
}

.review-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #f1f5f9;
}

.review-actions > div {
  gap: 4px;
}

.voucher-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 20px;
  padding: 16px;
  border: 1px solid #fde68a;
  border-radius: 10px;
  background: #fffbeb;
}

.voucher-status {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.voucher-status span,
.voucher-status small {
  color: #a16207;
  font-size: 12px;
}

.voucher-status strong {
  color: #854d0e;
  font-size: 14px;
}

.voucher-action-buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.voucher-load-error {
  width: 100%;
}

@media (max-width: 600px) {
  .review-result {
    grid-template-columns: 1fr;
  }

  .review-actions {
    align-items: flex-start;
    flex-direction: column;
  }

  .voucher-actions {
    align-items: flex-start;
    flex-direction: column;
  }

  .voucher-action-buttons {
    justify-content: flex-start;
  }
}
</style>
