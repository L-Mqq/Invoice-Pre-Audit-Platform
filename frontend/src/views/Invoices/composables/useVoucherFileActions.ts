import {
  ref,
} from 'vue'
import { ElMessage } from 'element-plus'
import { previewVoucherFile } from '../../../apis/voucher'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return '凭证文件预览失败'
}

export function useVoucherFileActions() {
  const voucherFilePreviewing = ref(false)

  async function previewVoucherFileById(voucherId: number) {
    const previewWindow = window.open('', '_blank')

    if (!previewWindow) {
      ElMessage.warning('浏览器阻止了预览窗口，请允许打开新标签页后重试')
      return
    }

    voucherFilePreviewing.value = true

    try {
      const fileBlob = await previewVoucherFile(voucherId)
      const previewUrl = URL.createObjectURL(fileBlob)

      previewWindow.location.href = previewUrl
      window.setTimeout(() => {
        URL.revokeObjectURL(previewUrl)
      }, 60_000)
    } catch (error) {
      previewWindow.close()
      ElMessage.error(getErrorMessage(error))
    } finally {
      voucherFilePreviewing.value = false
    }
  }

  return {
    previewVoucherFileById,
    voucherFilePreviewing,
  }
}
