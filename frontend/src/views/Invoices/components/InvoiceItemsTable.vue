<script setup lang="ts">
import type { InvoiceDetailItem } from '../../../apis/invoices'

defineProps<{
  items: InvoiceDetailItem[]
  firstItemReason: string
}>()

const emit = defineEmits<{
  viewEvidence: [item: InvoiceDetailItem]
}>()

function formatAmount(amount: number | string | null): string {
  return `¥${Number(amount || 0).toFixed(2)}`
}

function getPriceTypeLabel(priceType: InvoiceDetailItem['priceType']): string {
  const labels = {
    material: '材料',
    low_value: '低值品',
    asset: '资产',
  }

  return priceType ? labels[priceType] : '待判断'
}

function getCategoryResult(item: InvoiceDetailItem): string {
  return item.finalCategoryResult || item.manualCategoryResult || item.aiCategoryResult || '待判断'
}
</script>

<template>
  <el-card
    shadow="never"
    class="detail-card"
  >
    <div class="card-title">
      <h2>商品明细</h2>
      <span class="card-caption">{{ items.length }} 个商品</span>
    </div>

    <el-table
      :data="items"
      stripe
      empty-text="暂无商品明细"
    >
      <el-table-column
        prop="itemName"
        label="商品名称"
        min-width="170"
      />
      <el-table-column
        prop="quantity"
        label="数量"
        width="80"
      />
      <el-table-column
        label="单价"
        width="120"
      >
        <template #default="{ row }">
          {{ formatAmount(row.unitPrice) }}
        </template>
      </el-table-column>
      <el-table-column
        label="明细金额"
        width="120"
      >
        <template #default="{ row }">
          {{ formatAmount(row.lineAmount) }}
        </template>
      </el-table-column>
      <el-table-column
        label="单价分类"
        width="110"
      >
        <template #default="{ row }">
          <el-tag effect="plain">
            {{ getPriceTypeLabel(row.priceType) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="品类结果"
        width="100"
      >
        <template #default="{ row }">
          <el-tag
            type="warning"
            effect="plain"
          >
            {{ getCategoryResult(row) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="判断依据"
        width="110"
      >
        <template #default="{ row }">
          <el-button
            link
            type="primary"
            @click="emit('viewEvidence', row)"
          >
            查看依据
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="reason-row">
      <span>判断依据</span>
      <p>{{ firstItemReason }}</p>
    </div>
  </el-card>
</template>

<style scoped>
.detail-card {
  border: 1px solid #e2e8f0;
  border-radius: 14px;
}

.card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.card-title h2 {
  margin: 0;
  font-size: 17px;
}

.card-caption {
  color: #94a3b8;
  font-size: 12px;
}

.reason-row {
  display: flex;
  gap: 16px;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid #f1f5f9;
  color: #64748b;
  font-size: 12px;
}

.reason-row p {
  margin: 0;
  color: #475569;
}
</style>
