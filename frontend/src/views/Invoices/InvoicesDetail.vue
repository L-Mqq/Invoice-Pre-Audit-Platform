<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import {
  getInvoiceDetail,
  type InvoiceDetail,
  type InvoiceDetailFile,
  type InvoiceDetailItem,
} from '../../apis/invoices'
import {
  downloadInvoiceFile,
  previewInvoiceFile,
} from '../../apis/invoiceFile'
import {
  reviewItemCategory,
  submitInvoiceForReview,
  type CategoryReviewResult,
} from '../../apis/invoiceReview'
import InvoiceBasicInfo from './components/InvoiceBasicInfo.vue'
import InvoiceItemsTable from './components/InvoiceItemsTable.vue'
import InvoicePreviewCard from './components/InvoicePreviewCard.vue'
import InvoiceReviewCard from './components/InvoiceReviewCard.vue'
import InvoiceStatusStrip from './components/InvoiceStatusStrip.vue'

const route = useRoute()
const router = useRouter()

const invoiceDetail = ref<InvoiceDetail | null>(null)
const selectedFileId = ref<number | null>(null)
const loading = ref(false)
const loadError = ref('')
const previewing = ref(false)
const downloading = ref(false)
const evidenceDialogVisible = ref(false)
const categoryReviewDialogVisible = ref(false)
const categoryReviewSubmitting = ref(false)
const submitReviewLoading = ref(false)
const selectedReviewItem = ref<InvoiceDetailItem | null>(null)
const categoryReviewForm = reactive({
  result: '',
  reason: '',
})

const selectedFile = computed<InvoiceDetailFile | null>(() => {
  if (!invoiceDetail.value || selectedFileId.value === null) {
    return null
  }

  return invoiceDetail.value.files.find(
    (file) => file.id === selectedFileId.value,
  ) || null
})

const firstItemReason = computed(() => {
  return invoiceDetail.value?.items[0]?.aiCategoryReason || '暂无判断依据'
})

const isCategoryEditable = computed(() => {
  if (!invoiceDetail.value) {
    return false
  }

  return !invoiceDetail.value.submittedAt
    && (
      invoiceDetail.value.qualificationStatus === 'pending'
      || invoiceDetail.value.qualificationStatus === 'pending_manual'
    )
})

const canSubmitReview = computed(() => {
  if (!invoiceDetail.value || !isCategoryEditable.value) {
    return false
  }

  return invoiceDetail.value.items.length > 0
    && invoiceDetail.value.items.every(
      (item) => item.finalCategoryResult && item.finalCategoryResult !== '存疑',
    )
})

const canEnterInvoiceReview = computed(() => {
  if (!invoiceDetail.value) {
    return false
  }

  return Boolean(invoiceDetail.value.submittedAt)
    && invoiceDetail.value.qualificationStatus === 'pending'
})

function getRouteInvoiceId(): number | null {
  const value = route.params.invoiceId
  const rawInvoiceId = Array.isArray(value) ? value[0] : value
  const invoiceId = Number(rawInvoiceId)

  if (!Number.isSafeInteger(invoiceId) || invoiceId <= 0) {
    return null
  }

  return invoiceId
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return '获取发票详情失败'
}

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

function canReviewCategory(): boolean {
  return isCategoryEditable.value
}

function goBack() {
  router.push({
    name: 'invoice-list',
  })
}

function openEvidenceDialog(item: InvoiceDetailItem) {
  selectedReviewItem.value = item
  evidenceDialogVisible.value = true
}

function openCategoryReviewDialog() {
  if (!selectedReviewItem.value) {
    return
  }

  categoryReviewForm.result = selectedReviewItem.value.manualCategoryResult
    || selectedReviewItem.value.finalCategoryResult
    || '存疑'
  categoryReviewForm.reason = selectedReviewItem.value.manualCategoryReason || ''
  evidenceDialogVisible.value = false
  categoryReviewDialogVisible.value = true
}

