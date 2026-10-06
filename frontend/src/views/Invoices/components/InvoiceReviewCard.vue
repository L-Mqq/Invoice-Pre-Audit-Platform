<script setup lang="ts">
import type {
  InvoiceDetail,
  InvoiceDuplicateCandidate,
} from '../../../apis/invoices'
import type { WeeklyVoucherRequirement } from '../../../apis/voucher'
import { formatChinaDate } from '../../../utils/date'
import { getQualificationStatusLabel } from '../../../utils/status'

const props = defineProps<{
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
  weeklyVoucherRequirement: WeeklyVoucherRequirement | null
  primaryVoucherActionLabel: string | null
  canViewVouchers: boolean
  voucherGroupsLoading: boolean
  voucherGroupsError: string
  isSuspectedDuplicate: boolean
  duplicateInvoiceId: number | null
  duplicateCandidate: InvoiceDuplicateCandidate | null
  duplicateReviewSubmitting: boolean
}>()

const emit = defineEmits<{
  manualComplete: []
  confirmCategory: []
  submitReview: []
  enterReview: []
  submitVoucher: []
  viewVoucher: []
  reviewDuplicate: []
  viewDuplicateCandidate: []
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
  if (props.isSuspectedDuplicate) {
    return '疑似重复'
  }

  if (invoice.qualificationStatus === 'pending' && !invoice.submittedAt) {
    return '待提交审核'
  }

  return getQualificationStatusLabel(invoice.qualificationStatus)
}

function getQualificationReason(invoice: InvoiceDetail): string {
  if (props.isSuspectedDuplicate) {
    const candidate = props.duplicateCandidate
    const candidateId = candidate?.id || props.duplicateInvoiceId || '未知'
    const invoiceNumber = candidate?.invoiceNumber || '未识别'

    return `系统发现该发票与发票「${invoiceNumber}」（记录 #${candidateId}）的销售方税号和发票号码一致，请人工确认。`
  }

  const dataIssueMessages = invoice.dataIssues
    .map((issue) => {
      return issue.message.trim()
    })
    .filter((message) => {
      return message.length > 0
    })

  if (dataIssueMessages.length === 1) {
    return `资料待补全：${dataIssueMessages[0]}`
  }

  if (dataIssueMessages.length > 1) {
    return `资料待补全：共 ${dataIssueMessages.length} 项资料需要补全`
  }

  return invoice.qualificationReason || '暂无预审结论'
}

