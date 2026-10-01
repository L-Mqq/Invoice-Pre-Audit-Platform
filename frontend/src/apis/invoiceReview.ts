import axios from 'axios'
import http from '../utils/http'

export type CategoryReviewResult = '可以' | '存疑' | '不可以'

export interface ReviewItemCategoryPayload {
  itemId: number
  result: CategoryReviewResult
  note: string
}

export interface ReviewItemCategoryResponse {
  itemId: number
  invoiceId: number
  itemName: string
  result: CategoryReviewResult
  invoiceResult: CategoryReviewResult
  qualificationStatus: string
}

export interface SubmitInvoiceForReviewResponse {
  id: number
  qualificationStatus: string
  qualificationReason: string
  submittedAt: string
}

export type InvoiceQualificationAction =
  | 'approve'
  | 'request_voucher'
  | 'mark_manual'
  | 'reject'
  | 'cancel'

export interface ReviewInvoiceQualificationPayload {
  invoiceId: number
  action: InvoiceQualificationAction
  note: string
}

export interface ReviewInvoiceQualificationResponse {
  id: number
  action: InvoiceQualificationAction
  qualificationStatus: string
  qualificationReason: string
  cumulativeAmount: number | string | null
  cumulativeWeekStart: string | null
  submittedAt: string | null
  manualNote: string | null
}

// 更新人工审核商品品类的结果
export async function reviewItemCategory(
  payload: ReviewItemCategoryPayload,
): Promise<ReviewItemCategoryResponse> {
  try {
    const response = await http.patch<{
      success: boolean
      data: ReviewItemCategoryResponse
    }>(
      `/invoice-review/items/${payload.itemId}/category`,
      {
        result: payload.result,
        note: payload.note,
      },
    )

    return response.data.data
  } catch (error: unknown) {
    if (axios.isAxiosError<{ message?: string }>(error)) {
      throw new Error(
        error.response?.data?.message || '人工确认商品品类失败',
      )
    }

    throw error
  }
}

// 提交审核的接口 状态修改为pending
export async function submitInvoiceForReview(
  invoiceId: number,
): Promise<SubmitInvoiceForReviewResponse> {
  try {
    const response = await http.patch<{
      success: boolean
      data: SubmitInvoiceForReviewResponse
    }>(`/invoice-review/invoices/${invoiceId}/submit`)

    return response.data.data
  } catch (error: unknown) {
    if (axios.isAxiosError<{ message?: string }>(error)) {
      throw new Error(
        error.response?.data?.message || '提交审核失败',
      )
    }

    throw error
  }
}

// 发票级审核，修改发票的结果
export async function reviewInvoiceQualification(
  payload: ReviewInvoiceQualificationPayload,
): Promise<ReviewInvoiceQualificationResponse> {
  try {
    const response = await http.patch<{
      success: boolean
      data: ReviewInvoiceQualificationResponse
    }>(
      `/invoice-review/invoices/${payload.invoiceId}/qualification`,
      {
        action: payload.action,
        note: payload.note,
      },
    )

    return response.data.data
  } catch (error: unknown) {
    if (axios.isAxiosError<{ message?: string }>(error)) {
      throw new Error(
        error.response?.data?.message || '发票级审核失败',
      )
    }

    throw error
  }
}
