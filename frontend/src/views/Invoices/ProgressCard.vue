<script setup lang="ts">
import {
  computed,
  onMounted,
  ref,
} from 'vue'
import {
  type FinanceStatus,
  type FinanceWeekInvoice,
  type FinanceWeekGroup,
} from '../../apis/finance'
import {
  getFinanceStatusLabel as getInvoiceFinanceStatusLabel,
  getQualificationStatusLabel,
  getReimbursementStatusLabel,
} from '../../utils/status'
import {
  useRoute,
  useRouter,
} from 'vue-router'
import {
  useFinanceProgress,
} from './composables/useFinanceProgress'

const activeTab = ref<FinanceStatus>('not_submitted')
const weekFilter = ref('all')
const sellerFilter = ref('')
const expandedGroupIds = ref<string[]>([])
const route = useRoute()
const router = useRouter()

const {
  groups,
  getGroupKey,
  groupInvoiceDetails,
  groupInvoiceErrors,
  groupInvoiceLoading,
  loadError,
  loading,
  loadFinanceWeeks,
  loadGroupInvoices,
  summary,
} = useFinanceProgress()

const weekOptions = computed(() => {
  const values = [...new Set(groups.value.map((group) => group.weekStart))]

  return values.sort((left, right) => right.localeCompare(left))
})

const filteredGroups = computed(() => {
  const keyword = sellerFilter.value.trim().toLowerCase()

  return groups.value.filter((group) => {
    const matchesTab = group.financeStatus === activeTab.value
    const matchesWeek = weekFilter.value === 'all'
      || group.weekStart === weekFilter.value
    const matchesSeller = !keyword
      || group.sellerName.toLowerCase().includes(keyword)
      || group.sellerTaxId.toLowerCase().includes(keyword)

    return matchesTab && matchesWeek && matchesSeller
  })
})

function formatAmount(amount: number): string {
  return `¥${Number(amount || 0).toFixed(2)}`
}

function getWeekLabel(group: FinanceWeekGroup): string {
  return `${group.weekStart} 至 ${group.weekEnd}`
}

function getFinanceStatusLabel(status: FinanceStatus): string {
  return status === 'submitted' ? '已提交财务' : '待提交财务'
}

function getFinanceStatusType(status: FinanceStatus): 'success' | 'warning' {
  return status === 'submitted' ? 'success' : 'warning'
}

function getVoucherProgressLabel(group: FinanceWeekGroup): string {
  if (!group.voucherProgress.hasPendingRequirement) {
    return '无需待完成的周累计凭证'
  }

  return `凭证已完成 ${group.voucherProgress.approvedInvoiceCount} / ${group.voucherProgress.requiredInvoiceCount}`
}

function getReimbursementSummaryLabel(group: FinanceWeekGroup): string {
  const summary = group.reimbursementSummary
  const parts = []

  if (summary.successCount > 0) {
    parts.push(`成功 ${summary.successCount} 张`)
  }

  if (summary.failedCount > 0) {
    parts.push(`失败 ${summary.failedCount} 张`)
  }

  if (summary.notCompletedCount > 0) {
    parts.push(`未完成 ${summary.notCompletedCount} 张`)
  }

  return parts.length > 0 ? parts.join(' · ') : '尚未进入报销流程'
}

async function toggleGroup(group: FinanceWeekGroup) {
  const groupId = getGroupKey(group)
  const index = expandedGroupIds.value.indexOf(groupId)

  if (index === -1) {
    expandedGroupIds.value.push(groupId)
    await loadGroupInvoices(group)
    return
  }

  expandedGroupIds.value.splice(index, 1)
}

function isGroupExpanded(group: FinanceWeekGroup): boolean {
  return expandedGroupIds.value.includes(getGroupKey(group))
}

function getGroupInvoices(group: FinanceWeekGroup): FinanceWeekInvoice[] {
  return groupInvoiceDetails.value[getGroupKey(group)] || []
}

function getGroupInvoicesError(group: FinanceWeekGroup): string {
  return groupInvoiceErrors.value[getGroupKey(group)] || ''
}

function isGroupInvoicesLoading(group: FinanceWeekGroup): boolean {
  return Boolean(groupInvoiceLoading.value[getGroupKey(group)])
}

function getReimbursementStatusType(
  status: FinanceWeekInvoice['reimbursementStatus'],
): 'info' | 'success' | 'danger' {
  if (status === 'success') {
    return 'success'
  }

  if (status === 'failed') {
    return 'danger'
  }

  return 'info'
}

function goToInvoiceDetail(
  invoice: FinanceWeekInvoice,
  group: FinanceWeekGroup,
) {
  router.push({
    name: 'invoice-detail',
    params: {
      invoiceId: invoice.id,
    },
    query: {
      from: 'reimbursement-progress',
      weekStart: group.weekStart,
      sellerTaxId: group.sellerTaxId,
    },
  })
}

