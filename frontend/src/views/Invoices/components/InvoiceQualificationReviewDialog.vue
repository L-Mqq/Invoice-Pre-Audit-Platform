<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from 'vue'
import { ElMessage } from 'element-plus'
import type { InvoiceDetail } from '../../../apis/invoices'
import type {
  VoucherGroup,
  VoucherType,
} from '../../../apis/voucher'
import type { InvoiceQualificationAction } from '../../../apis/invoiceReview'
import { getQualificationStatusLabel } from '../../../utils/status'

const visible = defineModel<boolean>('visible', {
  default: false,
})

const props = defineProps<{
  invoice: InvoiceDetail | null
  voucherGroups: VoucherGroup[]
  voucherFilePreviewing: boolean
  submitting: boolean
}>()

const emit = defineEmits<{
  previewVoucherFile: [voucherId: number]
  submitReview: [payload: {
    action: InvoiceQualificationAction
    note: string
  }]
}>()

const qualificationAction = ref<InvoiceQualificationAction>('approve')
const qualificationNote = ref('')

const hasRejectedCategoryItem = computed(() => {
  return props.invoice?.items.some(
    (item) => item.finalCategoryResult === '不可以',
  ) || false
})

const hasLowValueItem = computed(() => {
  return props.invoice?.items.some(
    (item) => item.priceType === 'low_value',
  ) || false
})

const hasAssetItem = computed(() => {
  return props.invoice?.items.some(
    (item) => item.priceType === 'asset',
  ) || false
})

const needsVoucher = computed(() => {
  return hasLowValueItem.value
    || Number(props.invoice?.cumulativeAmount || 0) > 1000
})

const approvedVoucherGroups = computed(() => {
  return props.voucherGroups.filter((group) => {
    return group.review_status === 'approved'
  })
})

const requiresQualificationNote = computed(() => {
  return qualificationAction.value !== 'approve'
})

function formatAmount(amount: number | string | null | undefined): string {
  return `¥${Number(amount || 0).toFixed(2)}`
}

function getCategoryResult(result: string | null): string {
  return result || '待判断'
}

function getPriceTypeLabel(priceType: string | null): string {
  const labels: Record<string, string> = {
    material: '材料',
    low_value: '低值品',
    asset: '资产',
  }

  return priceType ? labels[priceType] || '待判断' : '待判断'
}

function getVoucherFiles(
  group: VoucherGroup,
  voucherType: VoucherType,
) {
  return group.files.filter((file) => {
    return file.voucher_type === voucherType
  })
}

function closeDialog() {
  visible.value = false
}

function submitReview() {
  const note = qualificationNote.value.trim()

  if (requiresQualificationNote.value && !note) {
    ElMessage.warning('当前审核操作必须填写审核说明')
    return
  }

  emit('submitReview', {
    action: qualificationAction.value,
    note,
  })
}

watch(
  () => visible.value,
  (isVisible) => {
    if (isVisible) {
      qualificationAction.value = 'approve'
      qualificationNote.value = ''
    }
  },
)
</script>

