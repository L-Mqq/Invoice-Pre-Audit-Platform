<script setup lang="ts">
import {
  reactive,
} from 'vue'

const emit = defineEmits<{
  search: [filters: RuleFilters]
  reset: []
}>()

defineProps<{
  loading: boolean
}>()

export interface RuleFilters {
  keyword: string
  categoryResult: '' | '可以' | '存疑' | '不可以'
  isActive: '' | 'active' | 'inactive'
}

const filters = reactive<RuleFilters>({
  keyword: '',
  categoryResult: '',
  isActive: '',
})

function handleSearch() {
  emit('search', {
    keyword: filters.keyword,
    categoryResult: filters.categoryResult,
    isActive: filters.isActive,
  })
}

function handleReset() {
  filters.keyword = ''
  filters.categoryResult = ''
  filters.isActive = ''
  emit('reset')
}
</script>

<template>
  <el-card
    class="filter-card"
    shadow="never"
  >
    <div class="filter-heading">
      <strong>筛选规则</strong>
      <el-button
        link
        @click="handleReset"
      >
        重置筛选
      </el-button>
    </div>
    <div class="filter-grid">
      <el-input
        v-model="filters.keyword"
        placeholder="搜索规则名称或关键词"
        clearable
      />
      <el-select
        v-model="filters.categoryResult"
        placeholder="品类结论"
        clearable
      >
        <el-option
          label="可以"
          value="可以"
        />
        <el-option
          label="存疑"
          value="存疑"
        />
        <el-option
          label="不可以"
          value="不可以"
        />
      </el-select>
      <el-select
        v-model="filters.isActive"
        placeholder="启用状态"
        clearable
      >
        <el-option
          label="已启用"
          value="active"
        />
        <el-option
          label="已停用"
          value="inactive"
        />
      </el-select>
      <el-button
        type="primary"
        :loading="loading"
        @click="handleSearch"
      >
        查询
      </el-button>
    </div>
  </el-card>
</template>

<style scoped>
.filter-card {
  margin-bottom: 20px;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
}

.filter-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.filter-grid {
  display: grid;
  grid-template-columns: minmax(240px, 2fr) repeat(2, minmax(150px, 1fr)) auto;
  gap: 12px;
  margin-top: 16px;
}

@media (max-width: 1000px) {
  .filter-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .filter-grid {
    grid-template-columns: 1fr;
  }
}
</style>
