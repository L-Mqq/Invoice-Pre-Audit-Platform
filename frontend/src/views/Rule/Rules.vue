<script setup lang="ts">
import {
  onMounted,
  ref,
} from 'vue'
import {
  ElMessage,
  ElMessageBox,
} from 'element-plus'
import RuleEditDialog, {
  type RuleFormValue,
} from './components/RuleEditDialog.vue'
import RuleFilterBar, {
  type RuleFilters,
} from './components/RuleFilterBar.vue'
import RuleFixedRules from './components/RuleFixedRules.vue'
import RuleLogDialog from './components/RuleLogDialog.vue'
import RuleStatsCards from './components/RuleStatsCards.vue'
import RuleTable, {
  type RuleGroup,
} from './components/RuleTable.vue'
import RuleTestDialog from './components/RuleTestDialog.vue'
import {
  useCategoryRuleActions,
} from './composables/useCategoryRuleActions'
import {
  useCategoryRuleList,
} from './composables/useCategoryRuleList'
import {
  useCategoryRuleNameOptions,
} from './composables/useCategoryRuleNameOptions'
import {
  useCategoryRuleLogs,
} from './composables/useCategoryRuleLogs'
import {
  useCategoryRuleSummary,
} from './composables/useCategoryRuleSummary'
import {
  useCategoryRuleTest,
} from './composables/useCategoryRuleTest'

const editDialogVisible = ref(false)
const editMode = ref<'create' | 'edit'>('create')
const selectedRule = ref<RuleFormValue | null>(null)

const {
  changePage,
  filters,
  loadError,
  loading: listLoading,
  loadRules,
  page,
  pageSize,
  resetFilters,
  rules,
  searchRules,
  total,
} = useCategoryRuleList()
const {
  loadOptions: loadRuleNameOptions,
  options: ruleNameOptions,
} = useCategoryRuleNameOptions()
const {
  loadError: summaryLoadError,
  loadSummary,
  summary,
} = useCategoryRuleSummary()
const {
  createRule,
  deletingId,
  removeRuleGroup,
  submitting,
  updateGroupStatus,
  updateRuleGroup,
  updatingStatusId,
} = useCategoryRuleActions()
const {
  error: testError,
  loading: testLoading,
  openTestDialog,
  result: testResult,
  testMatch,
  visible: testDialogVisible,
} = useCategoryRuleTest()
const {
  error: logError,
  loading: logLoading,
  logs,
  openLogDialog,
  visible: logDialogVisible,
} = useCategoryRuleLogs()

async function refreshRuleData() {
  await Promise.all([
    loadRules(),
    loadSummary(),
    loadRuleNameOptions(),
  ])
}

function openCreateDialog() {
  editMode.value = 'create'
  selectedRule.value = null
  editDialogVisible.value = true
  void loadRuleNameOptions()
}

function openEditDialog(group: RuleGroup) {
  if (filters.value.keyword || filters.value.isActive !== '') {
    ElMessage.warning('请先清除关键词和启用状态筛选，再编辑规则组，以确保加载完整关键词')
    return
  }

  editMode.value = 'edit'
  selectedRule.value = {
    id: group.id,
    ruleName: group.ruleName,
    categoryResult: group.categoryResult,
    keywords: [...group.keywords],
  }
  editDialogVisible.value = true
  void loadRuleNameOptions()
}

async function handleRuleSubmit(value: RuleFormValue) {
  try {
    if (editMode.value === 'create') {
      if (value.keywords.length === 0) {
        ElMessage.error('请填写匹配关键词')
        return
      }

      await createRule({
        ruleName: value.ruleName,
        categoryResult: value.categoryResult,
        keywords: value.keywords,
        isActive: true,
      })
      ElMessage.success('规则组新增成功')
    } else if (value.id) {
      await updateRuleGroup(value.id, {
        ruleName: value.ruleName,
        categoryResult: value.categoryResult,
        keywords: value.keywords,
      })
      ElMessage.success(value.renamed ? '规则组已重命名' : '规则组编辑成功')
    }

    editDialogVisible.value = false
    await refreshRuleData()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存规则失败')
  }
}

async function handleRuleStatusUpdate(group: RuleGroup, isActive: boolean) {
  try {
    await updateGroupStatus(group.id, isActive)
    ElMessage.success(isActive ? '规则组已启用' : '规则组已停用')
    await loadRules()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '更新规则状态失败')
  }
}

