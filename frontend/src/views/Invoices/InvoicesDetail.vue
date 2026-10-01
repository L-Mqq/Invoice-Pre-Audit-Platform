<script setup lang="ts">
import {
  ref,
} from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import type { InvoiceDetailItem } from '../../apis/invoices'
import InvoiceBasicInfo from './components/InvoiceBasicInfo.vue'
import InvoiceItemsTable from './components/InvoiceItemsTable.vue'
import InvoicePreviewCard from './components/InvoicePreviewCard.vue'
import InvoiceQualificationReviewDialog from './components/InvoiceQualificationReviewDialog.vue'
import InvoiceReviewCard from './components/InvoiceReviewCard.vue'
import InvoiceStatusStrip from './components/InvoiceStatusStrip.vue'
import { useInvoiceCategoryReview } from './composables/useInvoiceCategoryReview'
import { useInvoiceDetail } from './composables/useInvoiceDetail'
import { useInvoiceFileActions } from './composables/useInvoiceFileActions'
import { useInvoiceReviewSubmission } from './composables/useInvoiceReviewSubmission'
import { useInvoiceVoucher } from './composables/useInvoiceVoucher'

const router = useRouter()
const qualificationReviewVisible = ref(false)

const {
  getRouteInvoiceId,
  invoiceDetail,
  loadError,
  loading,
  loadInvoiceDetail,
  selectedFile,
  selectedFileId,
} = useInvoiceDetail()

const {
  downloadSelectedFile,
  downloading,
  previewSelectedFile,
  previewing,
} = useInvoiceFileActions(selectedFile)

const {
  categoryReviewDialogVisible,
  categoryReviewForm,
  categoryReviewSubmitting,
  evidenceDialogVisible,
  openCategoryReviewDialog,
  openEvidenceDialog,
  selectedReviewItem,
  submitCategoryReview,
} = useInvoiceCategoryReview({
  loadInvoiceDetail,
})

const {
  canEnterInvoiceReview,
  canSubmitReview,
  isCategoryEditable,
  submitInvoiceReview,
  submitReviewLoading,
} = useInvoiceReviewSubmission({
  getRouteInvoiceId,
  invoiceDetail,
  loadInvoiceDetail,
})

const {
  canViewVouchers,
  isVoucherRequired,
  primaryVoucherActionLabel,
  voucherGroupsError,
  voucherGroupsLoading,
  voucherStatusDescription,
  voucherStatusLabel,
  voucherStatusType,
} = useInvoiceVoucher({
  invoiceDetail,
})

function formatAmount(amount: number | string | null): string {
  return `¥${Number(amount || 0).toFixed(2)}`
}

function getCategoryResult(item: InvoiceDetailItem): string {
  return item.finalCategoryResult || item.manualCategoryResult || item.aiCategoryResult || '待判断'
}

function getAutoCategoryReason(item: InvoiceDetailItem): string {
  return item.aiCategoryReason || '暂无自动判断依据'
}

function getManualCategoryReason(item: InvoiceDetailItem): string {
  return item.manualCategoryReason || '暂无人工确认依据'
}

function canReviewCategory(item: InvoiceDetailItem): boolean {
  if (!isCategoryEditable.value) {
    return false
  }

  return !item.finalCategoryResult || item.finalCategoryResult === '存疑'
}

function goBack() {
  router.push({
    name: 'invoice-list',
  })
}

function openQualificationReview() {
  qualificationReviewVisible.value = true
}

function handleSubmitVoucher() {
  ElMessage.info('凭证提交弹窗待接入')
}

function handleViewVoucher() {
  ElMessage.info('凭证查看弹窗待接入')
}

</script>

