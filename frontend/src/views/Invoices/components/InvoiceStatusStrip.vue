<script setup lang="ts">
import type { InvoiceDetail } from '../../../apis/invoices'
import type { WeeklyVoucherRequirement } from '../../../apis/voucher'
import {
  getFinanceStatusLabel,
  getQualificationStatusLabel,
  getReimbursementStatusLabel,
} from '../../../utils/status'

defineProps<{
  invoice: InvoiceDetail
  weeklyVoucherRequirement: WeeklyVoucherRequirement | null
}>()

function getReviewStatusLabel(invoice: InvoiceDetail): string {
  if (invoice.qualificationStatus === 'pending' && !invoice.submittedAt) {
    return '待提交审核'
  }

  return getQualificationStatusLabel(invoice.qualificationStatus)
}
</script>

<template>
  <div
    class="status-strip"
    :class="{
      'has-weekly-voucher-requirement': weeklyVoucherRequirement,
    }"
  >
    <div>
      <span>资质审核</span>
      <el-tag type="warning">
        {{ getReviewStatusLabel(invoice) }}
      </el-tag>
    </div>
    <div>
      <span>财务提交</span>
      <el-tag effect="plain">
        {{ getFinanceStatusLabel(invoice.financeStatus) }}
      </el-tag>
    </div>
    <div>
      <span>最终报销</span>
      <el-tag effect="plain">
        {{ getReimbursementStatusLabel(invoice.reimbursementStatus) }}
      </el-tag>
    </div>
    <div v-if="weeklyVoucherRequirement">
      <span>周累计凭证</span>
      <el-tag
        type="warning"
        effect="plain"
      >
        待补齐 {{ weeklyVoucherRequirement.approvedInvoiceCount }}/{{ weeklyVoucherRequirement.totalInvoiceCount }}
      </el-tag>
    </div>
  </div>
</template>

<style scoped>
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

.status-strip.has-weekly-voucher-requirement {
  grid-template-columns: repeat(4, 1fr);
}

@media (max-width: 720px) {
  .status-strip {
    grid-template-columns: 1fr;
  }
}
</style>
