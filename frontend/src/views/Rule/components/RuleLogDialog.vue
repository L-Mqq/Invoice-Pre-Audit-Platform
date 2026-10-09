<script setup lang="ts">
import type {
  CategoryRuleLogItem,
} from '../../../apis/categoryRule'

defineProps<{
  modelValue: boolean
  loading: boolean
  error: string
  logs: CategoryRuleLogItem[]
}>()

const emit = defineEmits<{
  'update:modelValue': [visible: boolean]
}>()

function handleClose() {
  emit('update:modelValue', false)
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
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="规则操作记录"
    width="min(980px, 94vw)"
    @close="handleClose"
  >
    <el-alert
      v-if="error"
      :title="error"
      type="error"
      :closable="false"
      show-icon
    />
    <el-table
      v-else
      v-loading="loading"
      :data="logs"
      max-height="520"
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
        prop="createdAt"
        label="操作时间"
        min-width="170"
      />
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
    <template #footer>
      <el-button @click="handleClose">
        关闭
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
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
