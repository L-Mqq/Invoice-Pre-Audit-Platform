<script setup lang="ts">
defineProps<{
  ruleTotal: number
  keywordTotal: number
  reimbursableRuleCount: number
  uncertainRuleCount: number
  nonReimbursableRuleCount: number
}>()
</script>

<template>
  <div class="summary-grid">
    <div class="summary-card">
      <span>规则总数</span>
      <strong>{{ ruleTotal }}</strong>
      <small>覆盖 {{ keywordTotal }} 个匹配关键词</small>
    </div>
    <div class="summary-card approved">
      <span>可报销规则</span>
      <strong>{{ reimbursableRuleCount }}</strong>
      <small>符合材料费报销条件</small>
    </div>
    <div class="summary-card uncertain">
      <span>存疑规则</span>
      <strong>{{ uncertainRuleCount }}</strong>
      <small>需管理员人工确认</small>
    </div>
    <div class="summary-card rejected">
      <span>不可报销规则</span>
      <strong>{{ nonReimbursableRuleCount }}</strong>
      <small>不可按材料费报销</small>
    </div>
  </div>
</template>

<style scoped>
.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin: 20px 0;
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 18px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
}

.summary-card span,
.summary-card small {
  color: #94a3b8;
  font-size: 12px;
}

.summary-card strong {
  font-size: 28px;
}

.summary-card.approved strong {
  color: #16a34a;
}

.summary-card.uncertain strong {
  color: #d97706;
}

.summary-card.rejected strong {
  color: #dc2626;
}

@media (max-width: 1000px) {
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
