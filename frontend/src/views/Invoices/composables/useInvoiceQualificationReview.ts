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

interface UseInvoiceQualificationReviewOptions {
  invoiceDetail: Ref<InvoiceDetail | null>
  loadInvoiceDetail: () => Promise<void>
  loadVoucherGroups: () => Promise<void>
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return '发票级审核失败'
}


export function useInvoiceQualificationReview(
  options: UseInvoiceQualificationReviewOptions,
) {
  const qualificationReviewSubmitting = ref(false)

 
  async function submitQualificationReview(
    payload: Omit<ReviewInvoiceQualificationPayload, 'invoiceId'>,
  ): Promise<boolean> {
    // 拿到发票详情
    const invoice = options.invoiceDetail.value

    if (!invoice) {
      ElMessage.warning('发票详情尚未加载完成')
      return false
    }

    qualificationReviewSubmitting.value = true

    //调用审核接口
    try {
      const result = await reviewInvoiceQualification({
        invoiceId: invoice.id,
        action: payload.action,
        note: payload.note,
      })
      // 刷新数据
      await options.loadInvoiceDetail()
      await options.loadVoucherGroups()

      ElMessage.success(`发票级审核完成，当前状态：${result.qualificationStatus}`)
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
