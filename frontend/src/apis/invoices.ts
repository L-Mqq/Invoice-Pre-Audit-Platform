import axios from 'axios'
import http from '../utils/http'

export interface InvoiceListItem {
  id: number
  invoiceNumber: string | null
  invoiceDate: string | null
  sellerName: string | null
  sellerTaxId: string | null
  totalAmount: number | string
  submittedAt: string | null
  qualificationStatus: string
  qualificationReason: string | null
  cumulativeAmount: number | string | null
  cumulativeWeekStart: string | null
  financeStatus: string
  reimbursementStatus: string
  sourceBatchId: string | null
  createdAt: string
  updatedAt: string
  file: {
    id: number
    originalName: string
    extractionStatus: 'success' | 'failed' | 'pending'
    extractionError: string | null
  } | null
}

export interface InvoiceListQuery {
  page: number
  pageSize: number
  qualificationStatus?: string
  financeStatus?: string
  reimbursementStatus?: string
  sellerName?: string
  invoiceNumber?: string
}

export interface InvoiceListResponse {
  items: InvoiceListItem[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export interface InvoiceDetailItem {
  id: number
  invoiceId: number
  itemName: string
  quantity: number | string | null
  unitPrice: number | string
  priceType: 'material' | 'low_value' | 'asset' | null
  lineAmount: number | string
  aiCategoryResult: '可以' | '存疑' | '不可以' | null
  aiCategoryReason: string | null
  manualCategoryResult: '可以' | '存疑' | '不可以' | null
  manualCategoryReason: string | null
  finalCategoryResult: '可以' | '存疑' | '不可以' | null
  createdAt: string
  updatedAt: string
}

export interface InvoiceDetailFile {
  id: number
  batchId: string | null
  invoiceId: number
  originalName: string
  mimeType: string
  fileSize: number | string
  extractionStatus: 'success' | 'failed' | 'pending'
  extractionError: string | null
  createdAt: string
  updatedAt: string
}

export type ManualProcessingType =
  | 'data_completion'
  | 'category_confirmation'

export interface InvoiceDataIssue {
  code: string
  scope: 'invoice' | 'item'
  field: string
  itemIndex: number | null
  itemId?: number | null
  message: string
}

export interface InvoiceDetail {
  id: number
  invoiceNumber: string | null
  invoiceDate: string | null
  sellerName: string | null
  sellerTaxId: string | null
  totalAmount: number | string
  submittedAt: string | null
  qualificationStatus: string
  financeStatus: string
  reimbursementStatus: string
  qualificationReason: string | null
  cumulativeAmount: number | string | null
  cumulativeWeekStart: string | null
  sourceBatchId: string | null
  aiRawResult: unknown
  manualNote: string | null
  completionRequired: boolean
  dataIssues: InvoiceDataIssue[]
  manualProcessingType: ManualProcessingType | null
  canManualCompleteData: boolean
  canConfirmCategory: boolean
  createdAt: string
  updatedAt: string
  items: InvoiceDetailItem[]
  files: InvoiceDetailFile[]
}

export async function getInvoices(query: InvoiceListQuery): Promise<InvoiceListResponse> {
  try {
    const response = await http.get<{ success: boolean; data: InvoiceListResponse }>('/invoices', { params: query })
    return response.data.data
  } catch (error: unknown) {
    if (axios.isAxiosError<{ message?: string }>(error)) {
      throw new Error(error.response?.data?.message || '获取发票列表失败')
    }
    throw error
  }
}

export async function getInvoiceDetail(
  invoiceId: number,
): Promise<InvoiceDetail> {
  try {
    const response = await http.get<{
      success: boolean
      data: InvoiceDetail
    }>(`/invoices/${invoiceId}`)

    return response.data.data
  } catch (error: unknown) {
    if (axios.isAxiosError<{ message?: string }>(error)) {
      throw new Error(
        error.response?.data?.message || '获取发票详情失败',
      )
    }

    throw error
  }
}
