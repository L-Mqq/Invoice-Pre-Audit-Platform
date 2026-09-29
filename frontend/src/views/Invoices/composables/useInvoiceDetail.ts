import {
  computed,
  ref,
  watch,
} from 'vue'
import { useRoute } from 'vue-router'
import {
  getInvoiceDetail,
  type InvoiceDetail,
  type InvoiceDetailFile,
} from '../../../apis/invoices'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return '获取发票详情失败'
}

export function useInvoiceDetail() {
  const route = useRoute()
  const invoiceDetail = ref<InvoiceDetail | null>(null)
  const selectedFileId = ref<number | null>(null)
  const loading = ref(false)
  const loadError = ref('')

  const selectedFile = computed<InvoiceDetailFile | null>(() => {
    if (!invoiceDetail.value || selectedFileId.value === null) {
      return null
    }

    return invoiceDetail.value.files.find(
      (file) => file.id === selectedFileId.value,
    ) || null
  })

  const firstItemReason = computed(() => {
    return invoiceDetail.value?.items[0]?.aiCategoryReason || '暂无判断依据'
  })

  function getRouteInvoiceId(): number | null {
    const value = route.params.invoiceId
    const rawInvoiceId = Array.isArray(value) ? value[0] : value
    const invoiceId = Number(rawInvoiceId)

    if (!Number.isSafeInteger(invoiceId) || invoiceId <= 0) {
      return null
    }

    return invoiceId
  }

  async function loadInvoiceDetail() {
    const invoiceId = getRouteInvoiceId()

    invoiceDetail.value = null
    selectedFileId.value = null
    loadError.value = ''

    if (!invoiceId) {
      loadError.value = '发票 ID 无效'
      return
    }

    loading.value = true

    try {
      const detail = await getInvoiceDetail(invoiceId)

      invoiceDetail.value = detail
      selectedFileId.value = detail.files[0]?.id || null
    } catch (error) {
      loadError.value = getErrorMessage(error)
    } finally {
      loading.value = false
    }
  }

  watch(
    () => route.params.invoiceId,
    () => {
      loadInvoiceDetail()
    },
    {
      immediate: true,
    },
  )

  return {
    firstItemReason,
    invoiceDetail,
    loadError,
    loading,
    loadInvoiceDetail,
    selectedFile,
    selectedFileId,
    getRouteInvoiceId,
  }
}
