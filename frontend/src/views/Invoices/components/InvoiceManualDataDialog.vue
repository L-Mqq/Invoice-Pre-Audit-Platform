<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from 'vue'
import { ElMessage } from 'element-plus'
import type {
  InvoiceDataIssue,
  InvoiceDetail,
} from '../../../apis/invoices'
import type {
  ManualInvoiceData,
  ManualInvoiceItemData,
} from '../../../apis/invoiceReview'

interface ManualDataFormItem {
  key: string
  itemId?: number
  itemName: string
  quantity: number | null
  unitPrice: number | null
  lineAmount: number | null
}

interface ManualDataSubmitPayload {
  invoice?: ManualInvoiceData
  items?: ManualInvoiceItemData[]
  note: string
}

const props = defineProps<{
  visible: boolean
  invoice: InvoiceDetail | null
  dataIssues: InvoiceDataIssue[]
  submitting: boolean
}>()

const emit = defineEmits<{
  'update:visible': [visible: boolean]
  submit: [payload: ManualDataSubmitPayload]
}>()

const sellerName = ref('')
const sellerTaxId = ref('')
const invoiceNumber = ref('')
const invoiceDate = ref('')
const totalAmount = ref<number | null>(null)
const note = ref('')
const items = ref<ManualDataFormItem[]>([])
const initialInvoice = ref<ManualInvoiceData>({})
const initialItems = ref<ManualDataFormItem[]>([])
let newItemSequence = 0

const isInvoiceNumberRequired = computed(() => {
  return props.dataIssues.some((issue) => {
    return issue.scope === 'invoice'
      && issue.field === 'invoiceNumber'
  })
})

function toNumber(value: number | string | null): number | null {
  if (value === null || value === '') {
    return null
  }

  const normalizedValue = Number(value)

  return Number.isFinite(normalizedValue)
    ? normalizedValue
    : null
}

function toDateValue(value: string | null): string {
  return value ? value.slice(0, 10) : ''
}

function createFormItem(
  item: InvoiceDetail['items'][number],
): ManualDataFormItem {
  return {
    key: `existing-${item.id}`,
    itemId: item.id,
    itemName: item.itemName || '',
    quantity: toNumber(item.quantity),
    unitPrice: toNumber(item.unitPrice),
    lineAmount: toNumber(item.lineAmount),
  }
}

function cloneFormItem(item: ManualDataFormItem): ManualDataFormItem {
  return {
    key: item.key,
    itemId: item.itemId,
    itemName: item.itemName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineAmount: item.lineAmount,
  }
}

function resetForm() {
  if (!props.invoice) {
    return
  }

  sellerName.value = props.invoice.sellerName || ''
  sellerTaxId.value = props.invoice.sellerTaxId || ''
  invoiceNumber.value = props.invoice.invoiceNumber || ''
  invoiceDate.value = toDateValue(props.invoice.invoiceDate)
  totalAmount.value = toNumber(props.invoice.totalAmount)
  note.value = ''
  initialInvoice.value = {
    invoiceNumber: props.invoice.invoiceNumber,
    sellerName: props.invoice.sellerName,
    sellerTaxId: props.invoice.sellerTaxId,
    invoiceDate: toDateValue(props.invoice.invoiceDate) || null,
    totalAmount: toNumber(props.invoice.totalAmount) ?? undefined,
  }
  initialItems.value = props.invoice.items.map((item) => {
    return createFormItem(item)
  })
  items.value = initialItems.value.map((item) => {
    return cloneFormItem(item)
  })
  newItemSequence = 0
}

function addItem() {
  newItemSequence += 1
  items.value.push({
    key: `new-${newItemSequence}`,
    itemName: '',
    quantity: null,
    unitPrice: null,
    lineAmount: null,
  })
}

function removeNewItem(index: number) {
  if (items.value[index]?.itemId) {
    return
  }

  items.value.splice(index, 1)
}

function hasSameNumber(
  left: number | null,
  right: number | null,
): boolean {
  if (left === null || right === null) {
    return left === right
  }

  return Math.abs(left - right) < 0.000001
}

