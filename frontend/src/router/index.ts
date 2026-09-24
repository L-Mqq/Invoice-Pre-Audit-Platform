import { createRouter, createWebHistory } from 'vue-router'
import AuthView from '../views/Login/AuthView.vue'
import LayoutView from '../views/Layout/index.vue'
import { getToken } from '../utils/token'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/auth' },
    { path: '/auth', name: 'auth', component: AuthView },
    { path: '/layout', name: 'layout', component: LayoutView, meta: { requiresAuth: true } },
  ],
})

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !getToken()) return '/auth'
  if (to.name === 'auth' && getToken()) return '/layout'
})

export default router
