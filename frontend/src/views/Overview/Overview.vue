<script setup lang="ts">
import ReviewWorkbenchStats from './components/ReviewWorkbenchStats.vue'
import ReviewWorkbenchExceptionList from './components/ReviewWorkbenchExceptionList.vue'
import ReviewWorkbenchQuickActions from './components/ReviewWorkbenchQuickActions.vue'
import ReviewWorkbenchTaskList from './components/ReviewWorkbenchTaskList.vue'

interface SummaryMetric {
  label: string
  value: string
  description: string
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'info'
}

const workbenchMetrics: SummaryMetric[] = [
  {
    label: '待审核',
    value: '5',
    description: '等待管理员进行资质审核',
    tone: 'warning',
  },
  {
    label: '待补凭证',
    value: '3',
    description: '需要补充订单截图或支付记录',
    tone: 'warning',
  },
  {
    label: '待人工处理',
    value: '2',
    description: '需要确认品类或补全发票信息',
    tone: 'danger',
  },
]

const priorityTasks = [
  {
    invoiceNumber: '2695200000373999002',
    sellerName: '广州新程科技有限公司',
    totalAmount: '¥734.50',
    submittedAt: '今天 10:05',
    statusLabel: '待补凭证',
    statusTone: 'warning' as const,
    reason: '低值品发票，需补充订单截图和支付记录。',
  },
  {
    invoiceNumber: '2695200000373999005',
    sellerName: '深圳恒达电子有限公司',
    totalAmount: '¥361.60',
    submittedAt: '今天 09:42',
    statusLabel: '待审核',
    statusTone: 'primary' as const,
    reason: '预审完成，等待确认审核结论。',
  },
  {
    invoiceNumber: '未识别',
    sellerName: '广州电脑配件有限公司',
    totalAmount: '¥56.50',
    submittedAt: '昨天 16:18',
    statusLabel: '待人工处理',
    statusTone: 'danger' as const,
    reason: '发票关键信息识别不完整，需人工补全。',
  },
  {
    invoiceNumber: '2695200000373999008',
    sellerName: '东莞电机有限公司',
    totalAmount: '¥1,717.60',
    submittedAt: '昨天 14:30',
    statusLabel: '待审核',
    statusTone: 'primary' as const,
    reason: '存在高金额商品，请核验品类与报销规则。',
  },
]

const exceptions = [
  {
    label: '疑似重复发票',
    count: '2',
    description: '发票号码或销售方信息存在重复风险。',
    tone: 'warning' as const,
  },
  {
    label: '识别失败',
    count: '1',
    description: '文件内容无法可靠识别，需要人工录入。',
    tone: 'danger' as const,
  },
  {
    label: '资料不完整',
    count: '3',
    description: '发票或关联材料缺少必要字段。',
    tone: 'primary' as const,
  },
]

const quickActions = [
  {
    label: '上传发票',
    description: '上传 PDF 或 ZIP 文件并发起识别。',
    routeName: 'upload-invoice',
  },
  {
    label: '发票列表',
    description: '查看完整台账和预审处理状态。',
    routeName: 'invoice-list',
  },
  {
    label: '规则管理',
    description: '维护商品品类与关键词匹配规则。',
    routeName: 'rules',
  },
  {
    label: '财务管理',
    description: '查看跨自然周的财务提交与报销进度。',
    routeName: 'reimbursement-progress',
  },
]

</script>

<template>
  <div class="overview-page">
    <section class="page-heading">
      <div>
        <p class="eyebrow">REVIEW WORKBENCH</p>
        <h1>审核工作台</h1>
        <p class="page-description">
          聚焦当前需要处理的发票审核、凭证补充与人工确认事项。
        </p>
      </div>
      <el-tag
        type="info"
        effect="plain"
      >
        静态示例数据
      </el-tag>
    </section>

    <ReviewWorkbenchStats :metrics="workbenchMetrics" />

    <section class="workbench-grid">
      <ReviewWorkbenchTaskList :tasks="priorityTasks" />
      <ReviewWorkbenchExceptionList :items="exceptions" />
    </section>

    <ReviewWorkbenchQuickActions :actions="quickActions" />
  </div>
</template>

<style scoped>
.overview-page {
  max-width: 1240px;
  margin: 0 auto;
  padding: 28px 30px 40px;
}

.page-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 26px;
}

.eyebrow {
  margin: 0 0 8px;
  color: #7c8db5;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.page-heading h1 {
  margin: 0;
  color: #1e293b;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.3;
}

.page-description {
  margin: 10px 0 0;
  color: #94a3b8;
  font-size: 14px;
}

.workbench-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(300px, 0.8fr);
  gap: 18px;
  margin-bottom: 18px;
}

@media (max-width: 820px) {
  .overview-page {
    padding: 22px 18px 32px;
  }

  .workbench-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .page-heading {
    flex-direction: column;
  }
}
</style>
