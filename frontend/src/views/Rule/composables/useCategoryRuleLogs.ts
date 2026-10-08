import {
  ref,
} from 'vue'
import {
  getCategoryRuleLogs,
  type CategoryRuleLogItem,
} from '../../../apis/categoryRule'

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '获取规则操作日志失败'
}

export function useCategoryRuleLogs() {
  const visible = ref(false)
  const loading = ref(false)
  const error = ref('')
  const logs = ref<CategoryRuleLogItem[]>([])

  async function openLogDialog() {
    visible.value = true
    loading.value = true
    error.value = ''

    try {
      const result = await getCategoryRuleLogs({
        page: 1,
        pageSize: 50,
      })

      logs.value = result.items
    } catch (requestError) {
      error.value = getErrorMessage(requestError)
      logs.value = []
    } finally {
      loading.value = false
    }
  }

  return {
    error,
    loading,
    logs,
    openLogDialog,
    visible,
  }
}
