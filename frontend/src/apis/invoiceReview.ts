import axios from 'axios'
import http from '../utils/http'
import type {
  InvoiceDataIssue,
  ManualProcessingType,
} from './invoices'

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
  | 'execute_rules'
  | 'abandon'

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

export type DuplicateReviewDecision = 'duplicate' | 'not_duplicate'

export interface ReviewInvoiceDuplicatePayload {
  invoiceId: number
  decision: DuplicateReviewDecision
  note: string
}

export interface ReviewInvoiceDuplicateResponse {
  id: number
  decision: DuplicateReviewDecision
  duplicateInvoiceId: number | null
  qualificationStatus: string
  qualificationReason: string
  cumulativeAmount: number | string | null
  cumulativeWeekStart: string | null
  submittedAt: string | null
}

export interface InvoiceQualificationPreview {
  invoiceId: number
  priorCumulativeAmount: number | string | null
  currentInvoiceAmount: number | string
  projectedCumulativeAmount: number | string | null
  cumulativeWeekStart: string | null
  projectedQualificationStatus: string
  projectedQualificationReason: string
  requiresVoucher: boolean
  calculable: boolean
}

export interface ManualInvoiceData {
  sellerName?: string | null
  sellerTaxId?: string | null
  invoiceDate?: string | null
  totalAmount?: number
}

export interface ManualInvoiceItemData {
  itemId?: number
  itemName: string
  quantity: number
  unitPrice: number
  lineAmount: number
}

export interface UpdateInvoiceManualDataPayload {
  invoiceId: number
  invoice?: ManualInvoiceData
  items?: ManualInvoiceItemData[]
  note: string
}

export interface UpdateInvoiceManualDataResponse {
  id: number
  qualificationStatus: string
  qualificationReason: string
  completionRequired: boolean
  dataIssues: InvoiceDataIssue[]
  manualProcessingType: ManualProcessingType | null
  changedItemIds: number[]
  createdItemIds: number[]
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

// 保存管理员补全的发票基础信息和商品明细。
export async function updateInvoiceManualData(
  payload: UpdateInvoiceManualDataPayload,
): Promise<UpdateInvoiceManualDataResponse> {
  try {
    const response = await http.patch<{
      success: boolean
      data: UpdateInvoiceManualDataResponse
    }>(
      `/invoice-review/invoices/${payload.invoiceId}/manual-data`,
      {
        invoice: payload.invoice,
        items: payload.items,
        note: payload.note,
      },
    )

    return response.data.data
  } catch (error: unknown) {
    if (axios.isAxiosError<{ message?: string }>(error)) {
      throw new Error(
        error.response?.data?.message || '补全发票资料失败',
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

// 获取周累计信息
export async function getInvoiceQualificationPreview(
  invoiceId: number,
): Promise<InvoiceQualificationPreview> {
  try {
    const response = await http.get<{
      success: boolean
      data: InvoiceQualificationPreview
    }>(`/invoice-review/invoices/${invoiceId}/qualification-preview`)

    return response.data.data
  } catch (error: unknown) {
    if (axios.isAxiosError<{ message?: string }>(error)) {
      throw new Error(
        error.response?.data?.message || '获取规则预览失败',
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

export async function reviewInvoiceDuplicate(
  payload: ReviewInvoiceDuplicatePayload,
): Promise<ReviewInvoiceDuplicateResponse> {
  try {
    const response = await http.patch<{
      success: boolean
      data: ReviewInvoiceDuplicateResponse
    }>(
      `/invoice-review/invoices/${payload.invoiceId}/duplicate-review`,
      {
        decision: payload.decision,
        note: payload.note,
      },
    )

    return response.data.data
  } catch (error: unknown) {
    if (axios.isAxiosError<{ message?: string }>(error)) {
      throw new Error(
        error.response?.data?.message || '重复发票判定失败',
      )
    }

    throw error
  }
}
