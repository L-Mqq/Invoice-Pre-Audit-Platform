import {
  ref,
} from 'vue'
import {
  createCategoryRuleGroup,
  deleteCategoryRuleGroup,
  updateCategoryRuleGroup,
  updateCategoryRuleGroupStatus,
  type CategoryRuleGroup,
  type CreateCategoryRuleGroupPayload,
  type CreateCategoryRuleGroupResult,
  type CategoryRuleGroupDeleteResult,
  type CategoryRuleGroupPayload,
  type CategoryRuleGroupStatusResult,
} from '../../../apis/categoryRule'

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '规则操作失败'
}

export function useCategoryRuleActions() {
  const submitting = ref(false)
  const updatingGroupId = ref<number | null>(null)
  const updatingStatusId = ref<number | null>(null)
  const deletingId = ref<number | null>(null)

  async function createRule(
    payload: CreateCategoryRuleGroupPayload,
  ): Promise<CreateCategoryRuleGroupResult> {
    submitting.value = true

    try {
      return await createCategoryRuleGroup(payload)
    } catch (error) {
      throw new Error(getErrorMessage(error))
    } finally {
      submitting.value = false
    }
  }

  async function updateRuleGroup(
    ruleId: number,
    payload: CategoryRuleGroupPayload,
  ): Promise<CategoryRuleGroup> {
    updatingGroupId.value = ruleId
    submitting.value = true

    try {
      return await updateCategoryRuleGroup(ruleId, payload)
    } catch (error) {
      throw new Error(getErrorMessage(error))
    } finally {
      submitting.value = false
      updatingGroupId.value = null
    }
  }

  async function updateGroupStatus(
    ruleId: number,
    isActive: boolean,
  ): Promise<CategoryRuleGroupStatusResult> {
    updatingStatusId.value = ruleId

    try {
      return await updateCategoryRuleGroupStatus(ruleId, isActive)
    } catch (error) {
      throw new Error(getErrorMessage(error))
    } finally {
      updatingStatusId.value = null
    }
  }

  async function removeRuleGroup(
    ruleId: number,
  ): Promise<CategoryRuleGroupDeleteResult> {
    deletingId.value = ruleId

    try {
      return await deleteCategoryRuleGroup(ruleId)
    } catch (error) {
      throw new Error(getErrorMessage(error))
    } finally {
      deletingId.value = null
    }
  }

  return {
    createRule,
    deletingId,
    removeRuleGroup,
    submitting,
    updateRuleGroup,
    updateGroupStatus,
    updatingGroupId,
    updatingStatusId,
  }
}
