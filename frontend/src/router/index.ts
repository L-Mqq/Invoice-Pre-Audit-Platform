import { createRouter, createWebHistory } from 'vue-router'
import AuthView from '../views/Login/AuthView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/auth' },
    { path: '/auth', name: 'auth', component: AuthView },
  ],
})

export default router
