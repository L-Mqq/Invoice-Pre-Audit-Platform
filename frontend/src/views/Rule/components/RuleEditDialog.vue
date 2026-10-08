<script setup lang="ts">
import {
  computed,
  reactive,
  watch,
} from 'vue'
import type {
  CategoryRuleNameOption,
} from '../../../apis/categoryRule'

export interface RuleFormValue {
  id?: number
  ruleName: string
  keyword: string
  categoryResult: '可以' | '存疑' | '不可以'
}

const props = defineProps<{
  modelValue: boolean
  mode: 'create' | 'edit'
  rule: RuleFormValue | null
  submitting: boolean
  ruleNameOptions: CategoryRuleNameOption[]
  ruleNameOptionsLoading: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [visible: boolean]
  searchRuleNames: [keyword: string]
  submit: [value: RuleFormValue]
}>()

const form = reactive<RuleFormValue>({
  ruleName: '',
  keyword: '',
  categoryResult: '可以',
})

const matchedRuleNameOption = computed(() => {
  const ruleName = form.ruleName.trim()

  if (!ruleName) {
    return null
  }

  return props.ruleNameOptions.find((option) => option.ruleName === ruleName) || null
})

const isExistingRuleNameSelected = computed(() => {
  return props.mode === 'create' && Boolean(matchedRuleNameOption.value)
})

function resetForm() {
  form.id = props.rule?.id
  form.ruleName = props.rule?.ruleName || ''
  form.keyword = props.rule?.keyword || ''
  form.categoryResult = props.rule?.categoryResult || '可以'
}

function handleClose() {
  emit('update:modelValue', false)
}

function handleSubmit() {
  emit('submit', {
    id: form.id,
    ruleName: form.ruleName.trim(),
    keyword: form.keyword.trim(),
    categoryResult: form.categoryResult,
  })
}

function syncCategoryResult() {
  if (props.mode !== 'create' || !matchedRuleNameOption.value) {
    return
  }

  form.categoryResult = matchedRuleNameOption.value.categoryResult
}

watch(
  () => [
    props.modelValue,
    props.rule,
  ],
  resetForm,
  {
    immediate: true,
  },
)

watch(
  [
    () => form.ruleName,
    () => props.ruleNameOptions,
  ],
  syncCategoryResult,
)
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="mode === 'create' ? '新增品类规则' : '编辑品类规则'"
    width="520px"
    @close="handleClose"
  >
    <el-form label-position="top">
      <el-form-item label="规则名称">
        <el-select
          v-model="form.ruleName"
          filterable
          allow-create
          clearable
          remote
          reserve-keyword
          :loading="ruleNameOptionsLoading"
          placeholder="选择已有名称，或输入新名称"
          @change="syncCategoryResult"
          @remote-method="emit('searchRuleNames', $event)"
        >
          <el-option
            v-for="option in ruleNameOptions"
            :key="option.ruleName"
            :label="option.ruleName"
            :value="option.ruleName"
          >
            <div class="rule-name-option">
              <span>{{ option.ruleName }}</span>
              <small>{{ option.categoryResult }}</small>
            </div>
          </el-option>
        </el-select>
        <p
          v-if="isExistingRuleNameSelected"
          class="rule-name-hint"
        >
          已选规则的品类结论为“{{ matchedRuleNameOption?.categoryResult }}”，不可修改。
        </p>
      </el-form-item>
      <el-form-item label="匹配关键词">
        <el-input
          v-model="form.keyword"
          placeholder="例如：A4打印纸"
        />
      </el-form-item>
      <el-form-item label="品类结论">
        <el-radio-group
          v-model="form.categoryResult"
          :disabled="isExistingRuleNameSelected"
        >
          <el-radio value="可以">可以</el-radio>
          <el-radio value="存疑">存疑</el-radio>
          <el-radio value="不可以">不可以</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button
        :disabled="submitting"
        @click="handleClose"
      >
        取消
      </el-button>
      <el-button
        type="primary"
        :loading="submitting"
        :disabled="!form.ruleName.trim() || !form.keyword.trim()"
        @click="handleSubmit"
      >
        保存
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.rule-name-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.rule-name-option small {
  color: #94a3b8;
}

.rule-name-hint {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 12px;
}
</style>
