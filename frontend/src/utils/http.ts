import axios from 'axios'
import { clearToken, getToken } from './token'

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  headers: { 'Content-Type': 'application/json' },
})

// 请求拦截器
http.interceptors.request.use((config) => {
  const token = getToken()
  const isPublicAuthRequest = config.url === '/auth/login' || config.url === '/auth/register'
  if (token && !isPublicAuthRequest) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 响应拦截器
http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken()
      if (window.location.pathname !== '/auth') window.location.assign('/auth')
    }
    return Promise.reject(error)
  },
)

export default http
