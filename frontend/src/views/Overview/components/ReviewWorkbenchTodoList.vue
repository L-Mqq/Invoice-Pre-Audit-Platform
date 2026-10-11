<script setup lang="ts">
interface TodoItem {
  label: string
  count: number
  description: string
  tone: 'primary' | 'success' | 'warning' | 'danger'
}

defineProps<{
  items: TodoItem[]
  total: number
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
          <h2>本周待办</h2>
          <p>优先处理需要人工介入的事项</p>
        </div>
        <el-tag :type="total > 0 ? 'danger' : 'success'">
          {{ total > 0 ? `${total} 项` : '已处理完成' }}
        </el-tag>
      </div>
    </template>

    <div
      v-if="total > 0"
      class="todo-list"
    >
      <div
        v-for="item in items"
        :key="item.label"
        class="todo-item"
      >
        <span
          class="todo-marker"
          :class="`todo-marker--${item.tone}`"
        ></span>
        <div class="todo-content">
          <div class="todo-title-row">
            <span>{{ item.label }}</span>
            <strong>{{ item.count }}</strong>
          </div>
          <p>{{ item.description }}</p>
        </div>
      </div>
    </div>
    <div
      v-else
      class="todo-empty"
    >
      <strong>本周暂无待处理事项</strong>
      <span>待审核、待补凭证和待人工处理均已完成。</span>
    </div>
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
  padding: 8px 22px 18px;
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
  line-height: 1.4;
}

.card-heading p {
  margin: 6px 0 0;
  color: #94a3b8;
  font-size: 13px;
}

.todo-list {
  display: flex;
  flex-direction: column;
}

.todo-empty {
  display: flex;
  min-height: 176px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  color: #94a3b8;
  text-align: center;
}

.todo-empty strong {
  color: #4eaf70;
  font-size: 15px;
}

.todo-empty span {
  font-size: 13px;
}

.todo-item {
  display: flex;
  gap: 12px;
  padding: 13px 0;
  border-bottom: 1px solid #edf1f6;
}

.todo-item:last-child {
  border-bottom: 0;
}

.todo-marker {
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: 50%;
  background: #6091eb;
}

.todo-marker--warning {
  background: #d8953e;
}

.todo-marker--danger {
  background: #dc5e5e;
}

.todo-marker--success {
  background: #4eaf70;
}

.todo-content {
  flex: 1;
  min-width: 0;
}

.todo-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  color: #475569;
  font-size: 14px;
}

.todo-title-row strong {
  color: #3b82f6;
  font-size: 18px;
}

.todo-content p {
  margin: 5px 0 0;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.5;
}
</style>
