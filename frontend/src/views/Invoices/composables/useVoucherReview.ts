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
  loadWeeklyVoucherRequirements: () => Promise<void>
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
      await options.loadWeeklyVoucherRequirements()

      ElMessage.success(
        result.triggerInvoiceIdsReadyForRuleReview.length > 0
          ? '关联发票凭证已全部完成，触发发票可重新执行规则审核'
          : result.reviewStatus === 'approved'
          ? '凭证审核通过，等待其他关联发票完成凭证'
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
