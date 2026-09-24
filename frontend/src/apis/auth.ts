import axios from 'axios'

export interface RegisterPayload {
  username: string
  password: string
}

export interface RegisterResponse {
  success: boolean
  message: string
  data?: {
    user: {
      id: number
      username: string
      role: string
    }
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

export async function register(payload: RegisterPayload): Promise<RegisterResponse> {
  try {
    const response = await apiClient.post<RegisterResponse>('/auth/register', payload)
    return response.data
  } catch (error: unknown) {
    if (axios.isAxiosError<{ message?: string }>(error)) {
      throw new Error(error.response?.data?.message || '注册失败')
    }
    throw error
  }
}
