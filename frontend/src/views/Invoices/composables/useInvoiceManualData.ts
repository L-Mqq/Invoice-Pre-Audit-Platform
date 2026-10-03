import {
  ref,
  type Ref,
} from 'vue'
import { ElMessage } from 'element-plus'
import type { InvoiceDetail } from '../../../apis/invoices'
import {
  updateInvoiceManualData,
  type ManualInvoiceData,
  type ManualInvoiceItemData,
} from '../../../apis/invoiceReview'

interface ManualDataSubmitPayload {
  invoice?: ManualInvoiceData
  items?: ManualInvoiceItemData[]
  note: string
}

interface UseInvoiceManualDataOptions {
  invoiceDetail: Ref<InvoiceDetail | null>
  loadInvoiceDetail: () => Promise<void>
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return '补全发票资料失败'
}

export function useInvoiceManualData(
  options: UseInvoiceManualDataOptions,
) {
  const manualDataDialogVisible = ref(false)
  const manualDataSubmitting = ref(false)

  function openManualDataDialog() {
    if (!options.invoiceDetail.value?.canManualCompleteData) {
      ElMessage.warning('当前发票不满足补全资料条件')
      return
    }

    manualDataDialogVisible.value = true
  }

  async function submitManualData(payload: ManualDataSubmitPayload) {
    const invoice = options.invoiceDetail.value

    if (!invoice) {
      ElMessage.warning('发票详情尚未加载完成')
      return
    }

    manualDataSubmitting.value = true

    try {
      const result = await updateInvoiceManualData({
        invoiceId: invoice.id,
        invoice: payload.invoice,
        items: payload.items,
        note: payload.note,
      })

      await options.loadInvoiceDetail()
      manualDataDialogVisible.value = false

      if (result.completionRequired) {
        ElMessage.warning('资料仍未补全，请继续处理待补全项')
        return
      }

      if (result.manualProcessingType === 'category_confirmation') {
        ElMessage.success('资料已补全，请继续人工确认商品品类')
        return
      }

      ElMessage.success('资料已补全，可继续审核流程')
    } catch (error) {
      ElMessage.error(getErrorMessage(error))
    } finally {
      manualDataSubmitting.value = false
    }
  }

  return {
    manualDataDialogVisible,
    manualDataSubmitting,
    openManualDataDialog,
    submitManualData,
  }
}
