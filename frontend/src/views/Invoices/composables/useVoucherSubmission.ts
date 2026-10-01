import {
  ref,
  type ComputedRef,
  type Ref,
} from 'vue'
import { ElMessage } from 'element-plus'
import {
  createVoucherGroup,
  uploadVoucherFile,
  type VoucherGroup,
  type VoucherSubmissionFiles,
  type VoucherType,
} from '../../../apis/voucher'
import type { InvoiceDetail } from '../../../apis/invoices'

interface UseVoucherSubmissionOptions {
  invoiceDetail: Ref<InvoiceDetail | null>
  latestVoucherGroup: ComputedRef<VoucherGroup | null>
  loadInvoiceDetail: () => Promise<void>
  loadVoucherGroups: () => Promise<void>
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return '提交凭证失败'
}

async function uploadFiles(
  groupId: number,
  voucherType: VoucherType,
  files: File[],
) {
  for (const file of files) {
    await uploadVoucherFile(
      groupId,
      voucherType,
      file,
    )
  }
}

export function useVoucherSubmission(
  options: UseVoucherSubmissionOptions,
) {
  const voucherSubmitting = ref(false)

  async function submitVoucherFiles(
    files: VoucherSubmissionFiles,
  ): Promise<boolean> {
    const invoice = options.invoiceDetail.value

    if (!invoice || invoice.qualificationStatus !== 'pending_voucher') {
      ElMessage.warning('当前发票不处于待补凭证状态')
      return false
    }

    if (
      files.orderScreenshotFiles.length === 0
      && files.paymentRecordFiles.length === 0
    ) {
      ElMessage.warning('请至少选择一份待上传的凭证文件')
      return false
    }

    voucherSubmitting.value = true

    try {
      const latestGroup = options.latestVoucherGroup.value
      const group = latestGroup?.review_status === 'pending_upload'
        ? latestGroup
        : await createVoucherGroup(invoice.id)

      await uploadFiles(
        group.id,
        'order_screenshot',
        files.orderScreenshotFiles,
      )
      await uploadFiles(
        group.id,
        'payment_record',
        files.paymentRecordFiles,
      )

      await options.loadVoucherGroups()
      await options.loadInvoiceDetail()

      ElMessage.success('凭证文件已提交，等待管理员核验')
      return true
    } catch (error) {
      await options.loadVoucherGroups()
      ElMessage.error(getErrorMessage(error))
      return false
    } finally {
      voucherSubmitting.value = false
    }
  }

  return {
    submitVoucherFiles,
    voucherSubmitting,
  }
}
