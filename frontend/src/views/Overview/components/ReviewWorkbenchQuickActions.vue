<script setup lang="ts">
interface QuickAction {
  label: string
  description: string
  routeName: string
}

defineProps<{
  actions: QuickAction[]
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
          <h2>快捷入口</h2>
          <p>快速进入常用业务页面</p>
        </div>
      </div>
    </template>

    <div class="action-grid">
      <router-link
        v-for="action in actions"
        :key="action.routeName"
        :to="{
          name: action.routeName,
        }"
        class="action-item"
      >
        <strong>{{ action.label }}</strong>
        <span>{{ action.description }}</span>
      </router-link>
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
  padding: 16px 22px 20px;
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

.action-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.action-item {
  display: flex;
  min-height: 98px;
  flex-direction: column;
  justify-content: space-between;
  padding: 16px;
  border: 1px solid #e5eaf2;
  border-radius: 10px;
  color: inherit;
  background: #f8fafc;
  text-decoration: none;
  transition: border-color 0.2s, background 0.2s, transform 0.2s;
}

.action-item:hover {
  border-color: #93c5fd;
  background: #eff6ff;
  transform: translateY(-1px);
}

.action-item strong {
  color: #3b82f6;
  font-size: 15px;
}

.action-item span {
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}

@media (max-width: 820px) {
  .action-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .action-grid {
    grid-template-columns: 1fr;
  }
}
</style>