async function restoreFinanceGroupFromRoute() {
  const weekStart = typeof route.query.weekStart === 'string'
    ? route.query.weekStart
    : ''
  const sellerTaxId = typeof route.query.sellerTaxId === 'string'
    ? route.query.sellerTaxId
    : ''

  if (!weekStart || !sellerTaxId) {
    return
  }

  const group = groups.value.find((candidate) => {
    return candidate.weekStart === weekStart
      && candidate.sellerTaxId === sellerTaxId
  })

  if (!group) {
    return
  }

  activeTab.value = group.financeStatus
  weekFilter.value = weekStart
  sellerFilter.value = sellerTaxId
  expandedGroupIds.value = [getGroupKey(group)]

  await loadGroupInvoices(group)
}

onMounted(async () => {
  await loadFinanceWeeks()
  await restoreFinanceGroupFromRoute()
})
</script>

<template>
  <section v-loading="loading" class="progress-page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">REIMBURSEMENT PROGRESS</p>
        <h1>报销进度</h1>
        <p class="subtitle">按销售方和自然周汇总财务提交与最终报销处理进度。</p>
      </div>

      <el-button :loading="loading" @click="loadFinanceWeeks">
        刷新数据
      </el-button>
    </div>

    <el-alert
      v-if="loadError"
      class="load-error"
      :title="loadError"
      type="error"
      :closable="false"
      show-icon
    />

    <div class="summary-grid">
      <div class="summary-card pending">
        <span>待提交财务组</span>
        <strong>{{ summary.pendingGroupCount }}</strong>
        <small>等待整周审核与凭证核验完成</small>
      </div>

      <div class="summary-card submitted">
        <span>已提交财务组</span>
        <strong>{{ summary.submittedGroupCount }}</strong>
        <small>可继续登记单张发票报销结果</small>
      </div>
    </div>

    <el-card class="filter-card" shadow="never">
      <div class="filter-heading">
        <div>
          <strong>财务处理范围</strong>
          <span>当前筛选仅在已加载数据中生效，服务端筛选将在下一步接入。</span>
        </div>

        <el-radio-group v-model="activeTab">
          <el-radio-button value="not_submitted">
            待提交财务
          </el-radio-button>
          <el-radio-button value="submitted">
            已提交财务
          </el-radio-button>
        </el-radio-group>
      </div>

      <div class="filter-grid">
        <el-select v-model="weekFilter" aria-label="自然周筛选">
          <el-option label="全部自然周" value="all" />
          <el-option
            v-for="weekStart in weekOptions"
            :key="weekStart"
            :label="`${weekStart} 起`"
            :value="weekStart"
          />
        </el-select>

        <el-input
          v-model="sellerFilter"
          clearable
          placeholder="搜索销售方名称或税号"
        />
      </div>
    </el-card>

    <div class="group-list-heading">
      <div>
        <h2>{{ activeTab === 'not_submitted' ? '待提交财务组' : '已提交财务组' }}</h2>
        <span>当前显示 {{ filteredGroups.length }} 个自然周财务组</span>
      </div>
      <p>财务提交为组级操作，最终报销结果为发票级操作。</p>
    </div>

    <el-empty
      v-if="!loading && !loadError && filteredGroups.length === 0"
      description="当前筛选条件下暂无财务组"
    />

    <div v-else class="group-list">
      <el-card
        v-for="group in filteredGroups"
        :key="`${group.sellerTaxId}-${group.weekStart}`"
        class="finance-group-card"
        shadow="never"
      >
        <div class="group-header">
          <div class="group-identity">
            <div class="group-title-row">
              <h3>{{ group.sellerName }}</h3>
              <el-tag :type="getFinanceStatusType(group.financeStatus)" effect="light">
                {{ getFinanceStatusLabel(group.financeStatus) }}
              </el-tag>
            </div>
            <span>纳税人识别号：{{ group.sellerTaxId }}</span>
          </div>

          <div class="group-actions">
            <el-button link type="primary" @click="toggleGroup(group)">
              {{ isGroupExpanded(group) ? '收起组内发票' : '查看组内发票' }}
            </el-button>
            <el-tooltip
              v-if="group.financeStatus === 'not_submitted'"
              :disabled="group.canSubmitFinance"
              :content="group.submitBlockedReason || ''"
            >
              <el-button type="primary" disabled>
                提交本周财务
              </el-button>
            </el-tooltip>
          </div>
        </div>

        <div class="group-metrics">
          <div>
            <span>自然周</span>
            <strong>{{ getWeekLabel(group) }}</strong>
          </div>
          <div>
            <span>有效累计金额</span>
            <strong class="amount">{{ formatAmount(group.validCumulativeAmount) }}</strong>
          </div>
          <div>
            <span>审核通过发票</span>
            <strong>{{ group.approvedInvoiceCount }} / {{ group.totalInvoiceCount }} 张</strong>
          </div>
          <div>
            <span>凭证进度</span>
            <strong>{{ getVoucherProgressLabel(group) }}</strong>
          </div>
          <div>
            <span>报销进度</span>
            <strong>{{ getReimbursementSummaryLabel(group) }}</strong>
          </div>
        </div>

        <el-alert
          v-if="group.submitBlockedReason"
          class="group-alert"
          :title="group.submitBlockedReason"
          type="warning"
          :closable="false"
          show-icon
        />

        <div v-if="isGroupExpanded(group)" class="invoice-section">
          <div class="invoice-section-heading">
            <div>
              <strong>组内发票</strong>
              <span>明细按当前销售方和自然周加载。</span>
            </div>
          </div>

          <el-alert
            v-if="getGroupInvoicesError(group)"
            :title="getGroupInvoicesError(group)"
            type="error"
            :closable="false"
            show-icon
          />

          <el-table
            v-else
            v-loading="isGroupInvoicesLoading(group)"
            :data="getGroupInvoices(group)"
            class="invoice-table"
            size="small"
            empty-text="暂无组内发票"
          >
            <el-table-column prop="invoiceNumber" label="发票号码" min-width="155">
              <template #default="{ row }">
                {{ row.invoiceNumber || '未识别' }}
              </template>
            </el-table-column>
            <el-table-column label="价税合计" width="130" align="right">
              <template #default="{ row }">
                {{ formatAmount(row.totalAmount) }}
              </template>
            </el-table-column>
            <el-table-column label="资质审核" width="120">
              <template #default="{ row }">
                <el-tag effect="plain">
                  {{ getQualificationStatusLabel(row.qualificationStatus) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="凭证状态" min-width="140">
              <template #default="{ row }">
                {{ row.voucherStatus.label }}
              </template>
            </el-table-column>
            <el-table-column label="财务提交" width="110">
              <template #default="{ row }">
                {{ getInvoiceFinanceStatusLabel(row.financeStatus) }}
              </template>
            </el-table-column>
            <el-table-column label="最终报销" width="120">
              <template #default="{ row }">
                <el-tag
                  :type="getReimbursementStatusType(row.reimbursementStatus)"
                  effect="plain"
                >
                  {{ getReimbursementStatusLabel(row.reimbursementStatus) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="goToInvoiceDetail(row, group)">
                  查看详情
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-card>
    </div>
  </section>
</template>

<style scoped>
.progress-page {
  max-width: 1240px;
  margin: 0 auto;
  padding-bottom: 40px;
  color: #0f172a;
}

.page-heading,
.filter-heading,
.group-list-heading,
.group-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
}

.page-heading {
  margin-bottom: 24px;
}

.eyebrow {
  margin: 0 0 6px;
  color: #2563eb;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
}

.page-heading h1,
.group-list-heading h2,
.group-title-row h3 {
  margin: 0;
}

.page-heading h1 {
  font-size: 28px;
}

.subtitle,
.filter-heading span,
.group-list-heading span,
.group-list-heading p,
.group-identity > span,
.summary-card span,
.summary-card small,
.group-metrics span,
.invoice-section span {
  color: #94a3b8;
  font-size: 12px;
}

.subtitle {
  margin: 8px 0 0;
  color: #64748b;
  font-size: 14px;
}

.load-error,
.filter-card,
.summary-grid {
  margin-bottom: 20px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.summary-card,
.finance-group-card {
  border: 1px solid #e2e8f0;
  border-radius: 14px;
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 18px;
  background: #fff;
}

.summary-card strong {
  font-size: 28px;
}

.summary-card.pending strong {
  color: #d97706;
}

.summary-card.submitted strong {
  color: #16a34a;
}

.filter-heading {
  align-items: center;
}

.filter-heading > div,
.group-list-heading > div,
.group-identity,
.invoice-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-grid {
  display: grid;
  grid-template-columns: minmax(190px, 0.7fr) minmax(260px, 1fr);
  gap: 12px;
  margin-top: 18px;
}

.group-list-heading {
  margin-bottom: 14px;
}

.group-list-heading h2 {
  font-size: 18px;
}

.group-list-heading p {
  margin: 0;
}

.group-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.group-header {
  align-items: flex-start;
}

.group-title-row,
.group-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.group-title-row h3 {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 17px;
}

.group-metrics {
  display: grid;
  grid-template-columns: 1.1fr repeat(4, 1fr);
  gap: 12px;
  margin-top: 20px;
  padding: 14px;
  border-radius: 10px;
  background: #f8fafc;
}

.group-metrics > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.group-metrics strong {
  overflow: hidden;
  color: #334155;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.group-metrics .amount {
  color: #2563eb;
  font-size: 16px;
}

.group-alert {
  margin-top: 14px;
}

.invoice-section {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid #e2e8f0;
}

.invoice-section strong {
  font-size: 14px;
}

.invoice-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.invoice-section-heading > div {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.invoice-table {
  width: 100%;
}

@media (max-width: 980px) {
  .group-metrics {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 680px) {
  .page-heading,
  .filter-heading,
  .group-list-heading,
  .group-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .summary-grid,
  .filter-grid,
  .group-metrics {
    grid-template-columns: 1fr;
  }
}
</style>
