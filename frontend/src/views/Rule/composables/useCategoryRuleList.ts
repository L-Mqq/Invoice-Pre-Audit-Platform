import {
  ref,
} from 'vue'
import {
  getCategoryRules,
  type CategoryResult,
  type CategoryRuleGroup,
} from '../../../apis/categoryRule'

export interface CategoryRuleFilters {
  keyword: string
  categoryResult: '' | CategoryResult
  isActive: '' | 'active' | 'inactive'
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '获取规则列表失败'
}

export function useCategoryRuleList() {
  const rules = ref<CategoryRuleGroup[]>([])
  const loading = ref(false)
  const loadError = ref('')
  const page = ref(1)
  const pageSize = ref(10)
  const total = ref(0)
  const filters = ref<CategoryRuleFilters>({
    keyword: '',
    categoryResult: '',
    isActive: '',
  })

  async function loadRules() {
    loading.value = true
    loadError.value = ''

    try {
      const result = await getCategoryRules({
        page: page.value,
        pageSize: pageSize.value,
        keyword: filters.value.keyword || undefined,
        categoryResult: filters.value.categoryResult || undefined,
        isActive: filters.value.isActive === ''
          ? undefined
          : filters.value.isActive === 'active',
      })

      rules.value = result.items
      total.value = result.pagination.total
    } catch (error) {
      loadError.value = getErrorMessage(error)
    } finally {
      loading.value = false
    }
  }

  async function searchRules(nextFilters: CategoryRuleFilters) {
    filters.value = nextFilters
    page.value = 1
    await loadRules()
  }

  async function resetFilters() {
    filters.value = {
      keyword: '',
      categoryResult: '',
      isActive: '',
    }
    page.value = 1
    await loadRules()
  }

  async function changePage(nextPage: number) {
    page.value = nextPage
    await loadRules()
  }

  return {
    changePage,
    filters,
    loadError,
    loading,
    loadRules,
    page,
    pageSize,
    resetFilters,
    rules,
    searchRules,
    total,
  }
}
