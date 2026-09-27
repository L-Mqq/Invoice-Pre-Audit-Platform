import axios from 'axios'
import http from '../utils/http'

export type BatchStatus = 'completed' | 'partial_failed' | 'failed'
export type FileStatus = 'success' | 'failed'

export interface UploadBatchFile {
  id: number
  batchId: string
  invoiceId: number
  originalName: string
  storageKey: string
  extractionStatus: 'pending' | 'success' | 'failed'
}

export interface UploadBatchResult {
  fileId: number
  status: FileStatus
  error?: string
}

export interface UploadBatch {
  id: string
  originalName: string
  fileType: 'pdf' | 'multiple_pdf' | 'zip'
  status: BatchStatus
  totalCount: number
  successCount: number
  failedCount: number
  files: UploadBatchFile[]
  results: UploadBatchResult[]
}

interface UploadBatchResponse {
  success: boolean
  message: string
  data: { batch: UploadBatch }
}

export async function createUploadBatch(files: File[], onUploadProgress?: (percent: number) => void): Promise<UploadBatch> {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))
  try {
    const response = await http.post<UploadBatchResponse>('/upload-batches', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (event.total) onUploadProgress?.(Math.round((event.loaded / event.total) * 100))
      },
    })
    return response.data.data.batch
  } catch (error: unknown) {
    if (axios.isAxiosError<{ message?: string }>(error)) {
      throw new Error(error.response?.data?.message || '发票上传失败')
    }
    throw error
  }
}
