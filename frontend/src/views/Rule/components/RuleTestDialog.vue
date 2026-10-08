<script setup lang="ts">
import {
  ref,
  watch,
} from 'vue'
import type {
  CategoryRuleTestResult,
} from '../../../apis/categoryRule'

const props = defineProps<{
  modelValue: boolean
  loading: boolean
  error: string
  result: CategoryRuleTestResult | null
}>()

const emit = defineEmits<{
  'update:modelValue': [visible: boolean]
  test: [itemName: string]
}>()

const itemName = ref('')

function handleClose() {
  emit('update:modelValue', false)
}

function handleTest() {
  if (!itemName.value.trim()) {
    return
  }

  emit('test', itemName.value.trim())
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      itemName.value = ''
    }
  },
)
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="规则测试"
    width="560px"
    @close="handleClose"
  >
    <p class="dialog-description">
      输入已识别的商品名称，测试当前启用规则的匹配结果。本操作不会调用 AI。
    </p>
    <div class="test-form">
      <el-input
        v-model="itemName"
        placeholder="例如：惠普打印机墨盒"
        @keyup.enter="handleTest"
      />
      <el-button
        type="primary"
        :loading="loading"
        @click="handleTest"
      >
        开始测试
      </el-button>
    </div>

    <el-alert
      v-if="error"
      :title="error"
      type="error"
      :closable="false"
      show-icon
    />

    <div
      v-if="result"
      class="test-result"
    >
      <div class="result-heading">
        <strong>测试结果</strong>
        <el-tag
          :type="result.source === 'rule' ? 'success' : 'warning'"
          effect="plain"
        >
          {{ result.source === 'rule' ? '命中规则' : '需 AI 兜底' }}
        </el-tag>
      </div>
      <p>{{ result.message }}</p>
      <dl v-if="result.matchedRule">
        <div>
          <dt>规则名称</dt>
          <dd>{{ result.matchedRule.ruleName }}</dd>
        </div>
        <div>
          <dt>匹配关键词</dt>
          <dd>{{ result.matchedRule.keyword }}</dd>
        </div>
        <div>
          <dt>品类结论</dt>
          <dd>{{ result.categoryResult }}</dd>
        </div>
      </dl>
    </div>
  </el-dialog>
</template>

<style scoped>
.dialog-description {
  margin: 0 0 16px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}

.test-form {
  display: flex;
  gap: 12px;
}

.test-result {
  margin-top: 18px;
  padding: 16px;
  border: 1px solid #dbeafe;
  border-radius: 10px;
  background: #f8fbff;
}

.result-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.test-result p {
  margin: 10px 0 14px;
  color: #475569;
  font-size: 13px;
}

.test-result dl {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin: 0;
}

.test-result dl > div {
  padding: 10px;
  border-radius: 8px;
  background: #ffffff;
}

.test-result dt {
  color: #94a3b8;
  font-size: 12px;
}

.test-result dd {
  margin: 5px 0 0;
  color: #334155;
  font-size: 13px;
  font-weight: 600;
}

@media (max-width: 560px) {
  .test-form {
    flex-direction: column;
  }

  .test-result dl {
    grid-template-columns: 1fr;
  }
}
</style>
