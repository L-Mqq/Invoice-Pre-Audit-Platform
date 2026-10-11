<script setup lang="ts">
interface PriorityTask {
  invoiceId: number
  invoiceNumber: string
  sellerName: string
  totalAmount: string
  submittedAt: string
  statusLabel: string
  statusTone: 'primary' | 'warning' | 'danger'
  reason: string
}

defineProps<{
  tasks: PriorityTask[]
}>()
</script>

<template>
  <el-card
    class="panel-card"
    shadow="never"
  >
    <template #header>
      <div class="card-heading">
        <div>
          <h2>优先处理</h2>
          <p>按待办类型和提交时间排列的示例任务</p>
        </div>
        <el-tag type="danger">{{ tasks.length }} 项</el-tag>
      </div>
    </template>

    <div
      v-if="tasks.length"
      class="task-list"
    >
      <article
        v-for="task in tasks"
        :key="task.invoiceId"
        class="task-item"
      >
        <div class="task-topline">
          <div class="task-title">
            <strong>{{ task.invoiceNumber }}</strong>
            <span>{{ task.sellerName }}</span>
          </div>
          <el-tag
            :type="task.statusTone"
            effect="plain"
            size="small"
          >
            {{ task.statusLabel }}
          </el-tag>
        </div>
        <div class="task-meta">
          <span>{{ task.totalAmount }}</span>
          <span>提交于 {{ task.submittedAt }}</span>
        </div>
        <p>{{ task.reason }}</p>
      </article>
    </div>
    <el-empty
      v-else
      :image-size="76"
      description="暂无待处理任务"
    />
  </el-card>
</template>

<style scoped>
.panel-card {
  border-color: #e5eaf2;
  border-radius: 14px;
}

:deep(.panel-card > .el-card__header) {
  padding: 20px 22px 16px;
  border-bottom-color: #edf1f6;
}

:deep(.panel-card > .el-card__body) {
  padding: 4px 22px 14px;
}

.card-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.card-heading h2 {
  margin: 0;
  color: #334155;
  font-size: 17px;
}

.card-heading p {
  margin: 6px 0 0;
  color: #94a3b8;
  font-size: 13px;
}

.task-list {
  display: flex;
  flex-direction: column;
}

.task-item {
  padding: 15px 0;
  border-bottom: 1px solid #edf1f6;
}

.task-item:last-child {
  border-bottom: 0;
}

.task-topline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.task-title {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
}

.task-title strong {
  color: #475569;
  font-size: 14px;
}

.task-title span {
  overflow: hidden;
  color: #64748b;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-meta {
  display: flex;
  gap: 16px;
  margin-top: 9px;
  color: #94a3b8;
  font-size: 12px;
}

.task-meta span:first-child {
  color: #475569;
  font-weight: 600;
}

.task-item p {
  margin: 8px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}
</style>
