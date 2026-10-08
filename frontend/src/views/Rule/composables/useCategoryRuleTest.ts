import {
  ref,
} from 'vue'
import {
  testCategoryRuleMatch,
  type CategoryRuleTestResult,
} from '../../../apis/categoryRule'

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '测试规则匹配失败'
}

export function useCategoryRuleTest() {
  const visible = ref(false)
  const loading = ref(false)
  const result = ref<CategoryRuleTestResult | null>(null)
  const error = ref('')

  function openTestDialog() {
    result.value = null
    error.value = ''
    visible.value = true
  }

  async function testMatch(itemName: string) {
    loading.value = true
    error.value = ''

    try {
      result.value = await testCategoryRuleMatch(itemName)
    } catch (requestError) {
      error.value = getErrorMessage(requestError)
      result.value = null
    } finally {
      loading.value = false
    }
  }

  return {
    error,
    loading,
    openTestDialog,
    result,
    testMatch,
    visible,
  }
}
