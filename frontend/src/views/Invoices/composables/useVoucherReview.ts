import {
  ref,
} from 'vue'
import { ElMessage } from 'element-plus'
import {
  reviewVoucherGroup,
  type ReviewVoucherGroupPayload,
} from '../../../apis/voucher'

interface UseVoucherReviewOptions {
  loadInvoiceDetail: () => Promise<void>
  loadVoucherGroups: () => Promise<void>
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return '凭证审核失败'
}

export function useVoucherReview(
  options: UseVoucherReviewOptions,
) {
  const voucherReviewSubmitting = ref(false)

  async function submitVoucherReview(
    payload: ReviewVoucherGroupPayload,
  ) {
    voucherReviewSubmitting.value = true

    try {
      const result = await reviewVoucherGroup(payload)

      await options.loadInvoiceDetail()
      await options.loadVoucherGroups()

      ElMessage.success(
        result.reviewStatus === 'approved'
          ? '凭证审核通过，发票已进入下一处理阶段'
          : '凭证已驳回，等待重新提交',
      )
    } catch (error) {
      ElMessage.error(getErrorMessage(error))
    } finally {
      voucherReviewSubmitting.value = false
    }
  }

  return {
    submitVoucherReview,
    voucherReviewSubmitting,
  }
}
