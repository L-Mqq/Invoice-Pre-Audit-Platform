import {
  ref,
} from 'vue'
import {
  getCategoryRuleSummary,
  type CategoryRuleSummary,
} from '../../../apis/categoryRule'

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '获取规则统计失败'
}

export function useCategoryRuleSummary() {
  const summary = ref<CategoryRuleSummary>({
    ruleTotal: 0,
    keywordTotal: 0,
    reimbursableRuleCount: 0,
    uncertainRuleCount: 0,
    nonReimbursableRuleCount: 0,
  })
  const loading = ref(false)
  const loadError = ref('')

  async function loadSummary() {
    loading.value = true
    loadError.value = ''

    try {
      summary.value = await getCategoryRuleSummary()
    } catch (error) {
      loadError.value = getErrorMessage(error)
    } finally {
      loading.value = false
    }
  }

  return {
    loadError,
    loading,
    loadSummary,
    summary,
  }
}
