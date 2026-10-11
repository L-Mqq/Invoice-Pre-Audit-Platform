import axios from 'axios'
import http from '../utils/http'

export type ReviewWorkbenchPreAuditStatus =
  | 'pending'
  | 'pending_voucher'
  | 'pending_weekly_voucher'
  | 'pending_manual'

export interface ReviewWorkbenchSummary {
  pendingReviewCount: number
  pendingVoucherCount: number
  pendingManualCount: number
}

export interface ReviewWorkbenchPriorityTask {
  invoiceId: number
  invoiceNumber: string | null
  sellerName: string | null
  totalAmount: number
  submittedAt: string | null
  preAuditStatus: ReviewWorkbenchPreAuditStatus
  reason: string
  priority: number
}

export interface ReviewWorkbenchExceptions {
  duplicateCount: number
  extractionFailedCount: number
  dataIncompleteCount: number
}

export interface ReviewWorkbenchResponse {
  summary: ReviewWorkbenchSummary
  priorityTasks: ReviewWorkbenchPriorityTask[]
  exceptions: ReviewWorkbenchExceptions
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

export async function getReviewWorkbench(
  limit = 10,
): Promise<ReviewWorkbenchResponse> {
  try {
    const response = await http.get<{
      success: boolean
      data: ReviewWorkbenchResponse
    }>('/review-workbench', {
      params: {
        limit,
      },
    })

    return response.data.data
  } catch (error) {
    throw new Error(getErrorMessage(error, '获取审核工作台数据失败'))
  }
}
