import {
  ref,
} from 'vue'
import {
  getCategoryRuleLogs,
  type CategoryRuleLogItem,
  type CategoryRuleOperation,
} from '../../../apis/categoryRule'

export interface CategoryRuleLogFilters {
  operationType: '' | CategoryRuleOperation
  operationDate: string
}

function createDefaultFilters(): CategoryRuleLogFilters {
  return {
    operationType: '',
    operationDate: '',
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '获取规则操作日志失败'
}

export function useCategoryRuleLogs() {
  const visible = ref(false)
  const loading = ref(false)
  const error = ref('')
  const logs = ref<CategoryRuleLogItem[]>([])
  const page = ref(1)
  const pageSize = ref(20)
  const total = ref(0)
  const filters = ref<CategoryRuleLogFilters>(createDefaultFilters())

  async function loadLogs() {
    loading.value = true
    error.value = ''

    try {
      const result = await getCategoryRuleLogs({
        page: page.value,
        pageSize: pageSize.value,
        operationType: filters.value.operationType || undefined,
        startAt: filters.value.operationDate || undefined,
        endAt: filters.value.operationDate || undefined,
      })

      logs.value = result.items
      total.value = result.pagination.total
    } catch (requestError) {
      error.value = getErrorMessage(requestError)
      logs.value = []
      total.value = 0
    } finally {
      loading.value = false
    }
  }

  async function openLogDialog() {
    visible.value = true
    page.value = 1
    filters.value = createDefaultFilters()
    await loadLogs()
  }

  async function searchLogs(nextFilters: CategoryRuleLogFilters) {
    filters.value = {
      operationType: nextFilters.operationType,
      operationDate: nextFilters.operationDate,
    }
    page.value = 1
    await loadLogs()
  }

  async function resetLogFilters() {
    filters.value = createDefaultFilters()
    page.value = 1
    await loadLogs()
  }

  async function changePage(nextPage: number) {
    page.value = nextPage
    await loadLogs()
  }

  return {
    changePage,
    error,
    filters,
    loading,
    logs,
    openLogDialog,
    page,
    pageSize,
    resetLogFilters,
    searchLogs,
    total,
    visible,
  }
}
