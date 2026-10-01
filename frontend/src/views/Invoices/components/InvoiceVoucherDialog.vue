<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from 'vue'
import {
  ElMessage,
  type UploadUserFile,
} from 'element-plus'
import type {
  VoucherGroup,
  VoucherType,
} from '../../../apis/voucher'

const visible = defineModel<boolean>('visible', {
  default: false,
})

const props = defineProps<{
  actionLabel: string | null
  latestVoucherGroup: VoucherGroup | null
}>()

const emit = defineEmits<{
  submit: []
}>()

const activeTab = ref<VoucherType>('order_screenshot')
const orderScreenshotFiles = ref<UploadUserFile[]>([])
const paymentRecordFiles = ref<UploadUserFile[]>([])

const canSubmitVoucher = computed(() => {
  return orderScreenshotFiles.value.length > 0
    && paymentRecordFiles.value.length > 0
})

const isResubmission = computed(() => {
  return props.latestVoucherGroup?.review_status === 'rejected'
})

const historicalOrderFiles = computed(() => {
  return props.latestVoucherGroup?.files.filter(
    (file) => file.voucher_type === 'order_screenshot',
  ) || []
})

const historicalPaymentFiles = computed(() => {
  return props.latestVoucherGroup?.files.filter(
    (file) => file.voucher_type === 'payment_record',
  ) || []
})

function resetSelectedFiles() {
  activeTab.value = 'order_screenshot'
  orderScreenshotFiles.value = []
  paymentRecordFiles.value = []
}

function handleExceed() {
  ElMessage.warning('单次最多选择 10 个文件')
}

function handleSubmit() {
  if (!canSubmitVoucher.value) {
    ElMessage.warning('请至少上传一张订单截图和一张支付记录')
    return
  }

  emit('submit')
}

function closeDialog() {
  visible.value = false
}

watch(
  () => visible.value,
  (isVisible) => {
    if (isVisible) {
      resetSelectedFiles()
    }
  },
)
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="actionLabel || '提交凭证'"
    width="min(720px, 94vw)"
    class="voucher-dialog"
    :lock-scroll="true"
    destroy-on-close
  >
    <div
      class="voucher-dialog-content"
      @wheel.stop
    >
      <el-alert
        title="请上传能够共同证明本张发票交易与支付情况的材料。订单截图和支付记录均至少需要一份。"
        type="info"
        :closable="false"
        show-icon
      />

      <el-alert
        v-if="isResubmission"
        :title="latestVoucherGroup?.review_note || '上一组凭证已被驳回，请根据审核意见重新准备完整材料。'"
        type="error"
        :closable="false"
        show-icon
      />

      <el-tabs v-model="activeTab">
        <el-tab-pane
          :label="`订单截图（${orderScreenshotFiles.length}）`"
          name="order_screenshot"
        >
          <div class="upload-section">
            <p class="upload-section-description">
              可上传多张订单截图，用于说明商品、订单金额和交易关联关系。
            </p>

            <el-upload
              v-model:file-list="orderScreenshotFiles"
              action="#"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              :auto-upload="false"
              drag
              multiple
              :limit="10"
              :on-exceed="handleExceed"
            >
              <div class="upload-trigger">
                <strong>选择订单截图</strong>
                <span>支持 JPG、PNG、WEBP、PDF，单个文件不超过 10MB</span>
              </div>
            </el-upload>
          </div>
        </el-tab-pane>

        <el-tab-pane
          :label="`支付记录（${paymentRecordFiles.length}）`"
          name="payment_record"
        >
          <div class="upload-section">
            <p class="upload-section-description">
              可上传多张支付记录，用于说明付款金额、付款主体和支付时间。
            </p>

            <el-upload
              v-model:file-list="paymentRecordFiles"
              action="#"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              :auto-upload="false"
              drag
              multiple
              :limit="10"
              :on-exceed="handleExceed"
            >
              <div class="upload-trigger">
                <strong>选择支付记录</strong>
                <span>支持 JPG、PNG、WEBP、PDF，单个文件不超过 10MB</span>
              </div>
            </el-upload>
          </div>
        </el-tab-pane>
      </el-tabs>

      <el-collapse v-if="isResubmission">
        <el-collapse-item title="查看上一次被驳回的凭证" name="latest-rejected-voucher">
          <div class="historical-voucher">
            <div>
              <span>订单截图</span>
              <p>{{ historicalOrderFiles.map((file) => file.original_name).join('、') || '无' }}</p>
            </div>
            <div>
              <span>支付记录</span>
              <p>{{ historicalPaymentFiles.map((file) => file.original_name).join('、') || '无' }}</p>
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>

      <p class="submission-hint">
        仅完成本地文件选择；凭证组创建与文件上传接口将在下一步接入。
      </p>
    </div>

    <template #footer>
      <el-button @click="closeDialog">
        取消
      </el-button>
      <el-button
        type="primary"
        :disabled="!canSubmitVoucher"
        @click="handleSubmit"
      >
        {{ actionLabel || '提交凭证' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
:global(.voucher-dialog) {
  display: flex;
  max-height: 92vh;
  flex-direction: column;
  margin: 4vh auto !important;
}

:global(.voucher-dialog .el-dialog__body) {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.voucher-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.upload-section {
  padding: 4px 0;
}

.upload-section-description {
  margin: 0 0 12px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}

.upload-trigger {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
}

.upload-trigger strong {
  color: #334155;
  font-size: 14px;
}

.upload-trigger span {
  color: #94a3b8;
  font-size: 12px;
}

.historical-voucher {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 0;
}

.historical-voucher div {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr);
  gap: 12px;
}

.historical-voucher span {
  color: #64748b;
  font-size: 13px;
}

.historical-voucher p {
  margin: 0;
  color: #334155;
  font-size: 13px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.submission-hint {
  margin: 0;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.6;
}

@media (max-width: 480px) {
  .historical-voucher div {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}
</style>
