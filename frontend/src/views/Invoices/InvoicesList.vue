<script setup lang="ts">
import {
  computed,
  onMounted,
  ref,
  watch,
} from 'vue'
import {
  useRouter,
} from 'vue-router'
import {
  getInvoices,
  type InvoiceListItem,
  type PreAuditStatus,
} from '../../apis/invoices'
import {
  getFinanceStatusLabel,
  getPreAuditStatusLabel,
  getReimbursementStatusLabel,
} from '../../utils/status'
import {
  formatChinaDate,
} from '../../utils/date'

type InvoiceRow = InvoiceListItem

interface InvoiceListSearchForm {
  invoiceNumber: string
  sellerName: string
  preAuditStatus: PreAuditStatus | ''
  financeStatus: string
  reimbursementStatus: string
}

const searchForm = ref<InvoiceListSearchForm>({
  invoiceNumber: '',
  sellerName: '',
  preAuditStatus: '',
  financeStatus: '',
  reimbursementStatus: '',
})
const router = useRouter()

const invoices = ref<InvoiceRow[]>([])
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const loading = ref(false)
const loadError = ref('')

const filteredInvoices = computed(() => invoices.value)

const voucherPendingCount = computed(() => {
  return invoices.value.filter((invoice) => {
    return [
      'pending_voucher',
      'pending_weekly_voucher',
      'waiting_group_vouchers',
    ].includes(invoice.preAuditStatus)
  }).length
})

const pendingCount = computed(() => {
  return invoices.value.filter((invoice) => {
    return ![
      'approved',
      'rejected',
      'cancelled',
      'pending_voucher',
      'pending_weekly_voucher',
      'waiting_group_vouchers',
    ].includes(invoice.preAuditStatus)
  }).length
})

const approvedCount = computed(() => {
  return invoices.value.filter((invoice) => {
    return invoice.preAuditStatus === 'approved'
  }).length
})

function resetFilters() {
  searchForm.value = {
    invoiceNumber: '',
    sellerName: '',
    preAuditStatus: '',
    financeStatus: '',
    reimbursementStatus: '',
  }
  page.value = 1
}

function formatAmount(amount: number | string) {
  return `¥${Number(amount || 0).toFixed(2)}`
}

function getPreAuditStatusType(status: InvoiceRow['preAuditStatus']) {
  if (status === 'approved') {
    return 'success'
  }

  if (status === 'rejected') {
    return 'danger'
  }

  if (status === 'cancelled') {
    return 'info'
  }

  return 'warning'
}

function goToUpload() {
  router.push({
    name: 'upload-invoice',
  })
}

function goToDetail(invoice: InvoiceRow) {
  router.push({
    name: 'invoice-detail',
    params: {
      invoiceId: invoice.id,
    },
  })
}

async function loadInvoices() {
  loading.value = true
  loadError.value = ''

  try {
    const result = await getInvoices({
      page: page.value,
      pageSize: pageSize.value,
      preAuditStatus: searchForm.value.preAuditStatus || undefined,
      financeStatus: searchForm.value.financeStatus || undefined,
      reimbursementStatus: searchForm.value.reimbursementStatus || undefined,
      sellerName: searchForm.value.sellerName || undefined,
      invoiceNumber: searchForm.value.invoiceNumber || undefined,
    })

    invoices.value = result.items
    total.value = result.pagination.total
  } catch (error) {
    loadError.value = error instanceof Error
      ? error.message
      : '获取发票列表失败'
  } finally {
    loading.value = false
  }
}

function handlePageChange(value: number) {
  page.value = value
  loadInvoices()
}

watch(
  () => [
    searchForm.value.invoiceNumber,
    searchForm.value.sellerName,
    searchForm.value.preAuditStatus,
    searchForm.value.financeStatus,
    searchForm.value.reimbursementStatus,
  ],
  () => {
    page.value = 1
    loadInvoices()
  },
)

onMounted(loadInvoices)
</script>

