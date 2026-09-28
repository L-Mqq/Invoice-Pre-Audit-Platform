import axios from 'axios'
import http from '../utils/http'

// 预览pdf
export async function previewInvoiceFile(fileId: number): Promise<Blob> {
  try {
    const response = await http.get<Blob>(`/invoice-files/${fileId}/preview`, {
      responseType: 'blob',
    })
    return response.data
  } catch (error: unknown) {
    if (axios.isAxiosError<{ message?: string }>(error)) {
      throw new Error(error.response?.data?.message || '文件预览失败')
    }
    throw error
  }
}

// 下载pdf
export async function downloadInvoiceFile(fileId: number): Promise<Blob> {
  try {
    const response = await http.get<Blob>(
      `/invoice-files/${fileId}/download`,
      {
        responseType: 'blob',
      },
    )

    return response.data
  } catch (error: unknown) {
    if (axios.isAxiosError<{ message?: string }>(error)) {
      throw new Error(error.response?.data?.message || '文件下载失败')
    }

    throw error
  }
}
