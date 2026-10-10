<script setup lang="ts">
import {
  reactive,
  watch,
} from 'vue'
import type {
  CategoryRuleLogItem,
  CategoryRuleOperation,
} from '../../../apis/categoryRule'
import type {
  CategoryRuleLogFilters,
} from '../composables/useCategoryRuleLogs'
import {
  formatChinaDateTime,
} from '../../../utils/date'

const props = defineProps<{
  modelValue: boolean
  loading: boolean
  error: string
  logs: CategoryRuleLogItem[]
  page: number
  pageSize: number
  total: number
}>()

const emit = defineEmits<{
  'update:modelValue': [visible: boolean]
  pageChange: [page: number]
  reset: []
  search: [filters: CategoryRuleLogFilters]
}>()

const filters = reactive<CategoryRuleLogFilters>({
  operationType: '',
  operationDate: '',
})

const operationOptions: Array<{
  value: CategoryRuleOperation
  label: string
}> = [
  {
    value: 'create_category_rule',
    label: '新增规则',
  },
  {
    value: 'create_category_rule_group',
    label: '新增规则组',
  },
  {
    value: 'update_category_rule',
    label: '编辑规则',
  },
  {
    value: 'update_category_rule_group',
    label: '编辑规则组',
  },
  {
    value: 'update_category_rule_status',
    label: '状态切换',
  },
  {
    value: 'update_category_rule_group_status',
    label: '规则组状态切换',
  },
  {
    value: 'delete_category_rule',
    label: '删除规则',
  },
  {
    value: 'delete_category_rule_group',
    label: '删除规则组',
  },
]

function handleClose() {
  emit('update:modelValue', false)
}

function handleSearch() {
  emit('search', {
    operationType: filters.operationType,
    operationDate: filters.operationDate,
  })
}

function handleReset() {
  filters.operationType = ''
  filters.operationDate = ''
  emit('reset')
}

function getOperationLabel(operation: CategoryRuleLogItem['operationType']) {
  const labels: Record<CategoryRuleLogItem['operationType'], string> = {
    create_category_rule: '新增规则',
    create_category_rule_group: '新增规则组',
    update_category_rule: '编辑规则',
    update_category_rule_group: '编辑规则组',
    update_category_rule_status: '状态切换',
    update_category_rule_group_status: '规则组状态切换',
    delete_category_rule: '删除规则',
    delete_category_rule_group: '删除规则组',
  }

  return labels[operation]
}

function formatSnapshot(value: Record<string, unknown> | null) {
  return value ? JSON.stringify(value, null, 2) : '-'
}

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) {
      return
    }

    filters.operationType = ''
    filters.operationDate = ''
  },
)
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    class="rule-log-dialog"
    title="规则操作记录"
    width="min(980px, 94vw)"
    append-to-body
    lock-scroll
    @close="handleClose"
  >
    <div class="log-filter-bar">
      <el-select
        v-model="filters.operationType"
        clearable
        placeholder="操作类型"
      >
        <el-option
          v-for="option in operationOptions"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
      <el-date-picker
        v-model="filters.operationDate"
        type="date"
        value-format="YYYY-MM-DD"
        placeholder="操作日期"
      />
      <el-button
        type="primary"
        :loading="loading"
        @click="handleSearch"
      >
        查询
      </el-button>
      <el-button
        :disabled="loading"
        @click="handleReset"
      >
        重置
      </el-button>
    </div>
    <el-alert
      v-if="error"
      :title="error"
      type="error"
      :closable="false"
      show-icon
    />
    <div
      v-else
      class="log-table-container"
    >
      <el-table
        v-loading="loading"
        :data="logs"
        empty-text="暂无操作记录"
      >
        <el-table-column
          label="操作"
          width="110"
        >
          <template #default="{ row }">
            {{ getOperationLabel(row.operationType) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="ruleId"
          label="规则 ID"
          width="90"
        />
        <el-table-column
          label="操作人"
          width="120"
        >
          <template #default="{ row }">
            {{ row.operatorName || '-' }}
          </template>
        </el-table-column>
        <el-table-column
          label="操作时间"
          min-width="170"
        >
          <template #default="{ row }">
            {{ formatChinaDateTime(row.createdAt) || '-' }}
          </template>
        </el-table-column>
        <el-table-column
          label="变更内容"
          min-width="160"
        >
          <template #default="{ row }">
            <el-popover
              placement="left"
              :width="420"
              trigger="click"
            >
              <template #reference>
                <el-button link type="primary">
                  查看快照
                </el-button>
              </template>
              <div class="snapshot-content">
                <strong>修改前</strong>
                <pre>{{ formatSnapshot(row.beforeData) }}</pre>
                <strong>修改后</strong>
                <pre>{{ formatSnapshot(row.afterData) }}</pre>
              </div>
            </el-popover>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <div class="log-pagination">
      <span>共 {{ total }} 条记录</span>
      <el-pagination
        background
        layout="prev, pager, next"
        :current-page="page"
        :page-size="pageSize"
        :total="total"
        @current-change="emit('pageChange', $event)"
      />
    </div>
    <template #footer>
      <el-button @click="handleClose">
        关闭
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
:deep(.rule-log-dialog) {
  max-height: calc(100vh - 32px);
}

:deep(.rule-log-dialog .el-dialog__body) {
  overflow: hidden;
}

.log-filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}

.log-filter-bar .el-select {
  width: 180px;
}

.log-table-container {
  max-height: calc(100vh - 340px);
  overflow-y: auto;
}

.log-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  color: #64748b;
  font-size: 13px;
}

.snapshot-content {
  display: flex;
  max-height: 420px;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
}

.snapshot-content pre {
  margin: 0;
  padding: 10px;
  overflow-x: auto;
  border-radius: 6px;
  background: #f8fafc;
  color: #475569;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
