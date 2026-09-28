import { createRouter, createWebHistory } from 'vue-router'
import AuthView from '../views/Login/AuthView.vue'
import LayoutView from '../views/Layout/Layout.vue'
import Overview from '../views/Overview/Overview.vue'
import InvoicesList from '../views/Invoices/InvoicesList.vue'
import InvoicesDetail from '../views/Invoices/InvoicesDetail.vue'
import InvoicesUpload from '../views/Invoices/InvoicesUpload.vue'
import ProgressCard from '../views/Invoices/ProgressCard.vue'
import Rules from '../views/Rule/Rules.vue'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/auth' },
    { path: '/auth', name: 'auth', component: AuthView },
    { path: '/layout', name: 'layout', component: LayoutView,
       meta: { requiresAuth: true }, 
       children: [
      { path: '', redirect: { name: 'overview' } },
      { path: 'overview', name: 'overview', component: Overview },
      { path: 'invoices', name: 'invoice-list', component: InvoicesList },
      { path: 'invoices/:invoiceId', name: 'invoice-detail', component: InvoicesDetail },
      { path: 'invoices/upload', name: 'upload-invoice', component: InvoicesUpload },
      { path: 'invoices/progress', name: 'reimbursement-progress', component: ProgressCard },
      { path: 'rules', name: 'rules', component: Rules },
    ] },
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  if (to.name === 'auth') {
    if (!authStore.isAuthenticated) {
      return true
    }

    if (!authStore.user) {
      const restored = await authStore.restoreSession()

      if (!restored) {
        return true
      }
    }

    return {
      name: 'layout',
      replace: true,
    }
  }

  if (!to.meta.requiresAuth) {
    return true
  }

  if (!authStore.isAuthenticated) {
    return {
      name: 'auth',
      replace: true,
    }
  }

  if (authStore.user) {
    return true
  }

  const restored = await authStore.restoreSession()
  if (restored) {
    return true
  }

  return {
    name: 'auth',
    replace: true,
  }
})

export default router
