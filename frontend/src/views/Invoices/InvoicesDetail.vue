<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
  getFinanceStatusLabel,
  getQualificationStatusLabel,
  getReimbursementStatusLabel,
} from '../../utils/status'

const route = useRoute()
const router = useRouter()

const invoiceDetail = ref<InvoiceDetail | null>(null)
const selectedFileId = ref<number | null>(null)
const loading = ref(false)
const loadError = ref('')
const previewing = ref(false)
const downloading = ref(false)

const selectedFile = computed<InvoiceDetailFile | null>(() => {
  if (!invoiceDetail.value || selectedFileId.value === null) {
    return null
  }

  return invoiceDetail.value.files.find(
    (file) => file.id === selectedFileId.value,
  ) || null
})

const firstItemReason = computed(() => {
  return invoiceDetail.value?.items[0]?.categoryReason || '暂无判断依据'
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

function getPriceTypeLabel(priceType: InvoiceDetailItem['priceType']): string {
  const labels = {
    material: '材料',
    low_value: '低值品',
    asset: '资产',
  }

  return priceType ? labels[priceType] : '待判断'
}

function getCategoryResult(item: InvoiceDetailItem): string {
  return item.finalCategoryResult || item.manualCategoryResult || item.aiCategoryResult || '待判断'
}

function needsCategoryReview(item: InvoiceDetailItem): boolean {
  const categoryResult = getCategoryResult(item)

  return categoryResult === '存疑' || categoryResult === '待判断'
}

function getExtractionStatusLabel(status: InvoiceDetailFile['extractionStatus']): string {
  const labels = {
    pending: '处理中',
    success: '解析成功',
    failed: '解析失败',
  }

  return labels[status]
}

function getExtractionStatusType(status: InvoiceDetailFile['extractionStatus']) {
  const types = {
    pending: 'warning',
    success: 'success',
    failed: 'danger',
  } as const

  return types[status]
}

function goBack() {
  router.push({
    name: 'invoice-list',
  })
}

function handleItemCategoryReview(item: InvoiceDetailItem) {
  ElMessage.info(
    `商品“${item.itemName}”的人工品类确认入口已就绪，暂不提交审核数据`,
  )
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
      <div class="status-strip">
        <div>
          <span>资质审核</span>
          <el-tag type="warning">
            {{ getQualificationStatusLabel(invoiceDetail.qualificationStatus) }}
          </el-tag>
        </div>
        <div>
          <span>财务提交</span>
          <el-tag effect="plain">
            {{ getFinanceStatusLabel(invoiceDetail.financeStatus) }}
          </el-tag>
        </div>
        <div>
          <span>最终报销</span>
          <el-tag effect="plain">
            {{ getReimbursementStatusLabel(invoiceDetail.reimbursementStatus) }}
          </el-tag>
        </div>
      </div>

      <div class="detail-grid">
        <div class="main-column">
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
                {{ selectedFile ? getExtractionStatusLabel(selectedFile.extractionStatus) : '无关联文件' }}
              </el-tag>
            </div>

            <div class="info-grid">
              <div>
                <span>发票号码</span>
                <strong>{{ invoiceDetail.invoiceNumber || '未识别' }}</strong>
              </div>
              <div>
                <span>开票日期</span>
                <strong>{{ invoiceDetail.invoiceDate || '未识别' }}</strong>
              </div>
              <div>
                <span>销售方名称</span>
                <strong>{{ invoiceDetail.sellerName || '未识别' }}</strong>
              </div>
              <div>
                <span>销售方税号</span>
                <strong>{{ invoiceDetail.sellerTaxId || '未识别' }}</strong>
              </div>
              <div>
                <span>价税合计</span>
                <strong class="amount">{{ formatAmount(invoiceDetail.totalAmount) }}</strong>
              </div>
              <div>
                <span>上传批次</span>
                <strong class="muted-value">{{ invoiceDetail.sourceBatchId || '无' }}</strong>
              </div>
              <div>
                <span>上传时间</span>
                <strong>{{ invoiceDetail.createdAt }}</strong>
              </div>
              <div>
                <span>提交审核时间</span>
                <strong>{{ invoiceDetail.submittedAt || '尚未提交' }}</strong>
              </div>
            </div>
          </el-card>

          <el-card
            shadow="never"
            class="detail-card"
          >
            <div class="card-title">
              <h2>商品明细</h2>
              <span class="card-caption">{{ invoiceDetail.items.length }} 个商品</span>
            </div>

            <el-table
              :data="invoiceDetail.items"
              stripe
              empty-text="暂无商品明细"
            >
              <el-table-column
                prop="itemName"
                label="商品名称"
                min-width="170"
              />
              <el-table-column
                prop="quantity"
                label="数量"
                width="80"
              />
              <el-table-column
                label="单价"
                width="120"
              >
                <template #default="{ row }">
                  {{ formatAmount(row.unitPrice) }}
                </template>
              </el-table-column>
              <el-table-column
                label="明细金额"
                width="120"
              >
                <template #default="{ row }">
                  {{ formatAmount(row.lineAmount) }}
                </template>
              </el-table-column>
              <el-table-column
                label="单价分类"
                width="110"
              >
                <template #default="{ row }">
                  <el-tag effect="plain">
                    {{ getPriceTypeLabel(row.priceType) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column
                label="品类结果"
                width="100"
              >
                <template #default="{ row }">
                  <el-tag
                    type="warning"
                    effect="plain"
                  >
                    {{ getCategoryResult(row) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column
                label="人工确认"
                width="110"
              >
                <template #default="{ row }">
                  <el-button
                    v-if="needsCategoryReview(row)"
                    link
                    type="primary"
                    @click="handleItemCategoryReview(row)"
                  >
                    确认品类
                  </el-button>
                  <span
                    v-else
                    class="table-placeholder"
                  >
                    —
                  </span>
                </template>
              </el-table-column>
            </el-table>

            <div class="reason-row">
              <span>判断依据</span>
              <p>{{ firstItemReason }}</p>
            </div>
          </el-card>

          <el-card
            shadow="never"
            class="detail-card"
          >
            <div class="card-title">
              <h2>预审结果</h2>
              <el-tag type="warning">
                {{ getQualificationStatusLabel(invoiceDetail.qualificationStatus) }}
              </el-tag>
            </div>

            <div class="review-result">
              <div>
                <span>预审原因</span>
                <strong>{{ invoiceDetail.qualificationReason || '暂无预审结论' }}</strong>
              </div>
              <div>
                <span>自然周累计</span>
                <strong>{{ formatAmount(invoiceDetail.cumulativeAmount) }}</strong>
              </div>
              <div>
                <span>累计所属周</span>
                <strong>{{ invoiceDetail.cumulativeWeekStart || '尚未计算' }}</strong>
              </div>
              <div>
                <span>人工处理备注</span>
                <strong>{{ invoiceDetail.manualNote || '暂无备注' }}</strong>
              </div>
            </div>

            <div class="review-actions">
              <div>
                <strong>管理员审核</strong>
                <span>确认整张发票的处理结论。</span>
              </div>
              <el-button
                type="primary"
                @click="handleInvoiceReview"
              >
                进入审核
              </el-button>
            </div>
          </el-card>
        </div>

        <aside class="side-column">
          <el-card
            shadow="never"
            class="preview-card"
          >
            <div class="card-title">
              <h2>原始发票</h2>
              <el-button
                link
                type="primary"
                :disabled="!selectedFile"
                @click="previewSelectedFile"
              >
                放大预览
              </el-button>
            </div>

            <el-select
              v-if="invoiceDetail.files.length > 1"
              v-model="selectedFileId"
              class="file-selector"
              placeholder="选择原始文件"
            >
              <el-option
                v-for="file in invoiceDetail.files"
                :key="file.id"
                :label="file.originalName"
                :value="file.id"
              />
            </el-select>

            <div class="pdf-placeholder">
              <div class="pdf-icon">PDF</div>
              <strong>{{ selectedFile?.originalName || '暂无关联文件' }}</strong>
              <span>{{ selectedFile ? '点击预览查看原始发票' : '该发票暂未关联可预览文件' }}</span>
              <el-button
                type="primary"
                plain
                :disabled="!selectedFile"
                :loading="previewing"
                @click="previewSelectedFile"
              >
                预览文件
              </el-button>
            </div>
          </el-card>

          <el-card
            shadow="never"
            class="detail-card"
          >
            <div class="card-title">
              <h2>关联文件</h2>
              <span class="card-caption">{{ invoiceDetail.files.length }} 个文件</span>
            </div>

            <el-empty
              v-if="invoiceDetail.files.length === 0"
              description="暂无关联文件"
              :image-size="72"
            />
            <template v-else>
              <div
                v-for="file in invoiceDetail.files"
                :key="file.id"
                class="file-row"
              >
                <div>
                  <strong>{{ file.originalName }}</strong>
                  <span>{{ file.fileSize }} 字节</span>
                </div>
                <el-tag
                  :type="getExtractionStatusType(file.extractionStatus)"
                  effect="plain"
                >
                  {{ getExtractionStatusLabel(file.extractionStatus) }}
                </el-tag>
              </div>
            </template>
          </el-card>
        </aside>
      </div>
    </template>
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

.table-placeholder {
  color: #94a3b8;
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
