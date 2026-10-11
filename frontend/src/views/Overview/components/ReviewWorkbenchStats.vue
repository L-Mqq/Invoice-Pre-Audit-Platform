<script setup lang="ts">
interface SummaryMetric {
  label: string
  value: string
  description: string
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'info'
}

defineProps<{
  metrics: SummaryMetric[]
}>()
</script>

<template>
  <section
    class="summary-grid"
    aria-label="审核待办统计"
  >
    <article
      v-for="metric in metrics"
      :key="metric.label"
      class="summary-card"
      :class="`summary-card--${metric.tone}`"
    >
      <span class="summary-label">{{ metric.label }}</span>
      <strong>{{ metric.value }}</strong>
      <p>{{ metric.description }}</p>
    </article>
  </section>
</template>

<style scoped>
.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 18px;
}

.summary-card {
  min-height: 156px;
  padding: 20px;
  border: 1px solid #e5eaf2;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 3px 12px rgb(15 23 42 / 3%);
}

.summary-label {
  display: block;
  color: #64748b;
  font-size: 14px;
}

.summary-card strong {
  display: block;
  margin-top: 14px;
  color: #1e293b;
  font-size: 26px;
  line-height: 1;
}

.summary-card p {
  margin: 13px 0 0;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.6;
}

.summary-card--success strong {
  color: #33a35a;
}

.summary-card--warning strong {
  color: #cc8427;
}

.summary-card--danger strong {
  color: #d14343;
}

.summary-card--info strong {
  color: #64748b;
}

@media (max-width: 1180px) {
  .summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
