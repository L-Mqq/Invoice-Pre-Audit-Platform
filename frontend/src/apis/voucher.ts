import axios from 'axios'
import http from '../utils/http'

export type VoucherReviewStatus = 'pending_upload' | 'pending_review' | 'approved' | 'rejected'

export type VoucherType = 'order_screenshot' | 'payment_record'

export interface VoucherFile {
  id: number
  voucher_group_id: number
  voucher_type: VoucherType
  original_name: string
  mime_type: string
  file_size: number | string
  created_at: string
  updated_at: string
}

export interface VoucherGroup {
  id: number
  invoice_id: number
  group_name: string | null
  review_status: VoucherReviewStatus
  reviewed_by: number | null
  reviewed_at: string | null
  review_note: string | null
  created_at: string
  updated_at: string
  files: VoucherFile[]
}

export interface VoucherGroupsResponse {
  invoiceId: number
  groups: VoucherGroup[]
}

// 获取凭证组信息
export async function getVoucherGroups(
  invoiceId: number,
): Promise<VoucherGroupsResponse> {
  try {
    const response = await http.get<{
      success: boolean
      data: VoucherGroupsResponse
    }>(`/vouchers/invoices/${invoiceId}/voucher-groups`)

    return response.data.data
  } catch (error: unknown) {
    if (axios.isAxiosError<{ message?: string }>(error)) {
      throw new Error(
        error.response?.data?.message || '获取凭证组失败',
      )
    }

    throw error
  }
}
