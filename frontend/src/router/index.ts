import { createRouter, createWebHistory } from 'vue-router'
import AuthView from '../views/Login/AuthView.vue'
import LayoutView from '../views/Layout/Layout.vue'
import Overview from '../views/Overview/Overview.vue'
import InvoicesList from '../views/Invoices/InvoicesList.vue'
import InvoicesUpload from '../views/Invoices/InvoicesUpload.vue'
import ProgressCard from '../views/Invoices/ProgressCard.vue'
import Rules from '../views/Rule/Rules.vue'
import { getToken } from '../utils/token'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/auth' },
    { path: '/auth', name: 'auth', component: AuthView },
    { path: '/layout', name: 'layout', component: LayoutView, meta: { requiresAuth: true }, children: [
      { path: '', redirect: { name: 'overview' } },
      { path: 'overview', name: 'overview', component: Overview },
      { path: 'invoices', name: 'invoice-list', component: InvoicesList },
      { path: 'invoices/upload', name: 'upload-invoice', component: InvoicesUpload },
      { path: 'invoices/progress', name: 'reimbursement-progress', component: ProgressCard },
      { path: 'rules', name: 'rules', component: Rules },
    ] },
  ],
})

router.beforeEach(async (to) => {
  const token = getToken()
  if (!token && to.meta.requiresAuth) return { name: 'auth', replace: true }
  if (!token) return true

  const authStore = useAuthStore()
  const valid = authStore.user ? true : await authStore.restoreSession()
  if (!valid && to.meta.requiresAuth) return { name: 'auth', replace: true }
  if (valid && to.name === 'auth') return { name: 'layout', replace: true }
  return true
})

export default router