function hasItemChanged(
  item: ManualDataFormItem,
  initialItem: ManualDataFormItem,
): boolean {
  return item.itemName.trim() !== initialItem.itemName.trim()
    || !hasSameNumber(item.quantity, initialItem.quantity)
    || !hasSameNumber(item.unitPrice, initialItem.unitPrice)
    || !hasSameNumber(item.lineAmount, initialItem.lineAmount)
}

function validateItem(item: ManualDataFormItem): ManualInvoiceItemData | null {
  if (!item.itemName.trim()) {
    ElMessage.warning('请补全商品名称')
    return null
  }

  if (
    item.quantity === null
    || item.unitPrice === null
    || item.lineAmount === null
  ) {
    ElMessage.warning(`请补全商品“${item.itemName.trim()}”的数量、单价和金额`)
    return null
  }

  if (
    item.quantity < 0
    || item.unitPrice < 0
    || item.lineAmount < 0
  ) {
    ElMessage.warning('商品数量、单价和金额不能为负数')
    return null
  }

  return {
    ...(item.itemId ? { itemId: item.itemId } : {}),
    itemName: item.itemName.trim(),
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineAmount: item.lineAmount,
  }
}

function submit() {
  const normalizedNote = note.value.trim()

  if (!normalizedNote) {
    ElMessage.warning('请填写人工补全说明')
    return
  }

  const invoicePatch: ManualInvoiceData = {}
  const normalizedInvoiceNumber = invoiceNumber.value.trim() || null
  const normalizedSellerName = sellerName.value.trim() || null
  const normalizedSellerTaxId = sellerTaxId.value.trim() || null
  const normalizedInvoiceDate = invoiceDate.value || null

  if (isInvoiceNumberRequired.value && !normalizedInvoiceNumber) {
    ElMessage.warning('请补全发票号码')
    return
  }

  if (normalizedInvoiceNumber !== initialInvoice.value.invoiceNumber) {
    invoicePatch.invoiceNumber = normalizedInvoiceNumber
  }

  if (normalizedSellerName !== initialInvoice.value.sellerName) {
    invoicePatch.sellerName = normalizedSellerName
  }

  if (normalizedSellerTaxId !== initialInvoice.value.sellerTaxId) {
    invoicePatch.sellerTaxId = normalizedSellerTaxId
  }

  if (normalizedInvoiceDate !== initialInvoice.value.invoiceDate) {
    invoicePatch.invoiceDate = normalizedInvoiceDate
  }

  if (!hasSameNumber(totalAmount.value, initialInvoice.value.totalAmount ?? null)) {
    if (totalAmount.value === null || totalAmount.value < 0) {
      ElMessage.warning('请填写有效的价税合计')
      return
    }

    invoicePatch.totalAmount = totalAmount.value
  }

  const initialItemsById = new Map(
    initialItems.value.map((item) => {
      return [item.itemId, item]
    }),
  )
  const changedItems: ManualInvoiceItemData[] = []

  for (const item of items.value) {
    const initialItem = item.itemId
      ? initialItemsById.get(item.itemId)
      : undefined
    const shouldSubmit = !initialItem || hasItemChanged(item, initialItem)

    if (!shouldSubmit) {
      continue
    }

    const normalizedItem = validateItem(item)

    if (!normalizedItem) {
      return
    }

    changedItems.push(normalizedItem)
  }

  if (Object.keys(invoicePatch).length === 0 && changedItems.length === 0) {
    ElMessage.warning('请至少补全或修正一项资料')
    return
  }

  emit('submit', {
    invoice: Object.keys(invoicePatch).length > 0
      ? invoicePatch
      : undefined,
    items: changedItems.length > 0
      ? changedItems
      : undefined,
    note: normalizedNote,
  })
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      resetForm()
    }
  },
)
</script>

