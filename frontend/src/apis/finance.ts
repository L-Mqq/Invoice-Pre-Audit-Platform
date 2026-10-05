import axios from 'axios'
import http from '../utils/http'

export type FinanceStatus = 'not_submitted' | 'submitted'
export type ReimbursementStatus = 'not_completed' | 'success' | 'failed'

export interface FinanceWeekQuery {
  financeStatus?: FinanceStatus
  weekStart?: string
  sellerKeyword?: string
}

export interface FinanceWeekVoucherProgress {
  requiredInvoiceCount: number
  approvedInvoiceCount: number
  hasCompletedRequirement: boolean
  hasPendingRequirement: boolean
}

export interface FinanceWeekReimbursementSummary {
  notCompletedCount: number
  successCount: number
  failedCount: number
}

export interface FinanceWeekGroup {
  sellerName: string
  sellerTaxId: string
  weekStart: string
  weekEnd: string
  totalInvoiceCount: number
  activeInvoiceCount: number
  approvedInvoiceCount: number
  pendingInvoiceCount: number
  rejectedInvoiceCount: number
  cancelledInvoiceCount: number
  validCumulativeAmount: number
  voucherProgress: FinanceWeekVoucherProgress
  financeStatus: FinanceStatus
  reimbursementSummary: FinanceWeekReimbursementSummary
  canSubmitFinance: boolean
  submitBlockedReason: string | null
}

export interface FinanceWeeksResponse {
  summary: {
    pendingGroupCount: number
    submittedGroupCount: number
  }
  items: FinanceWeekGroup[]
}

export interface FinanceWeekInvoice {
  id: number
  invoiceNumber: string | null
  totalAmount: number
  submittedAt: string
  qualificationStatus: string
  qualificationReason: string | null
  voucherStatus: {
    code: 'not_required' | 'pending' | 'approved' | 'rejected'
    label: string
  }
  financeStatus: FinanceStatus
  reimbursementStatus: ReimbursementStatus
}

export interface FinanceWeekInvoicesResponse {
  sellerTaxId: string
  weekStart: string
  weekEnd: string
  items: FinanceWeekInvoice[]
}

export interface SubmitFinanceWeekPayload {
  sellerTaxId: string
  cumulativeWeekStart: string
}

export interface SubmitFinanceWeekResponse {
  sellerTaxId: string
  cumulativeWeekStart: string
  financeStatus: FinanceStatus
  invoiceCount: number
  cumulativeAmount: number
  invoiceIds: number[]
}

export interface UpdateReimbursementStatusPayload {
  invoiceId: number
  reimbursementStatus: Exclude<ReimbursementStatus, 'not_completed'>
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

// 获取财政组列表
export async function getFinanceWeeks(
  query: FinanceWeekQuery = {},
): Promise<FinanceWeeksResponse> {
  try {
    const response = await http.get<{
      success: boolean
      data: FinanceWeeksResponse
    }>('/finance/weeks', {
      params: query,
    })

    return response.data.data
  } catch (error) {
    throw new Error(getErrorMessage(error, '获取财务组列表失败'))
  }
}

// 获取财政组内发票详细信息
export async function getFinanceWeekInvoices(
  sellerTaxId: string,
  weekStart: string,
): Promise<FinanceWeekInvoicesResponse> {
  try {
    const response = await http.get<{
      success: boolean
      data: FinanceWeekInvoicesResponse
    }>('/finance/weeks/invoices', {
      params: {
        sellerTaxId,
        weekStart,
      },
    })

    return response.data.data
  } catch (error) {
    throw new Error(getErrorMessage(error, '获取财务组发票明细失败'))
  }
}

// 提交财政
export async function submitFinanceWeek(
  payload: SubmitFinanceWeekPayload,
): Promise<SubmitFinanceWeekResponse> {
  try {
    const response = await http.post<{
      success: boolean
      data: SubmitFinanceWeekResponse
    }>('/finance/weeks/submit', payload)

    return response.data.data
  } catch (error) {
    throw new Error(getErrorMessage(error, '提交财务失败'))
  }
}

// 更新报销状态
export async function updateReimbursementStatus(
  payload: UpdateReimbursementStatusPayload,
): Promise<{
  id: number
  reimbursementStatus: ReimbursementStatus
}> {
  try {
    const response = await http.patch<{
      success: boolean
      data: {
        id: number
        reimbursementStatus: ReimbursementStatus
      }
    }>(`/invoices/${payload.invoiceId}/reimbursement-status`, {
      reimbursementStatus: payload.reimbursementStatus,
    })

    return response.data.data
  } catch (error) {
    throw new Error(getErrorMessage(error, '更新最终报销状态失败'))
  }
}
