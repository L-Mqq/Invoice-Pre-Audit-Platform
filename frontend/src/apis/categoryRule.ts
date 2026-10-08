import axios from 'axios'
import http from '../utils/http'

export type CategoryResult = '可以' | '存疑' | '不可以'
export type CategoryRuleOperation =
  | 'create_category_rule'
  | 'update_category_rule'
  | 'update_category_rule_group'
  | 'update_category_rule_status'
  | 'delete_category_rule'

export interface CategoryRule {
  id: number
  ruleName: string
  keyword: string
  categoryResult: CategoryResult
  isActive: boolean
  createdBy: number | null
  createdAt: string
  updatedAt: string
}

export interface CategoryRuleListQuery {
  page: number
  pageSize: number
  keyword?: string
  categoryResult?: CategoryResult
  isActive?: boolean
}

export interface CategoryRuleListResponse {
  items: CategoryRule[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export interface CategoryRuleSummary {
  ruleTotal: number
  keywordTotal: number
  reimbursableRuleCount: number
  uncertainRuleCount: number
  nonReimbursableRuleCount: number
}

export interface CategoryRuleNameOption {
  ruleName: string
  categoryResult: CategoryResult
}

export interface CategoryRulePayload {
  ruleName: string
  keyword: string
  categoryResult: CategoryResult
}

export interface CreateCategoryRulePayload extends CategoryRulePayload {
  isActive?: boolean
}

export interface CategoryRuleGroupPayload {
  ruleName: string
  categoryResult: CategoryResult
  keywords: string[]
}

export interface CategoryRuleGroup {
  id: number
  ruleName: string
  categoryResult: CategoryResult
  isActive: boolean
  keywords: string[]
}

export interface CategoryRuleTestResult {
  itemName: string
  normalizedItemName: string
  matchedRule: {
    id: number
    ruleName: string
    keyword: string
    categoryResult: CategoryResult
  } | null
  categoryResult: CategoryResult | null
  source: 'rule' | 'ai_fallback_required'
  message: string
}

export interface CategoryRuleLogQuery {
  page: number
  pageSize: number
  ruleId?: number
  operationType?: CategoryRuleOperation
  operatorId?: number
  startAt?: string
  endAt?: string
}

export interface CategoryRuleLogItem {
  id: number
  ruleId: number
  operationType: CategoryRuleOperation
  operatorId: number | null
  operatorName: string | null
  beforeData: Record<string, unknown> | null
  afterData: Record<string, unknown> | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

export interface CategoryRuleLogResponse {
  items: CategoryRuleLogItem[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

function getErrorMessage(error: unknown, fallback: string): Error {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return new Error(error.response?.data?.message || fallback)
  }

  if (error instanceof Error) {
    return error
  }

  return new Error(fallback)
}

// 获取规则列表
export async function getCategoryRules(
  query: CategoryRuleListQuery,
): Promise<CategoryRuleListResponse> {
  try {
    const response = await http.get<{
      success: boolean
      data: CategoryRuleListResponse
    }>('/category-rules', {
      params: query,
    })

    return response.data.data
  } catch (error) {
    throw getErrorMessage(error, '获取规则列表失败')
  }
}

// 获取规则统计
export async function getCategoryRuleSummary(): Promise<CategoryRuleSummary> {
  try {
    const response = await http.get<{
      success: boolean
      data: CategoryRuleSummary
    }>('/category-rules/summary')

    return response.data.data
  } catch (error) {
    throw getErrorMessage(error, '获取规则统计失败')
  }
}

// 获取可选规则名称
export async function getCategoryRuleNameOptions(
  keyword?: string,
): Promise<CategoryRuleNameOption[]> {
  try {
    const response = await http.get<{
      success: boolean
      data: CategoryRuleNameOption[]
    }>('/category-rules/names', {
      params: keyword
        ? {
          keyword,
        }
        : undefined,
    })

    return response.data.data
  } catch (error) {
    throw getErrorMessage(error, '获取规则名称失败')
  }
}

// 新增规则
export async function createCategoryRule(
  payload: CreateCategoryRulePayload,
): Promise<CategoryRule> {
  try {
    const response = await http.post<{
      success: boolean
      data: CategoryRule
    }>('/category-rules', payload)

    return response.data.data
  } catch (error) {
    throw getErrorMessage(error, '新增规则失败')
  }
}

// 编辑规则
export async function updateCategoryRule(
  ruleId: number,
  payload: CategoryRulePayload,
): Promise<CategoryRule> {
  try {
    const response = await http.patch<{
      success: boolean
      data: CategoryRule
    }>(`/category-rules/${ruleId}`, payload)

    return response.data.data
  } catch (error) {
    throw getErrorMessage(error, '编辑规则失败')
  }
}

// 编辑同一规则名称下的全部关键词。
export async function updateCategoryRuleGroup(
  ruleId: number,
  payload: CategoryRuleGroupPayload,
): Promise<CategoryRuleGroup> {
  try {
    const response = await http.patch<{
      success: boolean
      data: CategoryRuleGroup
    }>(`/category-rules/${ruleId}/group`, payload)

    return response.data.data
  } catch (error) {
    throw getErrorMessage(error, '编辑规则组失败')
  }
}

// 更新规则状态
export async function updateCategoryRuleStatus(
  ruleId: number,
  isActive: boolean,
): Promise<CategoryRule> {
  try {
    const response = await http.patch<{
      success: boolean
      data: CategoryRule
    }>(`/category-rules/${ruleId}/status`, {
      isActive,
    })

    return response.data.data
  } catch (error) {
    throw getErrorMessage(error, '更新规则状态失败')
  }
}

// 删除规则
export async function deleteCategoryRule(ruleId: number): Promise<void> {
  try {
    await http.delete(`/category-rules/${ruleId}`)
  } catch (error) {
    throw getErrorMessage(error, '删除规则失败')
  }
}

// 测试规则匹配
export async function testCategoryRuleMatch(
  itemName: string,
): Promise<CategoryRuleTestResult> {
  try {
    const response = await http.post<{
      success: boolean
      data: CategoryRuleTestResult
    }>('/category-rules/test-match', {
      itemName,
    })

    return response.data.data
  } catch (error) {
    throw getErrorMessage(error, '测试规则匹配失败')
  }
}

// 获取规则操作日志
export async function getCategoryRuleLogs(
  query: CategoryRuleLogQuery,
): Promise<CategoryRuleLogResponse> {
  try {
    const response = await http.get<{
      success: boolean
      data: CategoryRuleLogResponse
    }>('/category-rules/logs', {
      params: query,
    })

    return response.data.data
  } catch (error) {
    throw getErrorMessage(error, '获取规则操作日志失败')
  }
}
