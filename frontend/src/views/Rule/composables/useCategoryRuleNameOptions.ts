import {
  ref,
} from 'vue'
import {
  getCategoryRuleNameOptions,
  type CategoryRuleNameOption,
} from '../../../apis/categoryRule'

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '获取规则名称失败'
}

export function useCategoryRuleNameOptions() {
  const options = ref<CategoryRuleNameOption[]>([])
  const loading = ref(false)
  const loadError = ref('')

  async function loadOptions(keyword = '') {
    loading.value = true
    loadError.value = ''

    try {
      options.value = await getCategoryRuleNameOptions(keyword.trim() || undefined)
    } catch (error) {
      loadError.value = getErrorMessage(error)
    } finally {
      loading.value = false
    }
  }

  return {
    loadError,
    loading,
    loadOptions,
    options,
  }
}