<template>
  <el-dialog
    v-model="visible"
    title="发票级审核"
    width="min(960px, 94vw)"
    class="qualification-review-dialog"
    :lock-scroll="true"
    destroy-on-close
  >
    <div
      v-if="invoice"
      class="qualification-review"
      @wheel.stop
    >
      <el-alert
        title="选择“审核通过”后，系统将重新执行商品品类、单价、自然周累计和凭证规则。"
        type="info"
        :closable="false"
        show-icon
      />

      <section class="review-section">
        <div class="section-heading">
          <h3>发票概要</h3>
          <el-tag type="warning">
            {{ getQualificationStatusLabel(invoice.qualificationStatus) }}
          </el-tag>
        </div>

        <div class="summary-grid">
          <div>
            <span>发票号码</span>
            <strong>{{ invoice.invoiceNumber || '未识别' }}</strong>
          </div>
          <div>
            <span>销售方</span>
            <strong>{{ invoice.sellerName || '未识别' }}</strong>
          </div>
          <div>
            <span>价税合计</span>
            <strong class="amount">{{ formatAmount(invoice.totalAmount) }}</strong>
          </div>
          <div>
            <span>提交审核时间</span>
            <strong>{{ invoice.submittedAt || '尚未提交' }}</strong>
          </div>
          <div>
            <span>自然周累计</span>
            <strong>{{ formatAmount(invoice.cumulativeAmount) }}</strong>
          </div>
          <div>
            <span>累计所属周</span>
            <strong>{{ invoice.cumulativeWeekStart || '尚未计算' }}</strong>
          </div>
        </div>
      </section>

      <section class="review-section">
        <div class="section-heading">
          <h3>商品明细与风险</h3>
          <span>{{ invoice.items.length }} 个商品</span>
        </div>

        <div class="risk-tags">
          <el-tag
            :type="hasRejectedCategoryItem ? 'danger' : 'success'"
            effect="plain"
          >
            {{ hasRejectedCategoryItem ? '存在禁止品类' : '未发现禁止品类' }}
          </el-tag>
          <el-tag
            :type="hasAssetItem ? 'danger' : 'info'"
            effect="plain"
          >
            {{ hasAssetItem ? '存在资产项' : '未发现资产项' }}
          </el-tag>
          <el-tag
            :type="hasLowValueItem ? 'warning' : 'info'"
            effect="plain"
          >
            {{ hasLowValueItem ? '包含低值品' : '不含低值品' }}
          </el-tag>
        </div>

        <el-table
          :data="invoice.items"
          max-height="260"
          stripe
        >
          <el-table-column
            prop="itemName"
            label="商品名称"
            min-width="180"
          />
          <el-table-column
            label="单价分类"
            width="110"
          >
            <template #default="{ row }">
              {{ getPriceTypeLabel(row.priceType) }}
            </template>
          </el-table-column>
          <el-table-column
            label="品类结果"
            width="110"
          >
            <template #default="{ row }">
              <el-tag
                :type="row.finalCategoryResult === '不可以' ? 'danger' : 'info'"
                effect="plain"
              >
                {{ getCategoryResult(row.finalCategoryResult) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            label="明细金额"
            width="130"
          >
            <template #default="{ row }">
              {{ formatAmount(row.lineAmount) }}
            </template>
          </el-table-column>
        </el-table>
      </section>

      <section class="review-section">
        <div class="section-heading">
          <h3>支付凭证</h3>
          <el-tag
            :type="approvedVoucherGroups.length > 0 ? 'success' : needsVoucher ? 'warning' : 'info'"
            effect="plain"
          >
            {{ approvedVoucherGroups.length > 0
              ? '已核验通过'
              : needsVoucher
                ? '需要核验凭证'
                : '当前规则无需凭证' }}
          </el-tag>
        </div>

        <div
          v-if="approvedVoucherGroups.length > 0"
          class="approved-voucher-groups"
        >
          <article
            v-for="group in approvedVoucherGroups"
            :key="group.id"
            class="approved-voucher-group"
          >
            <div class="voucher-group-heading">
              <div>
                <strong>{{ group.group_name || `凭证组 #${group.id}` }}</strong>
                <span>审核通过时间：{{ group.reviewed_at || '未记录' }}</span>
              </div>
              <el-tag type="success" effect="plain">
                已核验通过
              </el-tag>
            </div>

            <p
              v-if="group.review_note"
              class="voucher-review-note"
            >
              审核说明：{{ group.review_note }}
            </p>

            <div class="voucher-file-grid">
              <div>
                <span>订单截图</span>
                <el-button
                  v-for="file in getVoucherFiles(group, 'order_screenshot')"
                  :key="file.id"
                  link
                  type="primary"
                  :loading="voucherFilePreviewing"
                  @click="emit('previewVoucherFile', file.id)"
                >
                  {{ file.original_name }}
                </el-button>
              </div>

              <div>
                <span>支付记录</span>
                <el-button
                  v-for="file in getVoucherFiles(group, 'payment_record')"
                  :key="file.id"
                  link
                  type="primary"
                  :loading="voucherFilePreviewing"
                  @click="emit('previewVoucherFile', file.id)"
                >
                  {{ file.original_name }}
                </el-button>
              </div>
            </div>
          </article>
        </div>

        <el-alert
          v-else-if="needsVoucher"
          title="当前发票按规则需要支付凭证，但尚无已核验通过的凭证组。"
          type="warning"
          :closable="false"
          show-icon
        />

        <el-alert
          v-else
          title="当前规则无需支付凭证。"
          type="info"
          :closable="false"
          show-icon
        />
      </section>

      <section class="review-section">
        <div class="section-heading">
          <h3>审核结论</h3>
          <span>提交后将更新发票资质状态</span>
        </div>

        <el-radio-group
          v-model="qualificationAction"
          class="qualification-actions"
          :disabled="submitting"
        >
          <el-radio value="approve">
            审核通过
          </el-radio>
          <el-radio value="request_voucher">
            待补凭证
          </el-radio>
          <el-radio value="mark_manual">
            待人工处理
          </el-radio>
          <el-radio value="reject">
            审核不通过
          </el-radio>
          <el-radio value="cancel">
            取消发票
          </el-radio>
        </el-radio-group>

        <el-input
          class="review-note"
          v-model="qualificationNote"
          type="textarea"
          :rows="3"
          maxlength="2000"
          show-word-limit
          :placeholder="requiresQualificationNote
            ? '请填写审核说明，当前操作必填'
            : '可选：填写审核说明'"
          :disabled="submitting"
        />
      </section>
    </div>

    <template #footer>
      <el-button @click="closeDialog">
        取消
      </el-button>
      <el-button
        type="primary"
        :loading="submitting"
        :disabled="submitting"
        @click="submitReview"
      >
        提交审核结论
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
:global(.qualification-review-dialog) {
  display: flex;
  max-height: 92vh;
  flex-direction: column;
  margin: 4vh auto !important;
}

:global(.qualification-review-dialog .el-dialog__body) {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.qualification-review {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.review-section {
  padding: 18px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.section-heading h3 {
  margin: 0;
  color: #1e293b;
  font-size: 16px;
}

.section-heading > span {
  color: #94a3b8;
  font-size: 12px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px 24px;
}

.summary-grid div {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.summary-grid span {
  color: #94a3b8;
  font-size: 12px;
}

.summary-grid strong {
  color: #334155;
  font-size: 14px;
}

.amount {
  color: #2563eb !important;
  font-size: 18px !important;
}

.risk-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

.approved-voucher-groups {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.approved-voucher-group {
  padding: 16px;
  border: 1px solid #bbf7d0;
  border-radius: 10px;
  background: #f0fdf4;
}

.voucher-group-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.voucher-group-heading > div {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.voucher-group-heading strong {
  color: #166534;
  font-size: 14px;
}

.voucher-group-heading span {
  color: #64748b;
  font-size: 12px;
}

.voucher-review-note {
  margin: 12px 0 0;
  color: #475569;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.voucher-file-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.voucher-file-grid > div {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
  padding: 12px;
  border-radius: 8px;
  background: #ffffff;
}

.voucher-file-grid span {
  color: #64748b;
  font-size: 12px;
}

.review-note {
  margin-top: 16px;
}

.qualification-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
}

@media (max-width: 720px) {
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }

  .voucher-file-grid {
    grid-template-columns: 1fr;
  }
}
</style>