<template>
  <el-dialog
    :model-value="visible"
    title="补全发票资料"
    width="860px"
    :close-on-click-modal="!submitting"
    :close-on-press-escape="!submitting"
    :show-close="!submitting"
    @update:model-value="emit('update:visible', $event)"
  >
    <div class="manual-data-dialog-content">
      <el-alert
        title="请根据原始发票补全资料。AI 原始识别结果不会被覆盖，本次修改将保留操作日志。"
        type="info"
        :closable="false"
        show-icon
      />

      <div v-if="dataIssues.length > 0" class="data-issues">
        <strong>待补全项</strong>
        <ul>
          <li
            v-for="issue in dataIssues"
            :key="`${issue.scope}-${issue.itemId || issue.itemIndex}-${issue.field}-${issue.code}`"
          >
            {{ issue.message }}
          </li>
        </ul>
      </div>

      <el-form label-position="top">
        <div class="form-section">
          <h3>发票基础信息</h3>
          <div class="invoice-form-grid">
            <el-form-item
              label="发票号码"
              :required="isInvoiceNumberRequired"
            >
              <el-input
                v-model="invoiceNumber"
                maxlength="64"
                placeholder="请输入发票号码或数电票号码"
              />
            </el-form-item>
            <el-form-item label="销售方名称">
              <el-input v-model="sellerName" maxlength="255" />
            </el-form-item>
            <el-form-item label="销售方纳税人识别号">
              <el-input v-model="sellerTaxId" maxlength="32" />
            </el-form-item>
            <el-form-item label="开票日期">
              <el-date-picker
                v-model="invoiceDate"
                type="date"
                value-format="YYYY-MM-DD"
                format="YYYY-MM-DD"
                placeholder="请选择开票日期"
              />
            </el-form-item>
            <el-form-item label="价税合计">
              <el-input-number
                v-model="totalAmount"
                :min="0"
                :precision="2"
                :step="0.01"
                controls-position="right"
              />
            </el-form-item>
          </div>
        </div>

        <div class="form-section">
          <div class="section-heading">
            <h3>商品明细</h3>
            <el-button type="primary" plain @click="addItem">
              新增商品
            </el-button>
          </div>

          <el-table :data="items" size="small" class="item-table">
            <el-table-column label="商品名称" min-width="180">
              <template #default="{ row }">
                <el-input v-model="row.itemName" maxlength="255" />
              </template>
            </el-table-column>
            <el-table-column label="数量" width="140">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.quantity"
                  :min="0"
                  :precision="4"
                  controls-position="right"
                />
              </template>
            </el-table-column>
            <el-table-column label="单价" width="150">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.unitPrice"
                  :min="0"
                  :precision="2"
                  controls-position="right"
                />
              </template>
            </el-table-column>
            <el-table-column label="行金额" width="150">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.lineAmount"
                  :min="0"
                  :precision="2"
                  controls-position="right"
                />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="90" fixed="right">
              <template #default="{ $index, row }">
                <el-button
                  v-if="!row.itemId"
                  link
                  type="danger"
                  @click="removeNewItem($index)"
                >
                  移除
                </el-button>
                <span v-else class="existing-item-label">
                  已有
                </span>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <el-form-item label="人工补全说明" required>
          <el-input
            v-model="note"
            type="textarea"
            :rows="4"
            maxlength="2000"
            show-word-limit
            placeholder="请说明补全资料的来源和修正依据"
          />
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <el-button
        :disabled="submitting"
        @click="emit('update:visible', false)"
      >
        取消
      </el-button>
      <el-button
        type="primary"
        :loading="submitting"
        @click="submit"
      >
        保存并校验
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.manual-data-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.data-issues,
.form-section {
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
}

.data-issues strong,
.form-section h3 {
  color: #334155;
  font-size: 14px;
}

.data-issues ul {
  margin: 8px 0 0;
  padding-left: 18px;
  color: #92400e;
  font-size: 13px;
  line-height: 1.8;
}

.form-section h3 {
  margin: 0;
}

.invoice-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 16px;
  margin-top: 14px;
}

.invoice-form-grid :deep(.el-date-editor),
.invoice-form-grid :deep(.el-input-number) {
  width: 100%;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.item-table :deep(.el-input-number) {
  width: 100%;
}

.existing-item-label {
  color: #94a3b8;
  font-size: 12px;
}

@media (max-width: 720px) {
  .invoice-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