function isInvoiceNumberMissing(invoice: InvoiceDetail): boolean {
  return invoice.dataIssues.some((issue) => {
    return issue.scope === 'invoice'
      && issue.field === 'invoiceNumber'
  })
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

function getWeeklyVoucherRequirementDescription(
  requirement: WeeklyVoucherRequirement,
): string {
  const currentInvoiceDescription = requirement.currentInvoice.voucherStatus === 'pending'
    ? '当前发票仍需补齐支付凭证。'
    : '当前发票凭证已完成，正在等待其余关联发票完成。'

  return `同一销售方本自然周累计 ¥${Number(requirement.triggeredCumulativeAmount).toFixed(2)}，关联发票凭证已完成 ${requirement.approvedInvoiceCount}/${requirement.totalInvoiceCount}。${currentInvoiceDescription}`
}
</script>

<template>
  <el-card
    shadow="never"
    class="detail-card"
  >
    <div class="card-title">
      <h2>预审结果</h2>
      <div class="review-status-tags">
        <el-tag :type="getReviewStatusType(invoice)">
          {{ getReviewStatusLabel(invoice) }}
        </el-tag>
        <el-tag
          v-if="weeklyVoucherRequirement"
          type="warning"
          effect="plain"
        >
          周累计凭证待补齐
        </el-tag>
      </div>
    </div>

    <div class="review-result">
      <div>
        <span>预审原因</span>
        <strong>{{ getQualificationReason(invoice) }}</strong>
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

    <el-alert
      v-if="weeklyVoucherRequirement"
      class="weekly-voucher-requirement"
      title="周累计凭证任务未完成"
      :description="getWeeklyVoucherRequirementDescription(weeklyVoucherRequirement)"
      type="warning"
      :closable="false"
      show-icon
    />

    <el-alert
      v-if="invoice.canManualCompleteData"
      class="manual-data-alert"
      title="资料待补全"
      type="warning"
      :closable="false"
      show-icon
    >
      <template #default>
        <ul class="data-issue-list">
          <li
            v-for="issue in invoice.dataIssues"
            :key="`${issue.scope}-${issue.itemId || issue.itemIndex}-${issue.field}-${issue.code}`"
          >
            {{ issue.message }}
          </li>
        </ul>
      </template>
    </el-alert>

    <div
      v-if="showVoucherSection && !isSuspectedDuplicate"
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
      <div v-if="isSuspectedDuplicate">
        <strong>疑似重复发票</strong>
        <span>
          系统发现该发票与发票「{{ duplicateCandidate?.invoiceNumber || '未识别' }}」
          （记录 #{{ duplicateCandidate?.id || duplicateInvoiceId || '未知' }}）的销售方税号和发票号码一致，请人工确认。
        </span>
      </div>
      <div v-else-if="invoice.canManualCompleteData">
        <strong>资料待补全</strong>
        <span v-if="isInvoiceNumberMissing(invoice)">
          发票号码未识别，无法完成重复检测，请先补全资料。
        </span>
        <span v-else>
          请先补全发票基础信息或商品明细，再继续审核流程。
        </span>
      </div>
      <div v-else-if="invoice.canConfirmCategory">
        <strong>待完成商品确认</strong>
        <span>存在存疑或未确认商品，请查看判断依据后逐项人工确认。</span>
      </div>
      <div v-else-if="canSubmitReview">
        <strong>提交审核</strong>
        <span>确认商品品类结果后，提交整张发票进入审核队列。</span>
      </div>
      <div v-else-if="canEnterInvoiceReview">
        <strong>发票处理</strong>
        <span v-if="invoice.qualificationStatus === 'pending_manual'">
          当前发票待资料修复，暂不能再次执行规则审核；如不再处理可放弃发票。
        </span>
        <span v-else-if="invoice.qualificationStatus === 'pending_voucher'">
          请先完成支付凭证审核；如不再处理可放弃发票。
        </span>
        <span v-else-if="invoice.qualificationStatus === 'rejected'">
          当前发票未通过规则审核；如不再处理可放弃发票。
        </span>
        <span v-else>
          可执行规则审核，或放弃当前发票。
        </span>
      </div>
      <div v-else-if="isCategoryEditable">
        <strong>待完成商品确认</strong>
        <span>请先处理所有“存疑”或未判断的商品品类。</span>
      </div>
      <div v-else>
        <strong>当前无可用审核操作</strong>
        <span>请根据当前发票状态继续处理。</span>
      </div>
      <div
        v-if="isSuspectedDuplicate"
        class="duplicate-action-buttons"
      >
        <el-button
          :disabled="!duplicateCandidate"
          @click="emit('viewDuplicateCandidate')"
        >
          查看关联发票
        </el-button>
        <el-button
          type="warning"
          :loading="duplicateReviewSubmitting"
          @click="emit('reviewDuplicate')"
        >
          判定重复发票
        </el-button>
      </div>
      <el-button
        v-else-if="invoice.canManualCompleteData"
        type="primary"
        @click="emit('manualComplete')"
      >
        补全资料
      </el-button>
      <el-button
        v-else-if="invoice.canConfirmCategory"
        type="primary"
        @click="emit('confirmCategory')"
      >
        人工确认品类
      </el-button>
      <el-button
        v-else-if="canSubmitReview"
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
        处理发票
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

.review-status-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
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

.duplicate-action-buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
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

.weekly-voucher-requirement {
  margin-top: 16px;
}

.manual-data-alert {
  margin-top: 16px;
}

.data-issue-list {
  margin: 8px 0 0;
  padding-left: 18px;
}

.data-issue-list li {
  margin: 4px 0;
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
