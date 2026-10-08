import {
  ref,
} from 'vue'
import {
  createCategoryRule,
  deleteCategoryRule,
  updateCategoryRule,
  updateCategoryRuleStatus,
  type CategoryRule,
  type CategoryRulePayload,
  type CreateCategoryRulePayload,
} from '../../../apis/categoryRule'

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '规则操作失败'
}

export function useCategoryRuleActions() {
  const submitting = ref(false)
  const updatingStatusId = ref<number | null>(null)
  const deletingId = ref<number | null>(null)

  async function createRule(
    payload: CreateCategoryRulePayload,
  ): Promise<CategoryRule> {
    submitting.value = true

    try {
      return await createCategoryRule(payload)
    } catch (error) {
      throw new Error(getErrorMessage(error))
    } finally {
      submitting.value = false
    }
  }

  async function updateRule(
    ruleId: number,
    payload: CategoryRulePayload,
  ): Promise<CategoryRule> {
    submitting.value = true

    try {
      return await updateCategoryRule(ruleId, payload)
    } catch (error) {
      throw new Error(getErrorMessage(error))
    } finally {
      submitting.value = false
    }
  }

  async function updateStatus(
    ruleId: number,
    isActive: boolean,
  ): Promise<CategoryRule> {
    updatingStatusId.value = ruleId

    try {
      return await updateCategoryRuleStatus(ruleId, isActive)
    } catch (error) {
      throw new Error(getErrorMessage(error))
    } finally {
      updatingStatusId.value = null
    }
  }

  async function removeRule(ruleId: number): Promise<void> {
    deletingId.value = ruleId

    try {
      await deleteCategoryRule(ruleId)
    } catch (error) {
      throw new Error(getErrorMessage(error))
    } finally {
      deletingId.value = null
    }
  }

  return {
    createRule,
    deletingId,
    removeRule,
    submitting,
    updateRule,
    updateStatus,
    updatingStatusId,
  }
}
