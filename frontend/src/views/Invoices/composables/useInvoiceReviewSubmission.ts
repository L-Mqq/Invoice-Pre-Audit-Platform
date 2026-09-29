import {
  computed,
  ref,
  type Ref,
} from 'vue'
import { ElMessage } from 'element-plus'
import type { InvoiceDetail } from '../../../apis/invoices'
import { submitInvoiceForReview } from '../../../apis/invoiceReview'

interface UseInvoiceReviewSubmissionOptions {
  getRouteInvoiceId: () => number | null
  invoiceDetail: Ref<InvoiceDetail | null>
  loadInvoiceDetail: () => Promise<void>
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return '提交审核失败'
}

export function useInvoiceReviewSubmission(
  options: UseInvoiceReviewSubmissionOptions,
) {
  const submitReviewLoading = ref(false)

  const isCategoryEditable = computed(() => {
    if (!options.invoiceDetail.value) {
      return false
    }

    return !options.invoiceDetail.value.submittedAt
      && (
        options.invoiceDetail.value.qualificationStatus === 'pending'
        || options.invoiceDetail.value.qualificationStatus === 'pending_manual'
      )
  })

  const canSubmitReview = computed(() => {
    if (!options.invoiceDetail.value || !isCategoryEditable.value) {
      return false
    }

    return options.invoiceDetail.value.items.length > 0
      && options.invoiceDetail.value.items.every(
        (item) => item.finalCategoryResult && item.finalCategoryResult !== '存疑',
      )
  })

  const canEnterInvoiceReview = computed(() => {
    if (!options.invoiceDetail.value) {
      return false
    }

    return Boolean(options.invoiceDetail.value.submittedAt)
      && options.invoiceDetail.value.qualificationStatus === 'pending'
  })

  async function submitInvoiceReview() {
    const invoiceId = options.getRouteInvoiceId()

    if (!invoiceId || !canSubmitReview.value) {
      ElMessage.warning('请先完成全部商品的品类确认，再提交审核')
      return
    }

    submitReviewLoading.value = true

    try {
      await submitInvoiceForReview(invoiceId)
      await options.loadInvoiceDetail()
      ElMessage.success('发票已提交审核，商品品类已锁定')
    } catch (error) {
      ElMessage.error(getErrorMessage(error))
    } finally {
      submitReviewLoading.value = false
    }
  }

  function handleInvoiceReview() {
    ElMessage.info('发票级管理员审核入口已就绪，暂不提交审核数据')
  }

  return {
    canEnterInvoiceReview,
    canSubmitReview,
    handleInvoiceReview,
    isCategoryEditable,
    submitInvoiceReview,
    submitReviewLoading,
  }
}