async function handleRuleRemove(group: RuleGroup) {
  try {
    const isKeywordSubsetDisplayed = Boolean(
      filters.value.keyword || filters.value.isActive !== '',
    )
    const keywordDescription = isKeywordSubsetDisplayed
      ? '将永久删除该组全部关键词，无法恢复。'
      : `将永久删除 ${group.keywords.length} 个关键词（${group.keywords.join('、')}），无法恢复。`

    await ElMessageBox.confirm(
      `确定删除“${group.ruleName}”规则组？${keywordDescription}`,
      '删除规则组',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    await removeRuleGroup(group.id)
    ElMessage.success('规则组已删除')
    await refreshRuleData()

    if (rules.value.length === 0 && page.value > 1 && total.value > 0) {
      await changePage(page.value - 1)
    }
  } catch (error) {
    if (error instanceof Error && error.message !== 'cancel') {
      ElMessage.error(error.message)
    }
  }
}

async function handleLastKeywordRemove(value: RuleFormValue) {
  if (!value.id) {
    return
  }

  try {
    const ruleName = selectedRule.value?.ruleName || value.ruleName
    const keyword = value.keywords[0] || '当前关键词'

    await ElMessageBox.confirm(
      `确定删除“${ruleName}”规则组？当前编辑中仅剩关键词“${keyword}”。继续操作将永久删除整个规则组及全部已保存关键词，无法恢复。`,
      '删除规则组',
      {
        confirmButtonText: '删除规则组',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    await removeRuleGroup(value.id)
    editDialogVisible.value = false
    ElMessage.success('规则组已删除')
    await refreshRuleData()

    if (rules.value.length === 0 && page.value > 1 && total.value > 0) {
      await changePage(page.value - 1)
    }
  } catch (error) {
    if (error instanceof Error && error.message !== 'cancel') {
      ElMessage.error(error.message)
    }
  }
}

async function handleSearch(filters: RuleFilters) {
  await searchRules(filters)
}

async function handleResetFilters() {
  await resetFilters()
}

onMounted(refreshRuleData)
</script>

<template>
  <section class="rules-page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">
          RULE MANAGEMENT
        </p>
        <h1>
          规则管理
        </h1>
        <p class="subtitle">
          维护商品品类关键词规则。启用规则优先于 AI 辅助判断。
        </p>
      </div>
      <div class="heading-actions">
        <el-button @click="openTestDialog">
          规则测试
        </el-button>
        <el-button
          type="primary"
          @click="openCreateDialog"
        >
          新增品类规则
        </el-button>
      </div>
    </div>

    <el-alert
      title="品类规则命中后将直接使用配置结论；未命中的商品交由 AI 辅助判断，无法可靠判断时进入“存疑”。"
      type="info"
      :closable="false"
      show-icon
    />

    <el-alert
      v-if="loadError || summaryLoadError"
      class="load-error"
      :title="loadError || summaryLoadError"
      type="error"
      :closable="false"
      show-icon
    />

    <RuleStatsCards
      :rule-total="summary.ruleTotal"
      :keyword-total="summary.keywordTotal"
      :reimbursable-rule-count="summary.reimbursableRuleCount"
      :uncertain-rule-count="summary.uncertainRuleCount"
      :non-reimbursable-rule-count="summary.nonReimbursableRuleCount"
    />

    <RuleFilterBar
      :loading="listLoading"
      @search="handleSearch"
      @reset="handleResetFilters"
    />

    <RuleTable
      :rules="rules"
      :loading="listLoading"
      :page="page"
      :page-size="pageSize"
      :total="total"
      :updating-status-id="updatingStatusId"
      :deleting-id="deletingId"
      @edit="openEditDialog"
      @remove="handleRuleRemove"
      @show-logs="openLogDialog"
      @update-status="handleRuleStatusUpdate"
      @page-change="changePage"
    />

    <RuleFixedRules />

    <RuleEditDialog
      v-model="editDialogVisible"
      :mode="editMode"
      :rule="selectedRule"
      :submitting="submitting"
      :rule-name-options="ruleNameOptions"
      @remove-last-keyword="handleLastKeywordRemove"
      @submit="handleRuleSubmit"
    />

    <RuleTestDialog
      v-model="testDialogVisible"
      :loading="testLoading"
      :error="testError"
      :result="testResult"
      @test="testMatch"
    />

    <RuleLogDialog
      v-model="logDialogVisible"
      :loading="logLoading"
      :error="logError"
      :logs="logs"
    />
  </section>
</template>

<style scoped>
.rules-page {
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

.heading-actions {
  display: flex;
  gap: 12px;
}

.load-error {
  margin-top: 20px;
}

@media (max-width: 640px) {
  .page-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .heading-actions {
    width: 100%;
  }

  .heading-actions .el-button {
    flex: 1;
  }
}
</style>
