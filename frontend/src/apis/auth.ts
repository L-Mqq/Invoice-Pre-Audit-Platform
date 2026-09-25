import axios from 'axios'
import http from '../utils/http'

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

export async function login(payload: RegisterPayload): Promise<LoginResponse> {
  try {
    const response = await http.post<LoginResponse>('/auth/login', payload)
    return response.data
  } catch (error: unknown) {
    if (axios.isAxiosError<{ message?: string }>(error)) throw new Error(error.response?.data?.message || '登录失败')
    throw error
  }
}

export async function getCurrentUser(): Promise<{ id: number; username: string; role: string }> {
  const response = await http.get<{ data: { user: { id: number; username: string; role: string } } }>('/auth/me')
  return response.data.data.user
}

export async function register(payload: RegisterPayload): Promise<RegisterResponse> {
  try {
    const response = await http.post<RegisterResponse>('/auth/register', payload)
    return response.data
  } catch (error: unknown) {
    if (axios.isAxiosError<{ message?: string }>(error)) {
      throw new Error(error.response?.data?.message || '注册失败')
    }
    throw error
  }
}
