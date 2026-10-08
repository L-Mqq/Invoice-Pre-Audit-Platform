<script setup lang="ts">
import {
  computed,
} from 'vue'
import type {
  CategoryResult,
  CategoryRule,
} from '../../../apis/categoryRule'

export interface RuleGroup {
  id: number
  ruleName: string
  keywords: string[]
  categoryResult: CategoryResult
  isActive: boolean
  hasMixedStatus: boolean
}

const props = defineProps<{
  rules: CategoryRule[]
  loading: boolean
  page: number
  pageSize: number
  total: number
  updatingStatusId: number | null
  deletingId: number | null
}>()

const emit = defineEmits<{
  edit: [group: RuleGroup]
  remove: [group: RuleGroup]
  showLogs: []
  updateStatus: [group: RuleGroup, isActive: boolean]
  pageChange: [page: number]
}>()

function getCategoryTagType(result: CategoryRule['categoryResult']) {
  if (result === '可以') {
    return 'success'
  }

  if (result === '不可以') {
    return 'danger'
  }

  return 'warning'
}

const groupedRules = computed<RuleGroup[]>(() => {
  const ruleGroups = new Map<string, RuleGroup>()

  props.rules.forEach((rule) => {
    const existingRule = ruleGroups.get(rule.ruleName)

    if (!existingRule) {
      ruleGroups.set(rule.ruleName, {
        ...rule,
        keywords: [rule.keyword],
        hasMixedStatus: false,
      })
      return
    }

    if (!existingRule.keywords.includes(rule.keyword)) {
      existingRule.keywords.push(rule.keyword)
    }

    if (existingRule.isActive !== rule.isActive) {
      existingRule.hasMixedStatus = true
    }
  })

  return Array.from(ruleGroups.values())
})
</script>

<template>
  <el-card
    class="table-card"
    shadow="never"
  >
    <div class="table-heading">
      <div>
        <strong>品类规则列表</strong>
        <span>共 {{ total }} 条规则</span>
      </div>
      <el-button
        link
        @click="emit('showLogs')"
      >
        查看操作记录
      </el-button>
    </div>

    <el-table
      v-loading="loading"
      :data="groupedRules"
      row-key="id"
      stripe
    >
      <el-table-column
        label="规则名称"
        min-width="150"
      >
        <template #default="{ row }">
          <strong>{{ row.ruleName }}</strong>
        </template>
      </el-table-column>
      <el-table-column
        prop="keyword"
        label="匹配关键词"
        min-width="260"
      >
        <template #default="{ row }">
          <div class="keyword-list">
            <span
              v-for="keyword in row.keywords"
              :key="keyword"
              class="keyword"
            >
              {{ keyword }}
            </span>
          </div>
        </template>
      </el-table-column>
      <el-table-column
        label="品类结论"
        width="130"
      >
        <template #default="{ row }">
          <el-tag
            :type="getCategoryTagType(row.categoryResult)"
            effect="plain"
            class="category-tag"
          >
            {{ row.categoryResult }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="状态"
        width="120"
      >
        <template #default="{ row }">
          <div class="status-control">
            <el-switch
              :model-value="row.isActive"
              :loading="updatingStatusId === row.id"
              :disabled="updatingStatusId !== null"
              aria-label="切换规则启用状态"
              @update:model-value="emit('updateStatus', row, $event)"
            />
            <span
              class="status-text"
              :class="{
                'is-active': row.isActive,
              }"
              :aria-label="row.isActive ? '启用' : '停用'"
            ></span>
          </div>
        </template>
      </el-table-column>
      <el-table-column
        label="操作"
        width="120"
        fixed="right"
      >
        <template #default="{ row }">
          <el-button
            link
            type="primary"
            :disabled="deletingId !== null || updatingStatusId !== null"
            @click="emit('edit', row)"
          >
            编辑
          </el-button>
          <el-button
            link
            type="danger"
            :loading="deletingId === row.id"
            :disabled="deletingId !== null || updatingStatusId !== null"
            @click="emit('remove', row)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <p class="table-note">
      多个规则同时命中时，系统会按既定匹配顺序采用其中一条规则。
    </p>
    <div class="pagination">
      <span>第 {{ page }} 页</span>
      <el-pagination
        background
        layout="prev, pager, next"
        :current-page="page"
        :page-size="pageSize"
        :total="total"
        @current-change="emit('pageChange', $event)"
      />
    </div>
  </el-card>
</template>

<style scoped>
.table-card {
  margin-bottom: 20px;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
}

.table-heading,
.table-heading > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
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

.keyword {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 5px;
  background: #f1f5f9;
  color: #334155;
  font-size: 13px;
}

.keyword-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.category-tag + .category-tag {
  margin-left: 6px;
}

.status-control {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.status-text {
  color: #94a3b8;
  font-size: 13px;
}

.status-text::before {
  content: '停用';
}

.status-text.is-active {
  color: #2563eb;
}

.status-text.is-active::before {
  content: '启用';
}

.table-note {
  margin: 16px 0 0;
  color: #64748b;
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
</style>
