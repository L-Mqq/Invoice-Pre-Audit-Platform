import {
  computed,
  ref,
} from 'vue'
import {
  getFinanceWeekInvoices,
  getFinanceWeeks,
  submitFinanceWeek,
  type FinanceWeekInvoice,
  type FinanceWeekGroup,
  type FinanceWeeksResponse,
} from '../../../apis/finance'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return '获取财务组列表失败'
}

export function useFinanceProgress() {
  const groups = ref<FinanceWeekGroup[]>([])
  const groupInvoiceDetails = ref<Record<string, FinanceWeekInvoice[]>>({})
  const groupInvoiceErrors = ref<Record<string, string>>({})
  const groupInvoiceLoading = ref<Record<string, boolean>>({})
  const loading = ref(false)
  const loadError = ref('')
  const submittingGroupKey = ref('')
  const summary = ref<FinanceWeeksResponse['summary']>({
    pendingGroupCount: 0,
    submittedGroupCount: 0,
  })

  const hasGroups = computed(() => groups.value.length > 0)

  function getGroupKey(group: FinanceWeekGroup): string {
    return `${group.sellerTaxId}-${group.weekStart}`
  }

  async function loadFinanceWeeks() {
    loading.value = true
    loadError.value = ''

    try {
      const result = await getFinanceWeeks()

      groups.value = result.items
      summary.value = result.summary
      groupInvoiceDetails.value = {}
      groupInvoiceErrors.value = {}
      groupInvoiceLoading.value = {}
    } catch (error) {
      groups.value = []
      summary.value = {
        pendingGroupCount: 0,
        submittedGroupCount: 0,
      }
      loadError.value = getErrorMessage(error)
    } finally {
      loading.value = false
    }
  }

  async function loadGroupInvoices(group: FinanceWeekGroup) {
    const groupKey = getGroupKey(group)

    if (groupInvoiceDetails.value[groupKey]) {
      return
    }

    groupInvoiceLoading.value[groupKey] = true
    groupInvoiceErrors.value[groupKey] = ''

    try {
      const result = await getFinanceWeekInvoices(
        group.sellerTaxId,
        group.weekStart,
      )

      groupInvoiceDetails.value[groupKey] = result.items
    } catch (error) {
      groupInvoiceErrors.value[groupKey] = getErrorMessage(error)
    } finally {
      groupInvoiceLoading.value[groupKey] = false
    }
  }

  async function submitFinanceGroup(group: FinanceWeekGroup) {
    if (!group.canSubmitFinance) {
      throw new Error(group.submitBlockedReason || '当前财务组暂不满足提交条件')
    }

    const groupKey = getGroupKey(group)

    if (submittingGroupKey.value) {
      throw new Error('已有财务组正在提交，请稍候')
    }

    submittingGroupKey.value = groupKey

    try {
      const result = await submitFinanceWeek({
        sellerTaxId: group.sellerTaxId,
        cumulativeWeekStart: group.weekStart,
      })

      await loadFinanceWeeks()

      return result
    } finally {
      submittingGroupKey.value = ''
    }
  }

  return {
    groups,
    groupInvoiceDetails,
    groupInvoiceErrors,
    groupInvoiceLoading,
    getGroupKey,
    hasGroups,
    loadError,
    loading,
    loadFinanceWeeks,
    loadGroupInvoices,
    submitFinanceGroup,
    submittingGroupKey,
    summary,
  }
}
