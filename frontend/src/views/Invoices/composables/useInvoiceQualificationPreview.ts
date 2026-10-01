import {
  ref,
  type Ref,
} from 'vue'
import {
  getInvoiceQualificationPreview,
  type InvoiceQualificationPreview,
} from '../../../apis/invoiceReview'
import type { InvoiceDetail } from '../../../apis/invoices'

interface UseInvoiceQualificationPreviewOptions {
  invoiceDetail: Ref<InvoiceDetail | null>
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return '获取规则预览失败'
}

export function useInvoiceQualificationPreview(
  options: UseInvoiceQualificationPreviewOptions,
) {
  const qualificationPreview = ref<InvoiceQualificationPreview | null>(null)
  const qualificationPreviewLoading = ref(false)
  const qualificationPreviewError = ref('')

  async function loadQualificationPreview() {
    const invoice = options.invoiceDetail.value

    qualificationPreview.value = null
    qualificationPreviewError.value = ''

    if (!invoice) {
      return
    }

    qualificationPreviewLoading.value = true

    try {
      qualificationPreview.value = await getInvoiceQualificationPreview(
        invoice.id,
      )
    } catch (error) {
      qualificationPreviewError.value = getErrorMessage(error)
    } finally {
      qualificationPreviewLoading.value = false
    }
  }

  return {
    qualificationPreview,
    qualificationPreviewError,
    qualificationPreviewLoading,
    loadQualificationPreview,
  }
}
