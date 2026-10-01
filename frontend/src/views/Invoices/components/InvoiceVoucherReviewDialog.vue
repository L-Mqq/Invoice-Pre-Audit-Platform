<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from 'vue'
import { ElMessage } from 'element-plus'
import type {
  VoucherFile,
  VoucherGroup,
  VoucherReviewStatus,
  VoucherType,
} from '../../../apis/voucher'

interface VoucherReviewPayload {
  groupId: number
  reviewStatus: 'approved' | 'rejected'
  note: string
}

const visible = defineModel<boolean>('visible', {
  default: false,
})

const props = defineProps<{
  voucherGroups: VoucherGroup[]
  previewing: boolean
  reviewing: boolean
}>()

const emit = defineEmits<{
  previewFile: [voucherId: number]
  review: [payload: VoucherReviewPayload]
}>()

const activeTab = ref<VoucherType>('order_screenshot')
const reviewNote = ref('')

const currentVoucherGroup = computed<VoucherGroup | null>(() => {
  return props.voucherGroups[0] || null
})

const historicalVoucherGroups = computed(() => {
  return props.voucherGroups.slice(1)
})

const canReviewCurrentGroup = computed(() => {
  return currentVoucherGroup.value?.review_status === 'pending_review'
})

const currentTabFiles = computed<VoucherFile[]>(() => {
  return currentVoucherGroup.value?.files.filter(
    (file) => file.voucher_type === activeTab.value,
  ) || []
})

// 把状态值翻译成中文标签。
function getStatusLabel(status: VoucherReviewStatus): string {
  const labels: Record<VoucherReviewStatus, string> = {
    pending_upload: '凭证待补齐',
    pending_review: '待管理员核验',
    approved: '凭证已通过',
    rejected: '凭证已驳回',
  }

  return labels[status]
}

// 把状态映射成 Element Plus 的标签颜色。
function getStatusType(
  status: VoucherReviewStatus,
): 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'approved') {
    return 'success'
  }

  if (status === 'rejected') {
    return 'danger'
  }

  if (status === 'pending_upload') {
    return 'warning'
  }

  return 'info'
}

// 从一组凭证里，按类型筛选文件
function getFilesByType(
  group: VoucherGroup,
  voucherType: VoucherType,
): VoucherFile[] {
  return group.files.filter((file) => file.voucher_type === voucherType)
}

