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
