import axios from 'axios'
import http from '../utils/http'

export interface OverviewPeriod {
  weekStart: string
  weekEnd: string
  generatedAt: string
}

export interface OverviewSummary {
  invoiceCount: number
  invoiceAmount: number
  pendingReviewCount: number
  pendingVoucherCount: number
  waitingGroupVouchersCount: number
  pendingManualCount: number
  approvedCount: number
  rejectedCount: number
  cancelledCount: number
  reimbursementFailedCount: number
}

export interface OverviewFinanceSummary {
  pendingGroupCount: number
  submittedGroupCount: number
  readyForFinanceGroupCount: number
  pendingWeeklyVoucherGroupCount: number
}

export type OverviewTodoType =
  | 'pending_review'
  | 'pending_voucher'
  | 'pending_manual'
  | 'ready_for_finance'
  | 'reimbursement_failed'

export interface OverviewTodo {
  type: OverviewTodoType
  count: number
}

export interface OverviewRecentOperation {
  id: number
  operationType: string
  resourceType: string
  resourceId: number | null
  operatorId: number | null
  operatorName: string | null
  createdAt: string
}

export interface CurrentWeekOverview {
  period: OverviewPeriod
  summary: OverviewSummary
  finance: OverviewFinanceSummary
  todos: OverviewTodo[]
  recentOperations: OverviewRecentOperation[]
}

function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || fallback
  }

  if (error instanceof Error) {
    return error.message
  }

  return fallback
}

export async function getCurrentWeekOverview(): Promise<CurrentWeekOverview> {
  try {
    const response = await http.get<{
      success: boolean
      data: CurrentWeekOverview
    }>('/overview/current-week')

    return response.data.data
  } catch (error) {
    throw new Error(getErrorMessage(error, '获取本周概览失败'))
  }
}
