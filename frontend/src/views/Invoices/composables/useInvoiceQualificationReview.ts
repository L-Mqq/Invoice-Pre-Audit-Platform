import {
  ref,
  type Ref,
} from 'vue'
import { ElMessage } from 'element-plus'
import {
  reviewInvoiceQualification,
  type ReviewInvoiceQualificationPayload,
} from '../../../apis/invoiceReview'
import type { InvoiceDetail } from '../../../apis/invoices'
import { getQualificationStatusLabel } from '../../../utils/status'

interface UseInvoiceQualificationReviewOptions {
  invoiceDetail: Ref<InvoiceDetail | null>
  loadInvoiceDetail: () => Promise<void>
  loadVoucherGroups: () => Promise<void>
  loadWeeklyVoucherRequirements: () => Promise<void>
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return '发票处理失败'
}


export function useInvoiceQualificationReview(
  options: UseInvoiceQualificationReviewOptions,
) {
  const qualificationReviewSubmitting = ref(false)

 
  async function submitQualificationReview(
    payload: Omit<ReviewInvoiceQualificationPayload, 'invoiceId'>,
  ): Promise<boolean> {
    const invoice = options.invoiceDetail.value

    if (!invoice) {
      ElMessage.warning('发票详情尚未加载完成')
      return false
    }

    qualificationReviewSubmitting.value = true

    try {
      const result = await reviewInvoiceQualification({
        invoiceId: invoice.id,
        action: payload.action,
        note: payload.note,
      })
      await options.loadInvoiceDetail()
      await options.loadVoucherGroups()
      await options.loadWeeklyVoucherRequirements()

      if (payload.action === 'abandon') {
        ElMessage.success('当前发票已放弃')
      } else {
        ElMessage.success(
          `规则审核完成，当前状态：${getQualificationStatusLabel(
            result.qualificationStatus,
          )}`,
        )
      }
      return true
    } catch (error) {
      ElMessage.error(getErrorMessage(error))
      return false
    } finally {
      qualificationReviewSubmitting.value = false
    }
  }

  return {
    qualificationReviewSubmitting,
    submitQualificationReview,
  }
}