// 把字节数格式化成人看的单位
function formatFileSize(fileSize: number | string): string {
  const size = Number(fileSize)

  if (!Number.isFinite(size) || size < 1024) {
    return `${Math.max(size, 0)} B`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

// 管理员点“通过”或“驳回”时，处理审核操作
function requestReview(reviewStatus: 'approved' | 'rejected') {
  const group = currentVoucherGroup.value

  if (!group || !canReviewCurrentGroup.value) {
    return
  }

  if (reviewStatus === 'rejected' && !reviewNote.value.trim()) {
    ElMessage.warning('驳回凭证时请填写驳回原因')
    return
  }

  emit('review', {
    groupId: group.id,
    reviewStatus,
    note: reviewNote.value.trim(),
  })
}

// 关闭弹窗
function closeDialog() {
  visible.value = false
}

watch(
  () => visible.value,
  (isVisible) => {
    if (isVisible) {
      activeTab.value = 'order_screenshot'
      reviewNote.value = ''
    }
  },
)
</script>

<template>
  <el-dialog
    v-model="visible"
    title="凭证详情与审核"
    width="min(860px, 94vw)"
    class="voucher-review-dialog"
    :lock-scroll="true"
    destroy-on-close
  >
    <div
      class="voucher-review-content"
      @wheel.stop
    >
      <template v-if="currentVoucherGroup">
        <section class="voucher-summary">
          <div>
            <span>凭证组</span>
            <strong>{{ currentVoucherGroup.group_name || `凭证组 #${currentVoucherGroup.id}` }}</strong>
          </div>
          <div>
            <span>提交时间</span>
            <strong>{{ currentVoucherGroup.created_at }}</strong>
          </div>
          <div>
            <span>当前状态</span>
            <el-tag
              :type="getStatusType(currentVoucherGroup.review_status)"
              effect="plain"
            >
              {{ getStatusLabel(currentVoucherGroup.review_status) }}
            </el-tag>
          </div>
        </section>

        <el-alert
          v-if="currentVoucherGroup.review_status === 'pending_upload'"
          title="当前凭证组文件尚未补齐，订单截图和支付记录均至少需要一份。"
          type="warning"
          :closable="false"
          show-icon
        />

        <el-alert
          v-if="currentVoucherGroup.review_status === 'rejected'"
          :title="currentVoucherGroup.review_note || '该凭证组已被驳回。'"
          type="error"
          :closable="false"
          show-icon
        />

        <el-tabs v-model="activeTab">
          <el-tab-pane
            :label="`订单截图（${getFilesByType(currentVoucherGroup, 'order_screenshot').length}）`"
            name="order_screenshot"
          >
            <el-table
              :data="currentTabFiles"
              empty-text="暂无订单截图"
              max-height="260"
            >
              <el-table-column
                prop="original_name"
                label="文件名"
                min-width="240"
              />
              <el-table-column
                label="文件大小"
                width="110"
              >
                <template #default="{ row }">
                  {{ formatFileSize(row.file_size) }}
                </template>
              </el-table-column>
              <el-table-column
                prop="created_at"
                label="上传时间"
                min-width="160"
              />
              <el-table-column
                label="操作"
                width="90"
              >
                <template #default="{ row }">
                  <el-button
                    link
                    type="primary"
                    :loading="previewing"
                    @click="emit('previewFile', row.id)"
                  >
                    预览
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane
            :label="`支付记录（${getFilesByType(currentVoucherGroup, 'payment_record').length}）`"
            name="payment_record"
          >
            <el-table
              :data="currentTabFiles"
              empty-text="暂无支付记录"
              max-height="260"
            >
              <el-table-column
                prop="original_name"
                label="文件名"
                min-width="240"
              />
              <el-table-column
                label="文件大小"
                width="110"
              >
                <template #default="{ row }">
                  {{ formatFileSize(row.file_size) }}
                </template>
              </el-table-column>
              <el-table-column
                prop="created_at"
                label="上传时间"
                min-width="160"
              />
              <el-table-column
                label="操作"
                width="90"
              >
                <template #default="{ row }">
                  <el-button
                    link
                    type="primary"
                    :loading="previewing"
                    @click="emit('previewFile', row.id)"
                  >
                    预览
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>

        <section
          v-if="canReviewCurrentGroup"
          class="voucher-review-form"
        >
          <h3>管理员核验</h3>
          <el-input
            v-model="reviewNote"
            type="textarea"
            :rows="3"
            maxlength="2000"
            show-word-limit
            placeholder="通过时可填写审核说明；驳回时必须填写驳回原因"
          />
        </section>

        <el-collapse v-if="historicalVoucherGroups.length > 0">
          <el-collapse-item
            :title="`历史凭证记录（${historicalVoucherGroups.length}）`"
            name="voucher-history"
          >
            <div class="voucher-history-list">
              <article
                v-for="group in historicalVoucherGroups"
                :key="group.id"
                class="voucher-history-item"
              >
                <div class="voucher-history-heading">
                  <strong>{{ group.group_name || `凭证组 #${group.id}` }}</strong>
                  <el-tag
                    :type="getStatusType(group.review_status)"
                    effect="plain"
                  >
                    {{ getStatusLabel(group.review_status) }}
                  </el-tag>
                </div>
                <p v-if="group.review_note">{{ group.review_note }}</p>
                <div class="voucher-history-files">
                  <div>
                    <span>订单截图</span>
                    <el-button
                      v-for="file in getFilesByType(group, 'order_screenshot')"
                      :key="file.id"
                      link
                      type="primary"
                      :loading="previewing"
                      @click="emit('previewFile', file.id)"
                    >
                      {{ file.original_name }}
                    </el-button>
                  </div>
                  <div>
                    <span>支付记录</span>
                    <el-button
                      v-for="file in getFilesByType(group, 'payment_record')"
                      :key="file.id"
                      link
                      type="primary"
                      :loading="previewing"
                      @click="emit('previewFile', file.id)"
                    >
                      {{ file.original_name }}
                    </el-button>
                  </div>
                </div>
              </article>
            </div>
          </el-collapse-item>
        </el-collapse>
      </template>

      <el-empty
        v-else
        description="暂无可查看的凭证组"
      />
    </div>

    <template #footer>
      <el-button @click="closeDialog">
        关闭
      </el-button>
      <template v-if="canReviewCurrentGroup">
        <el-button
          type="danger"
          plain
          :loading="reviewing"
          :disabled="reviewing"
          @click="requestReview('rejected')"
        >
          驳回凭证
        </el-button>
        <el-button
          type="primary"
          :loading="reviewing"
          :disabled="reviewing"
          @click="requestReview('approved')"
        >
          通过凭证
        </el-button>
      </template>
    </template>
  </el-dialog>
</template>

<style scoped>
:global(.voucher-review-dialog) {
  display: flex;
  max-height: 92vh;
  flex-direction: column;
  margin: 4vh auto !important;
}

:global(.voucher-review-dialog .el-dialog__body) {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.voucher-review-content {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.voucher-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
}

.voucher-summary div {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.voucher-summary span {
  color: #64748b;
  font-size: 12px;
}

.voucher-summary strong {
  overflow-wrap: anywhere;
  color: #334155;
  font-size: 14px;
}

.voucher-review-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  background: #f8fbff;
}

.voucher-review-form h3 {
  margin: 0;
  color: #1e3a8a;
  font-size: 15px;
}

.voucher-history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.voucher-history-item {
  padding: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.voucher-history-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.voucher-history-heading strong {
  color: #334155;
  font-size: 14px;
}

.voucher-history-item p {
  margin: 10px 0 0;
  color: #b91c1c;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.voucher-history-files {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
}

.voucher-history-files div {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.voucher-history-files span {
  color: #64748b;
  font-size: 12px;
}

@media (max-width: 600px) {
  .voucher-summary {
    grid-template-columns: 1fr;
  }
}
</style>