async function submitCategoryReview() {
  if (!categoryReviewForm.result) {
    ElMessage.warning('请选择最终品类结果')
    return
  }

  if (!categoryReviewForm.reason.trim()) {
    ElMessage.warning('请填写人工判断依据')
    return
  }

  if (!selectedReviewItem.value) {
    ElMessage.warning('未选择需要人工确认的商品')
    return
  }

  categoryReviewSubmitting.value = true

  try {
    await reviewItemCategory({
      itemId: selectedReviewItem.value.id,
      result: categoryReviewForm.result as CategoryReviewResult,
      note: categoryReviewForm.reason.trim(),
    })

    categoryReviewDialogVisible.value = false
    selectedReviewItem.value = null
    await loadInvoiceDetail()
    ElMessage.success('商品品类人工确认已保存')
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    categoryReviewSubmitting.value = false
  }
}

async function submitInvoiceReview() {
  const invoiceId = getRouteInvoiceId()

  if (!invoiceId || !canSubmitReview.value) {
    ElMessage.warning('请先完成全部商品的品类确认，再提交审核')
    return
  }

  submitReviewLoading.value = true

  try {
    await submitInvoiceForReview(invoiceId)
    await loadInvoiceDetail()
    ElMessage.success('发票已提交审核，商品品类已锁定')
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    submitReviewLoading.value = false
  }
}

function handleInvoiceReview() {
  ElMessage.info('发票级管理员审核入口已就绪，暂不提交审核数据')
}

async function loadInvoiceDetail() {
  const invoiceId = getRouteInvoiceId()

  invoiceDetail.value = null
  selectedFileId.value = null
  loadError.value = ''

  if (!invoiceId) {
    loadError.value = '发票 ID 无效'
    return
  }

  loading.value = true

  try {
    const detail = await getInvoiceDetail(invoiceId)

    invoiceDetail.value = detail
    selectedFileId.value = detail.files[0]?.id || null
  } catch (error) {
    loadError.value = getErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function previewSelectedFile() {
  if (!selectedFile.value) {
    ElMessage.warning('暂无可预览的原始文件')
    return
  }

  const previewWindow = window.open('', '_blank')
  if (!previewWindow) {
    ElMessage.warning('浏览器阻止了预览窗口，请允许打开新标签页后重试')
    return
  }

  previewing.value = true

  try {
    const fileBlob = await previewInvoiceFile(selectedFile.value.id)
    const previewUrl = URL.createObjectURL(fileBlob)

    previewWindow.location.href = previewUrl
    window.setTimeout(() => {
      URL.revokeObjectURL(previewUrl)
    }, 60_000)
  } catch (error) {
    previewWindow.close()
    ElMessage.error(getErrorMessage(error))
  } finally {
    previewing.value = false
  }
}

async function downloadSelectedFile() {
  if (!selectedFile.value) {
    ElMessage.warning('暂无可下载的原始文件')
    return
  }

  downloading.value = true

  try {
    const fileBlob = await downloadInvoiceFile(selectedFile.value.id)
    const downloadUrl = URL.createObjectURL(fileBlob)
    const link = document.createElement('a')

    link.href = downloadUrl
    link.download = selectedFile.value.originalName
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(downloadUrl)
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    downloading.value = false
  }
}

watch(
  () => route.params.invoiceId,
  () => {
    loadInvoiceDetail()
  },
  {
    immediate: true,
  },
)
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
            :first-item-reason="firstItemReason"
            @view-evidence="openEvidenceDialog"
          />

          <InvoiceReviewCard
            :invoice="invoiceDetail"
            :can-submit-review="canSubmitReview"
            :can-enter-invoice-review="canEnterInvoiceReview"
            :is-category-editable="isCategoryEditable"
            :submit-review-loading="submitReviewLoading"
            @submit-review="submitInvoiceReview"
            @enter-review="handleInvoiceReview"
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
          v-if="selectedReviewItem && canReviewCategory()"
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
