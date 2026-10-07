<script setup lang="ts">
import {
  ref,
} from 'vue'

interface CategoryRule {
  id: number
  ruleName: string
  keyword: string
  categoryResult: '可以' | '存疑' | '不可以'
  isActive: boolean
}

const categoryRules = ref<CategoryRule[]>([
  {
    id: 1,
    ruleName: '办公用品',
    keyword: 'A4纸',
    categoryResult: '可以',
    isActive: true,
  },
  {
    id: 2,
    ruleName: '电子设备',
    keyword: '摄像头',
    categoryResult: '不可以',
    isActive: true,
  },
  {
    id: 3,
    ruleName: '网络设备',
    keyword: '无线AP',
    categoryResult: '可以',
    isActive: true,
  },
  {
    id: 4,
    ruleName: '办公设备',
    keyword: '打印机',
    categoryResult: '不可以',
    isActive: true,
  },
  {
    id: 5,
    ruleName: '专业工具',
    keyword: '测量仪',
    categoryResult: '存疑',
    isActive: false,
  },
])

function getCategoryTagType(result: CategoryRule['categoryResult']) {
  if (result === '可以') {
    return 'success'
  }

  if (result === '不可以') {
    return 'danger'
  }

  return 'warning'
}

</script>

<template>
  <section class="rules-page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">
          RULE MANAGEMENT
        </p>
        <h1>
          规则管理
        </h1>
        <p class="subtitle">
          维护商品品类关键词规则。启用规则优先于 AI 辅助判断。
        </p>
      </div>
      <div class="heading-actions">
        <el-button>
          规则测试
        </el-button>
        <el-button type="primary">
          新增品类规则
        </el-button>
      </div>
    </div>

    <el-alert
      title="品类规则命中后将直接使用配置结论；未命中的商品交由 AI 辅助判断，无法可靠判断时进入“存疑”。"
      type="info"
      :closable="false"
      show-icon
    />

    <div class="summary-grid">
      <div class="summary-card">
        <span>规则总数</span>
        <strong>5</strong>
        <small>含已停用规则</small>
      </div>
      <div class="summary-card approved">
        <span>可报销规则</span>
        <strong>2</strong>
        <small>符合材料费报销条件</small>
      </div>
      <div class="summary-card uncertain">
        <span>存疑规则</span>
        <strong>1</strong>
        <small>需管理员人工确认</small>
      </div>
      <div class="summary-card rejected">
        <span>不可报销规则</span>
        <strong>2</strong>
        <small>不可按材料费报销</small>
      </div>
    </div>

    <el-card
      class="filter-card"
      shadow="never"
    >
      <div class="filter-heading">
        <strong>筛选规则</strong>
        <el-button link>
          重置筛选
        </el-button>
      </div>
      <div class="filter-grid">
        <el-input
          placeholder="搜索规则名称或关键词"
          clearable
        />
        <el-select
          placeholder="品类结论"
          clearable
        >
          <el-option
            label="可以"
            value="可以"
          />
          <el-option
            label="存疑"
            value="存疑"
          />
          <el-option
            label="不可以"
            value="不可以"
          />
        </el-select>
        <el-select
          placeholder="启用状态"
          clearable
        >
          <el-option
            label="已启用"
            value="active"
          />
          <el-option
            label="已停用"
            value="inactive"
          />
        </el-select>
        <el-button type="primary">
          查询
        </el-button>
      </div>
    </el-card>

    <el-card
      class="table-card"
      shadow="never"
    >
      <div class="table-heading">
        <div>
          <strong>
            品类规则列表
          </strong>
          <span>
            共 {{ categoryRules.length }} 条规则
          </span>
        </div>
        <el-button link>
          查看操作记录
        </el-button>
      </div>

      <el-table
        :data="categoryRules"
        stripe
      >
        <el-table-column
          label="规则名称"
          min-width="150"
        >
          <template #default="{ row }">
            <strong>
              {{ row.ruleName }}
            </strong>
          </template>
        </el-table-column>
        <el-table-column
          prop="keyword"
          label="匹配关键词"
          min-width="160"
        >
          <template #default="{ row }">
            <span class="keyword">
              {{ row.keyword }}
            </span>
          </template>
        </el-table-column>
        <el-table-column
          label="品类结论"
          width="130"
        >
          <template #default="{ row }">
            <el-tag
              :type="getCategoryTagType(row.categoryResult)"
              effect="plain"
            >
              {{ row.categoryResult }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          label="状态"
          width="90"
        >
          <template #default="{ row }">
            <div class="status-control">
              <el-switch
                v-model="row.isActive"
                aria-label="切换规则启用状态"
              />
              <span
                class="status-text"
                :class="{
                  'is-active': row.isActive,
                }"
                :aria-label="row.isActive ? '启用' : '停用'"
              ></span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          label="操作"
          width="120"
          fixed="right"
        >
          <template #default>
            <el-button
              link
              type="primary"
            >
              编辑
            </el-button>
            <el-button
              link
              type="danger"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <p class="table-note">
        多个规则同时命中时，系统会按既定匹配顺序采用其中一条规则。
      </p>
    </el-card>

    <el-card
      class="fixed-rule-card"
      shadow="never"
    >
      <div class="fixed-rule-heading">
        <div>
          <strong>
            固定审核规则
          </strong>
          <span>
            由系统规则引擎执行，当前不可在此页修改
          </span>
        </div>
        <el-button link>
          查看规则说明
        </el-button>
      </div>
      <div class="fixed-rule-grid">
        <div>
          <span>
            商品单价
          </span>
          <p>
            小于 500 元为材料；500 至小于 1000 元需支付凭证；1000 元及以上为资产。
          </p>
        </div>
        <div>
          <span>
            自然周累计
          </span>
          <p>
            不超过 1000 元正常继续；超过 1000 元至 3000 元待补凭证；超过 3000 元不通过。
          </p>
        </div>
        <div>
          <span>
            支付凭证
          </span>
          <p>
            每个凭证组必须同时包含订单截图和支付记录，并由管理员人工核验。
          </p>
        </div>
      </div>
    </el-card>
  </section>
