import axios from 'axios'

export interface RegisterPayload {
  username: string
  password: string
}

export interface LoginResponse {
  success: boolean
  message: string
  data: { token: string; user: { id: number; username: string; role: string } }
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

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('invoice_pre_audit_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export async function login(payload: RegisterPayload): Promise<LoginResponse> {
  try {
    const response = await apiClient.post<LoginResponse>('/auth/login', payload)
    return response.data
  } catch (error: unknown) {
    if (axios.isAxiosError<{ message?: string }>(error)) throw new Error(error.response?.data?.message || '登录失败')
    throw error
  }
}

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
