import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { clearToken, getToken, setToken } from '../utils/token'
import { getCurrentUser } from '../apis/auth'
export interface AuthUser { id: number; username: string; role: string }


export const useAuthStore = defineStore('auth', () => {
  const token = ref(getToken())
  const user = ref<AuthUser | null>(null)
  const isAuthenticated = computed(() => Boolean(token.value))
  
  function login(nextToken: string, nextUser: AuthUser) { 
          setToken(nextToken); 
          token.value = nextToken;
          user.value = nextUser 
        }
  
  function logout() { 
          clearToken(); 
          token.value = null; 
          user.value = null 
      }

    //如果本地有token，则通过后端的请求获取登录者的信息
    //放在路由守卫，刷新切换页面时都会恢复当前登陆者的信息
    async function restoreSession() {
    if (!token.value) return false
    try {
      user.value = await getCurrentUser()
      return true
    } catch {
      logout()
      return false
    }
  }
  return { token, user, isAuthenticated, login, logout, restoreSession }
})
