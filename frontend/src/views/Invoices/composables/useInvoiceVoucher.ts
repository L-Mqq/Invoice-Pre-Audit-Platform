import {
  computed,
  ref,
  watch,
  type Ref,
} from 'vue'
import {
  getVoucherGroups,
  getWeeklyVoucherRequirements,
  type VoucherGroup,
  type WeeklyVoucherRequirement,
} from '../../../apis/voucher'
import type { InvoiceDetail } from '../../../apis/invoices'

interface UseInvoiceVoucherOptions {
  invoiceDetail: Ref<InvoiceDetail | null>
}

type VoucherStatusType = 'success' | 'warning' | 'danger' | 'info'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return '获取凭证组失败'
}

export function useInvoiceVoucher(
  options: UseInvoiceVoucherOptions,
) {
  // 凭证组信息
  const voucherGroups = ref<VoucherGroup[]>([])
  // 凭证组状态
  const voucherGroupsLoading = ref(false)
  // 错误信息
  const voucherGroupsError = ref('')
  const weeklyVoucherRequirements = ref<WeeklyVoucherRequirement[]>([])
  const weeklyVoucherRequirementsLoading = ref(false)
  const weeklyVoucherRequirementsError = ref('')

  const pendingWeeklyVoucherRequirement = computed(() => {
    return weeklyVoucherRequirements.value.find((requirement) => {
      return requirement.status === 'pending'
    }) || null
  })

  const isWeeklyVoucherRequired = computed(() => {
    return pendingWeeklyVoucherRequirement.value?.currentInvoice.voucherStatus === 'pending'
  })

  const isDirectVoucherRequired = computed(() => {
    return options.invoiceDetail.value?.qualificationStatus === 'pending_voucher'
      && !pendingWeeklyVoucherRequirement.value
  })

  const isVoucherRequired = computed(() => {
    return isDirectVoucherRequired.value || isWeeklyVoucherRequired.value
  })

  const latestVoucherGroup = computed<VoucherGroup | null>(() => {
    return voucherGroups.value[0] || null
  })

  const voucherStatusLabel = computed(() => {
    const group = latestVoucherGroup.value

    if (!group) {
      return '待提交凭证'
    }

    const labels = {
      pending_upload: '凭证待补齐',
      pending_review: '等待管理员核验',
      approved: '凭证已核验通过',
      rejected: '凭证已驳回',
    }

    return labels[group.review_status]
  })

  const voucherStatusDescription = computed(() => {
    const group = latestVoucherGroup.value

    if (!group) {
      if (isWeeklyVoucherRequired.value) {
        return '因同销售方本周累计超过 1000 元，当前发票需补齐支付凭证。'
      }

      return '请准备订单截图和支付记录，两个类型均至少上传一份后提交核验。'
    }

    if (group.review_status === 'pending_upload') {
      return '当前凭证组尚未补齐订单截图或支付记录，请继续上传。'
    }

    if (group.review_status === 'pending_review') {
      return '凭证文件已提交，正在等待管理员核验。'
    }

    if (group.review_status === 'rejected') {
      return group.review_note || '管理员已驳回该凭证组，请重新提交完整凭证。'
    }

    return '凭证已通过管理员核验。'
  })

  const voucherStatusType = computed<VoucherStatusType>(() => {
    const status = latestVoucherGroup.value?.review_status

    if (status === 'approved') {
      return 'success'
    }

    if (status === 'rejected') {
      return 'danger'
    }

    if (status === 'pending_upload' || !status) {
      return 'warning'
    }

    return 'info'
  })

  const primaryVoucherActionLabel = computed<string | null>(() => {
    const status = latestVoucherGroup.value?.review_status

    if (!status) {
      return isWeeklyVoucherRequired.value
        ? '补齐周累计凭证'
        : '提交凭证'
    }

    if (status === 'pending_upload') {
      return '继续提交凭证'
    }

    if (status === 'rejected') {
      return '重新提交凭证'
    }

    return null
  })

  const canViewVouchers = computed(() => {
    return voucherGroups.value.length > 0
  })

  const showVoucherSection = computed(() => {
    return isVoucherRequired.value || canViewVouchers.value
  })

  // 获取凭证组
  async function loadVoucherGroups() {
    const invoice = options.invoiceDetail.value

    voucherGroups.value = []
    voucherGroupsError.value = ''

    if (!invoice) {
      return
    }

    voucherGroupsLoading.value = true

    try {
      const result = await getVoucherGroups(invoice.id)
      voucherGroups.value = result.groups
    } catch (error) {
      voucherGroupsError.value = getErrorMessage(error)
    } finally {
      voucherGroupsLoading.value = false
    }
  }

  async function loadWeeklyVoucherRequirements() {
    const invoice = options.invoiceDetail.value

    weeklyVoucherRequirements.value = []
    weeklyVoucherRequirementsError.value = ''

    if (!invoice) {
      return
    }

    weeklyVoucherRequirementsLoading.value = true

    try {
      const result = await getWeeklyVoucherRequirements(invoice.id)
      weeklyVoucherRequirements.value = result.requirements
    } catch (error) {
      weeklyVoucherRequirementsError.value = getErrorMessage(error)
    } finally {
      weeklyVoucherRequirementsLoading.value = false
    }
  }

  watch(
    () => options.invoiceDetail.value,
    () => {
      loadVoucherGroups()
      loadWeeklyVoucherRequirements()
    },
    {
      immediate: true,
    },
  )

  return {
    canViewVouchers,
    isVoucherRequired,
    isWeeklyVoucherRequired,
    latestVoucherGroup,
    loadVoucherGroups,
    loadWeeklyVoucherRequirements,
    primaryVoucherActionLabel,
    showVoucherSection,
    voucherGroups,
    voucherGroupsError,
    voucherGroupsLoading,
    voucherStatusDescription,
    voucherStatusLabel,
    voucherStatusType,
    pendingWeeklyVoucherRequirement,
    weeklyVoucherRequirements,
    weeklyVoucherRequirementsError,
    weeklyVoucherRequirementsLoading,
  }
}
