import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { createUploadBatch, getUploadBatch, type UploadBatch } from '../apis/uploadBatch'

const LAST_BATCH_ID_KEY = 'invoice-pre-audit:last-batch-id'

// Pinia 保存当前批次；
export const useUploadBatchStore = defineStore('uploadBatch', () => {
  const currentBatch = ref<UploadBatch>()
  const loading = ref(false)
  const error = ref('')
  const currentBatchId = computed(() => currentBatch.value?.id || '')

  async function upload(files: File[]) {
    loading.value = true
    error.value = ''
    try {
      const createdBatch = await createUploadBatch(files)
      currentBatch.value = await getUploadBatch(createdBatch.id)
      localStorage.setItem(LAST_BATCH_ID_KEY, createdBatch.id)
      return currentBatch.value
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '发票上传失败'
      throw cause
    } finally {
      loading.value = false
    }
  }

  async function fetchBatch(batchId: string) {
    loading.value = true
    error.value = ''
    try {
      currentBatch.value = await getUploadBatch(batchId)
      localStorage.setItem(LAST_BATCH_ID_KEY, batchId)
      return currentBatch.value
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '获取上传批次失败'
      throw cause
    } finally {
      loading.value = false
    }
  }

  async function restoreLastBatch() {
    const batchId = localStorage.getItem(LAST_BATCH_ID_KEY)
    if (!batchId) return undefined
    return fetchBatch(batchId)
  }

  function clearBatch() {
    currentBatch.value = undefined
    error.value = ''
    localStorage.removeItem(LAST_BATCH_ID_KEY)
  }

  return { currentBatch, currentBatchId, loading, error, upload, fetchBatch, restoreLastBatch, clearBatch }
})
