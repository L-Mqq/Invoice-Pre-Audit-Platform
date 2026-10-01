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

export interface VoucherSubmissionFiles {
  orderScreenshotFiles: File[]
  paymentRecordFiles: File[]
}

export interface CreatedVoucherGroup {
  id: number
  invoiceId: number
  groupName: string | null
  reviewStatus: VoucherReviewStatus
}

export interface ReviewVoucherGroupPayload {
  groupId: number
  reviewStatus: 'approved' | 'rejected'
  note: string
}

export interface ReviewVoucherGroupResponse {
  groupId: number
  invoiceId: number
  reviewStatus: VoucherReviewStatus
  reviewNote: string
  invoiceQualificationStatus: string
  invoiceQualificationReason: string | null
  completedRequirementIds: number[]
  triggerInvoiceIdsReadyForRuleReview: number[]
}

export type WeeklyVoucherRequirementStatus = 'pending' | 'completed' | 'cancelled'

export type WeeklyVoucherRequirementInvoiceStatus = 'pending' | 'approved' | 'cancelled'

export interface WeeklyVoucherRequirementInvoice {
  requirementInvoiceId: number
  invoiceId: number
  invoiceNumber: string | null
  sellerName: string | null
  totalAmount: number | string
  qualificationStatus: string
  financeStatus: string
  reimbursementStatus: string
  invoiceRole: 'existing' | 'trigger'
  voucherStatus: WeeklyVoucherRequirementInvoiceStatus
  approvedVoucherGroupId: number | null
  completedAt: string | null
  canSubmitVoucher: boolean
}

export interface WeeklyVoucherRequirement {
  id: number
  sellerTaxId: string
  cumulativeWeekStart: string
  triggerInvoiceId: number
  triggeredCumulativeAmount: number | string
  status: WeeklyVoucherRequirementStatus
  completedAt: string | null
  cancelledAt: string | null
  createdAt: string
  updatedAt: string
  currentInvoice: {
    requirementInvoiceId: number
    invoiceRole: 'existing' | 'trigger'
    voucherStatus: WeeklyVoucherRequirementInvoiceStatus
    approvedVoucherGroupId: number | null
    completedAt: string | null
  }
  blocksFinanceSubmission: boolean
  totalInvoiceCount: number
  approvedInvoiceCount: number
  pendingInvoiceCount: number
  cancelledInvoiceCount: number
  invoices: WeeklyVoucherRequirementInvoice[]
}

export interface WeeklyVoucherRequirementsResponse {
  invoiceId: number
  requirements: WeeklyVoucherRequirement[]
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

// 获取发票参与的周累计凭证任务及关联发票进度。
export async function getWeeklyVoucherRequirements(
  invoiceId: number,
): Promise<WeeklyVoucherRequirementsResponse> {
  try {
    const response = await http.get<{
      success: boolean
      data: WeeklyVoucherRequirementsResponse
    }>(`/vouchers/invoices/${invoiceId}/weekly-voucher-requirements`)

    return response.data.data
  } catch (error: unknown) {
    if (axios.isAxiosError<{ message?: string }>(error)) {
      throw new Error(
        error.response?.data?.message || '获取周累计凭证任务失败',
      )
    }

    throw error
  }
}

// 创建凭证组
export async function createVoucherGroup(
  invoiceId: number,
): Promise<CreatedVoucherGroup> {
  try {
    const response = await http.post<{
      success: boolean
      data: CreatedVoucherGroup
    }>(`/vouchers/invoices/${invoiceId}/voucher-groups`, {})

    return response.data.data
  } catch (error: unknown) {
    if (axios.isAxiosError<{ message?: string }>(error)) {
      throw new Error(
        error.response?.data?.message || '创建凭证组失败',
      )
    }

    throw error
  }
}

// 上传凭证文件
export async function uploadVoucherFile(
  groupId: number,
  voucherType: VoucherType,
  file: File,
): Promise<void> {
  const formData = new FormData()

  formData.append('file', file)

  try {
    await http.post(
      `/vouchers/voucher-groups/${groupId}/files/${voucherType}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    )
  } catch (error: unknown) {
    if (axios.isAxiosError<{ message?: string }>(error)) {
      throw new Error(
        error.response?.data?.message || '上传凭证文件失败',
      )
    }

    throw error
  }
}
// 凭证文件预览接口
export async function previewVoucherFile(
  voucherId: number,
): Promise<Blob> {
  try {
    const response = await http.get<Blob>(
      `/voucher-files/${voucherId}/preview`,
      {
        responseType: 'blob',
      },
    )

    return response.data
  } catch (error: unknown) {
    if (axios.isAxiosError<{ message?: string }>(error)) {
      throw new Error(
        error.response?.data?.message || '凭证文件预览失败',
      )
    }

    throw error
  }
}

// 凭证组审核接口
export async function reviewVoucherGroup(
  payload: ReviewVoucherGroupPayload,
): Promise<ReviewVoucherGroupResponse> {
  try {
    const response = await http.patch<{
      success: boolean
      data: ReviewVoucherGroupResponse
    }>(`/vouchers/voucher-groups/${payload.groupId}/review`, {
      reviewStatus: payload.reviewStatus,
      note: payload.note,
    })

    return response.data.data
  } catch (error: unknown) {
    if (axios.isAxiosError<{ message?: string }>(error)) {
      throw new Error(
        error.response?.data?.message || '凭证审核失败',
      )
    }

    throw error
  }
}