<template>
  <section class="invoice-list-page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">
          INVOICE REGISTER
        </p>
        <h1>
          发票列表
        </h1>
        <p class="subtitle">
          查看已上传发票、预审结果和后续处理状态。
        </p>
      </div>
      <el-button
        type="primary"
        @click="goToUpload"
      >
        上传发票
      </el-button>
    </div>

    <div class="summary-grid">
      <div class="summary-card">
        <span>发票总数</span>
        <strong>{{ total }}</strong>
        <small>当前查询范围</small>
      </div>
      <div class="summary-card warning">
        <span>待补凭证</span>
        <strong>{{ voucherPendingCount }}</strong>
        <small>当前页需要补充凭证</small>
      </div>
      <div class="summary-card warning">
        <span>待处理</span>
        <strong>{{ pendingCount }}</strong>
        <small>等待管理员处理</small>
      </div>
      <div class="summary-card approved">
        <span>预审通过</span>
        <strong>{{ approvedCount }}</strong>
        <small>无待完成凭证任务</small>
      </div>
    </div>

    <el-card
      class="filter-card"
      shadow="never"
    >
      <div class="filter-title">
        <strong>筛选条件</strong>
        <el-button
          link
          @click="resetFilters"
        >
          重置
        </el-button>
      </div>
      <div class="filter-grid">
        <el-input
          v-model="searchForm.invoiceNumber"
          placeholder="发票号码"
          clearable
        />
        <el-input
          v-model="searchForm.sellerName"
          placeholder="销售方名称"
          clearable
        />
        <el-select
          v-model="searchForm.preAuditStatus"
          placeholder="预审状态"
          clearable
        >
          <el-option label="待审核" value="pending" />
          <el-option label="待补凭证" value="pending_voucher" />
          <el-option label="待补凭证（周累计）" value="pending_weekly_voucher" />
          <el-option label="组内凭证待完成" value="waiting_group_vouchers" />
          <el-option label="待人工处理" value="pending_manual" />
          <el-option label="审核通过" value="approved" />
          <el-option label="审核不通过" value="rejected" />
          <el-option label="已取消" value="cancelled" />
        </el-select>
        <el-select
          v-model="searchForm.financeStatus"
          placeholder="财务提交状态"
          clearable
        >
          <el-option label="未提交" value="not_submitted" />
          <el-option label="已提交" value="submitted" />
        </el-select>
        <el-select
          v-model="searchForm.reimbursementStatus"
          placeholder="报销状态"
          clearable
        >
          <el-option label="未完成" value="not_completed" />
          <el-option label="报销成功" value="success" />
          <el-option label="报销失败" value="failed" />
        </el-select>
      </div>
    </el-card>

    <el-card
      class="table-card"
      shadow="never"
    >
      <div class="table-heading">
        <div>
          <strong>发票记录</strong>
          <span>共 {{ filteredInvoices.length }} 条</span>
        </div>
        <el-button
          link
          type="primary"
        >
          批量导出
        </el-button>
      </div>
      <el-alert
        v-if="loadError"
        :title="loadError"
        type="error"
        :closable="false"
        show-icon
      />
      <el-table
        v-loading="loading"
        :data="filteredInvoices"
        stripe
        empty-text="暂无发票记录"
      >
        <el-table-column
          label="发票信息"
          min-width="220"
        >
          <template #default="{ row }">
            <div class="invoice-cell">
              <strong>{{ row.invoiceNumber || '未识别' }}</strong>
              <span>{{ row.file?.originalName || '无文件' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="sellerName"
          label="销售方"
          min-width="190"
          show-overflow-tooltip
        />
        <el-table-column
          label="价税合计"
          width="130"
          align="right"
        >
          <template #default="{ row }">
            <strong>{{ formatAmount(row.totalAmount) }}</strong>
          </template>
        </el-table-column>
        <el-table-column
          label="开票日期"
          width="120"
        >
          <template #default="{ row }">
            {{ formatChinaDate(row.invoiceDate) || '-' }}
          </template>
        </el-table-column>
        <el-table-column
          label="预审状态"
          min-width="180"
        >
          <template #default="{ row }">
            <el-tooltip
              :content="row.preAuditStatusReason || ''"
              :disabled="!row.preAuditStatusReason"
            >
              <el-tag
                :type="getPreAuditStatusType(row.preAuditStatus)"
                effect="plain"
              >
                {{ getPreAuditStatusLabel(row.preAuditStatus) }}
              </el-tag>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column
          label="财务提交"
          width="110"
        >
          <template #default="{ row }">
            {{ getFinanceStatusLabel(row.financeStatus) }}
          </template>
        </el-table-column>
        <el-table-column
          label="报销状态"
          width="110"
        >
          <template #default="{ row }">
            {{ getReimbursementStatusLabel(row.reimbursementStatus) }}
          </template>
        </el-table-column>
        <el-table-column
          label="操作"
          width="100"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              @click="goToDetail(row)"
            >
              查看详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <span>第 {{ page }} 页</span>
        <el-pagination
          background
          layout="prev, pager, next"
          :current-page="page"
          :total="total"
          :page-size="pageSize"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>
  </section>
</template>

<style scoped>
.invoice-list-page {
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
  margin-bottom: 24px;
}

.eyebrow {
  margin: 0 0 6px;
  color: #2563eb;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
}

h1 {
  margin: 0;
  font-size: 28px;
}

.subtitle {
  margin: 8px 0 0;
  color: #64748b;
  font-size: 14px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 20px;
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 18px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
}

.summary-card span,
.summary-card small {
  color: #94a3b8;
  font-size: 12px;
}

.summary-card strong {
  font-size: 28px;
}

.summary-card.success strong {
  color: #16a34a;
}

.summary-card.warning strong {
  color: #d97706;
}

.summary-card.approved strong {
  color: #2563eb;
}

.filter-card,
.table-card {
  margin-bottom: 20px;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
}

.filter-title,
.table-heading,
.table-heading > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-top: 16px;
}

.table-heading {
  margin-bottom: 16px;
}

.table-heading strong {
  margin-right: 10px;
}

.table-heading span {
  color: #94a3b8;
  font-size: 12px;
}

.invoice-cell {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.invoice-cell span {
  color: #94a3b8;
  font-size: 12px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18px;
  color: #94a3b8;
  font-size: 12px;
}

@media (max-width: 1000px) {
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .filter-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .page-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .summary-grid,
  .filter-grid {
    grid-template-columns: 1fr;
  }

  .pagination {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
  }
}
</style>
