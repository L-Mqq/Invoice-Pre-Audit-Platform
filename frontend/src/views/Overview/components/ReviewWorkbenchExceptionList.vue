<script setup lang="ts">
interface ExceptionItem {
  label: string
  count: string
  description: string
  tone: 'primary' | 'warning' | 'danger'
}

defineProps<{
  items: ExceptionItem[]
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
          <h2>异常关注</h2>
          <p>需要优先核验的异常情况</p>
        </div>
      </div>
    </template>

    <div class="exception-list">
      <article
        v-for="item in items"
        :key="item.label"
        class="exception-item"
      >
        <div class="exception-content">
          <span>{{ item.label }}</span>
          <p>{{ item.description }}</p>
        </div>
        <strong :class="`exception-count--${item.tone}`">{{ item.count }}</strong>
      </article>
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

.exception-list {
  display: flex;
  flex-direction: column;
}

.exception-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 17px 0;
  border-bottom: 1px solid #edf1f6;
}

.exception-item:last-child {
  border-bottom: 0;
}

.exception-content span {
  color: #475569;
  font-size: 14px;
}

.exception-content p {
  margin: 6px 0 0;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.5;
}

.exception-item strong {
  flex: 0 0 auto;
  font-size: 26px;
}

.exception-count--primary {
  color: #3b82f6;
}

.exception-count--warning {
  color: #cc8427;
}

.exception-count--danger {
  color: #d14343;
}
</style>
