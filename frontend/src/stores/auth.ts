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
          user.value = nextUser }
  
  function logout() { 
          clearToken(); 
          token.value = null; 
          user.value = null 
      }


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
