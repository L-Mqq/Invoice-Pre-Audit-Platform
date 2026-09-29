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
