import {
  reactive,
  ref,
} from 'vue'
import { ElMessage } from 'element-plus'
import type { InvoiceDetailItem } from '../../../apis/invoices'
import {
  reviewItemCategory,
  type CategoryReviewResult,
} from '../../../apis/invoiceReview'

interface UseInvoiceCategoryReviewOptions {
  loadInvoiceDetail: () => Promise<void>
}

function isCategoryReviewable(item: InvoiceDetailItem): boolean {
  return !item.finalCategoryResult || item.finalCategoryResult === '存疑'
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return '商品品类人工确认失败'
}

export function useInvoiceCategoryReview(
  options: UseInvoiceCategoryReviewOptions,
) {
  const evidenceDialogVisible = ref(false)
  const categoryReviewDialogVisible = ref(false)
  const categoryReviewSubmitting = ref(false)
  const selectedReviewItem = ref<InvoiceDetailItem | null>(null)
  const categoryReviewForm = reactive({
    result: '',
    reason: '',
  })

  function openEvidenceDialog(item: InvoiceDetailItem) {
    selectedReviewItem.value = item
    evidenceDialogVisible.value = true
  }

  function openCategoryReviewDialog() {
    if (!selectedReviewItem.value) {
      return
    }

    if (!isCategoryReviewable(selectedReviewItem.value)) {
      ElMessage.warning('仅品类结果为“存疑”或未判断的商品允许人工确认')
      return
    }

    categoryReviewForm.result = selectedReviewItem.value.manualCategoryResult
      || selectedReviewItem.value.finalCategoryResult
      || '存疑'
    categoryReviewForm.reason = selectedReviewItem.value.manualCategoryReason || ''
    evidenceDialogVisible.value = false
    categoryReviewDialogVisible.value = true
  }

  async function submitCategoryReview() {
    if (!categoryReviewForm.result) {
      ElMessage.warning('请选择最终品类结果')
      return
    }

    if (!categoryReviewForm.reason.trim()) {
      ElMessage.warning('请填写人工判断依据')
      return
    }

    if (!selectedReviewItem.value) {
      ElMessage.warning('未选择需要人工确认的商品')
      return
    }

    if (!isCategoryReviewable(selectedReviewItem.value)) {
      ElMessage.warning('仅品类结果为“存疑”或未判断的商品允许人工确认')
      return
    }

    categoryReviewSubmitting.value = true

    try {
      await reviewItemCategory({
        itemId: selectedReviewItem.value.id,
        result: categoryReviewForm.result as CategoryReviewResult,
        note: categoryReviewForm.reason.trim(),
      })

      categoryReviewDialogVisible.value = false
      selectedReviewItem.value = null
      await options.loadInvoiceDetail()
      ElMessage.success('商品品类人工确认已保存')
    } catch (error) {
      ElMessage.error(getErrorMessage(error))
    } finally {
      categoryReviewSubmitting.value = false
    }
  }

  return {
    categoryReviewDialogVisible,
    categoryReviewForm,
    categoryReviewSubmitting,
    evidenceDialogVisible,
    openCategoryReviewDialog,
    openEvidenceDialog,
    selectedReviewItem,
    submitCategoryReview,
  }
}
