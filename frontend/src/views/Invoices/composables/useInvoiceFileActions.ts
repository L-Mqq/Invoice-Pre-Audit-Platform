import { ref, type ComputedRef } from 'vue'
import { ElMessage } from 'element-plus'
import type { InvoiceDetailFile } from '../../../apis/invoices'
import {
  downloadInvoiceFile,
  previewInvoiceFile,
} from '../../../apis/invoiceFile'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return '文件操作失败'
}

export function useInvoiceFileActions(
  selectedFile: ComputedRef<InvoiceDetailFile | null>,
) {
  const previewing = ref(false)
  const downloading = ref(false)

  async function previewSelectedFile() {
    if (!selectedFile.value) {
      ElMessage.warning('暂无可预览的原始文件')
      return
    }

    const previewWindow = window.open('', '_blank')
    if (!previewWindow) {
      ElMessage.warning('浏览器阻止了预览窗口，请允许打开新标签页后重试')
      return
    }

    previewing.value = true

    try {
      const fileBlob = await previewInvoiceFile(selectedFile.value.id)
      const previewUrl = URL.createObjectURL(fileBlob)

      previewWindow.location.href = previewUrl
      window.setTimeout(() => {
        URL.revokeObjectURL(previewUrl)
      }, 60_000)
    } catch (error) {
      previewWindow.close()
      ElMessage.error(getErrorMessage(error))
    } finally {
      previewing.value = false
    }
  }

  async function downloadSelectedFile() {
    if (!selectedFile.value) {
      ElMessage.warning('暂无可下载的原始文件')
      return
    }

    downloading.value = true

    try {
      const fileBlob = await downloadInvoiceFile(selectedFile.value.id)
      const downloadUrl = URL.createObjectURL(fileBlob)
      const link = document.createElement('a')

      link.href = downloadUrl
      link.download = selectedFile.value.originalName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      ElMessage.error(getErrorMessage(error))
    } finally {
      downloading.value = false
    }
  }

  return {
    downloadSelectedFile,
    downloading,
    previewSelectedFile,
    previewing,
  }
}