<template>
  <section
    v-loading="loading"
    class="detail-page"
  >
    <div class="page-heading">
      <div>
        <el-button
          link
          type="primary"
          @click="goBack"
        >
          ← 返回发票列表
        </el-button>
        <p class="eyebrow">INVOICE DETAIL</p>
        <h1>发票详情</h1>
        <p class="subtitle">查看发票识别信息、商品预审结果和处理状态。</p>
      </div>

      <div class="heading-actions">
        <el-button
          :disabled="!selectedFile"
          :loading="downloading"
          @click="downloadSelectedFile"
        >
          下载发票
        </el-button>
        <el-button
          type="primary"
          :disabled="!selectedFile"
          :loading="previewing"
          @click="previewSelectedFile"
        >
          预览 PDF
        </el-button>
      </div>
    </div>

    <el-alert
      v-if="loadError"
      class="load-error"
      :title="loadError"
      type="error"
      show-icon
      :closable="false"
    >
      <template #default>
        <el-button
          link
          type="primary"
          @click="loadInvoiceDetail"
        >
          重新加载
        </el-button>
      </template>
    </el-alert>

    <template v-else-if="invoiceDetail">
      <InvoiceStatusStrip :invoice="invoiceDetail" />

      <div class="detail-grid">
        <div class="main-column">
          <InvoiceBasicInfo
            :invoice="invoiceDetail"
            :selected-file="selectedFile"
          />

          <InvoiceItemsTable
            :items="invoiceDetail.items"
            @view-evidence="openEvidenceDialog"
          />

          <InvoiceReviewCard
            :invoice="invoiceDetail"
            :can-submit-review="canSubmitReview"
            :can-enter-invoice-review="canEnterInvoiceReview"
            :is-category-editable="isCategoryEditable"
            :submit-review-loading="submitReviewLoading"
            :is-voucher-required="isVoucherRequired"
            :voucher-status-label="voucherStatusLabel"
            :voucher-status-description="voucherStatusDescription"
            :voucher-status-type="voucherStatusType"
            :primary-voucher-action-label="primaryVoucherActionLabel"
            :can-view-vouchers="canViewVouchers"
            :voucher-groups-loading="voucherGroupsLoading"
            :voucher-groups-error="voucherGroupsError"
            @submit-review="submitInvoiceReview"
            @enter-review="openQualificationReview"
            @submit-voucher="handleSubmitVoucher"
            @view-voucher="handleViewVoucher"
          />
        </div>

        <aside class="side-column">
          <InvoicePreviewCard
            :files="invoiceDetail.files"
            :selected-file="selectedFile"
            :selected-file-id="selectedFileId"
            :previewing="previewing"
            @preview="previewSelectedFile"
            @update:selected-file-id="selectedFileId = $event"
          />
        </aside>
      </div>
    </template>

    <InvoiceQualificationReviewDialog
      v-model:visible="qualificationReviewVisible"
      :invoice="invoiceDetail"
    />

    <el-dialog
      v-model="evidenceDialogVisible"
      title="商品判断依据"
      width="560px"
      destroy-on-close
    >
      <div
        v-if="selectedReviewItem"
        class="evidence-content"
      >
        <div class="evidence-item-name">
          <span>商品名称</span>
          <strong>{{ selectedReviewItem.itemName }}</strong>
        </div>

        <div class="evidence-section">
          <div class="evidence-section-title">
            <span>自动判断</span>
            <el-tag effect="plain">
              {{ selectedReviewItem.aiCategoryResult || '待判断' }}
            </el-tag>
          </div>
          <p>{{ getAutoCategoryReason(selectedReviewItem) }}</p>
        </div>

        <div class="evidence-section">
          <div class="evidence-section-title">
            <span>人工确认</span>
            <el-tag
              :type="selectedReviewItem.manualCategoryResult ? 'success' : 'info'"
              effect="plain"
            >
              {{ selectedReviewItem.manualCategoryResult || '暂无人工确认' }}
            </el-tag>
          </div>
          <p>{{ getManualCategoryReason(selectedReviewItem) }}</p>
        </div>

        <div class="final-category-result">
          <span>最终品类结果</span>
          <el-tag type="warning">
            {{ getCategoryResult(selectedReviewItem) }}
          </el-tag>
        </div>
      </div>

      <template #footer>
        <el-button @click="evidenceDialogVisible = false">
          关闭
        </el-button>
        <el-button
          v-if="selectedReviewItem && canReviewCategory(selectedReviewItem)"
          type="primary"
          @click="openCategoryReviewDialog"
        >
          {{ selectedReviewItem?.manualCategoryResult ? '修改人工确认' : '人工确认品类' }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="categoryReviewDialogVisible"
      title="人工确认商品品类"
      width="520px"
      destroy-on-close
    >
      <div
        v-if="selectedReviewItem"
        class="category-review-content"
      >
        <div class="review-item-summary">
          <strong>{{ selectedReviewItem.itemName }}</strong>
          <span>
            单价 {{ formatAmount(selectedReviewItem.unitPrice) }}
            · 金额 {{ formatAmount(selectedReviewItem.lineAmount) }}
          </span>
        </div>

        <div class="readonly-evidence">
          <span>自动判断依据</span>
          <p>{{ getAutoCategoryReason(selectedReviewItem) }}</p>
        </div>

        <el-form label-position="top">
          <el-form-item label="最终品类结果">
            <el-radio-group v-model="categoryReviewForm.result">
              <el-radio value="可以">
                可以
              </el-radio>
              <el-radio value="存疑">
                存疑
              </el-radio>
              <el-radio value="不可以">
                不可以
              </el-radio>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="人工判断依据">
            <el-input
              v-model="categoryReviewForm.reason"
              type="textarea"
              :rows="4"
              maxlength="2000"
              show-word-limit
              placeholder="请说明人工确认的依据"
            />
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <el-button @click="categoryReviewDialogVisible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="categoryReviewSubmitting"
          @click="submitCategoryReview"
        >
          确认提交
        </el-button>
      </template>
    </el-dialog>
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
  letter-spacing: 0.14em;
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

.load-error {
  margin-bottom: 20px;
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
  grid-template-columns: minmax(0, 1.6fr) minmax(300px, 0.8fr);
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
  gap: 12px;
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
}

.review-result div {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.review-result strong {
  color: #334155;
  font-size: 14px;
  line-height: 1.6;
}

.evidence-content,
.category-review-content {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.evidence-item-name,
.evidence-section-title,
.final-category-result {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.evidence-item-name {
  padding-bottom: 14px;
  border-bottom: 1px solid #e2e8f0;
}

.evidence-item-name span,
.evidence-section-title span,
.final-category-result span,
.readonly-evidence > span {
  color: #64748b;
  font-size: 13px;
}

.evidence-item-name strong {
  color: #1e293b;
  font-size: 15px;
}

.evidence-section {
  padding: 14px;
  border-radius: 10px;
  background: #f8fafc;
}

.evidence-section p,
.readonly-evidence p {
  margin: 10px 0 0;
  color: #475569;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
}

.final-category-result {
  padding: 14px;
  border: 1px solid #dbeafe;
  border-radius: 10px;
  background: #f8fbff;
}

.review-item-summary {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px;
  border-radius: 10px;
  background: #f8fafc;
}

.review-item-summary strong {
  color: #1e293b;
  font-size: 15px;
}

.review-item-summary span {
  color: #64748b;
  font-size: 13px;
}

.readonly-evidence {
  padding: 14px;
  border-left: 3px solid #93c5fd;
  border-radius: 0 8px 8px 0;
  background: #eff6ff;
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
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.review-actions strong {
  color: #334155;
  font-size: 14px;
}

.review-actions span {
  color: #94a3b8;
  font-size: 12px;
}

.file-selector {
  width: 100%;
  margin-bottom: 12px;
}

.pdf-placeholder {
  min-height: 300px;
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

.file-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f1f5f9;
}

.file-row:last-child {
  border-bottom: 0;
}

.file-row > div {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-row strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.file-row span {
  color: #94a3b8;
  font-size: 12px;
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

  .status-strip,
  .info-grid,
  .review-result {
    grid-template-columns: 1fr;
  }

  .review-actions {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