</template>

<style scoped>
.rules-page {
  max-width: 1240px;
  margin: 0 auto;
  padding-bottom: 40px;
  color: #0f172a;
}

.page-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 24px;
}

.eyebrow {
  margin: 0 0 6px;
  color: #2563eb;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
}

h1 {
  margin: 0;
  font-size: 28px;
}

.subtitle {
  margin: 8px 0 0;
  color: #64748b;
  font-size: 14px;
}

.heading-actions {
  display: flex;
  gap: 12px;
}

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

.filter-card,
.table-card,
.fixed-rule-card {
  margin-bottom: 20px;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
}

.filter-heading,
.table-heading,
.fixed-rule-heading,
.table-heading > div,
.fixed-rule-heading > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.filter-grid {
  display: grid;
  grid-template-columns: minmax(240px, 2fr) repeat(2, minmax(150px, 1fr)) auto;
  gap: 12px;
  margin-top: 16px;
}

.table-heading {
  margin-bottom: 16px;
}

.table-heading strong {
  margin-right: 10px;
}

.table-heading span,
.fixed-rule-heading span {
  color: #94a3b8;
  font-size: 12px;
}

.keyword {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 5px;
  background: #f1f5f9;
  color: #334155;
  font-size: 13px;
}

.status-control {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.status-text {
  color: #94a3b8;
  font-size: 13px;
}

.status-text::before {
  content: '停用';
}

.status-text.is-active {
  color: #2563eb;
}

.status-text.is-active::before {
  content: '启用';
}

.table-note {
  margin: 16px 0 0;
  color: #64748b;
  font-size: 12px;
}

.fixed-rule-heading {
  margin-bottom: 18px;
}

.fixed-rule-heading strong {
  margin-right: 10px;
}

.fixed-rule-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.fixed-rule-grid > div {
  padding: 14px;
  border-radius: 10px;
  background: #f8fafc;
}

.fixed-rule-grid span {
  color: #334155;
  font-size: 13px;
  font-weight: 700;
}

.fixed-rule-grid p {
  margin: 8px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.65;
}

@media (max-width: 1000px) {
  .summary-grid,
  .fixed-rule-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .filter-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .page-heading,
  .fixed-rule-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .heading-actions {
    width: 100%;
  }

  .heading-actions .el-button {
    flex: 1;
  }

  .summary-grid,
  .filter-grid,
  .fixed-rule-grid {
    grid-template-columns: 1fr;
  }
}
</style>
