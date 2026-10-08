<script setup lang="ts">
import {
  computed,
  reactive,
  ref,
  watch,
} from 'vue'
import type {
  CategoryRuleNameOption,
} from '../../../apis/categoryRule'

export interface RuleFormValue {
  id?: number
  ruleName: string
  categoryResult: '可以' | '存疑' | '不可以'
  keywords: string[]
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
  categoryResult: '可以',
  keywords: [''],
})

const keywordInput = ref('')
const keywordError = ref('')

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
  form.categoryResult = props.rule?.categoryResult || '可以'
  form.keywords = props.rule?.keywords.length
    ? [...props.rule.keywords]
    : ['']
  keywordInput.value = ''
  keywordError.value = ''
}

function handleClose() {
  emit('update:modelValue', false)
}

function handleSubmit() {
  const keywords = form.keywords
    .map((keyword) => keyword.trim())
    .filter(Boolean)

  if (keywords.length === 0) {
    keywordError.value = '请至少保留一个匹配关键词'
    return
  }

  emit('submit', {
    id: form.id,
    ruleName: form.ruleName.trim(),
    categoryResult: form.categoryResult,
    keywords,
  })
}

function normalizeKeyword(keyword: string) {
  return keyword.trim().toLowerCase().replace(/[\s　]+/g, '')
}

function addKeyword() {
  const keyword = keywordInput.value.trim()

  if (!keyword) {
    keywordError.value = '请输入关键词'
    return
  }

  if (form.keywords.some((item) => normalizeKeyword(item) === normalizeKeyword(keyword))) {
    keywordError.value = `关键词“${keyword}”重复`
    return
  }

  form.keywords.push(keyword)
  keywordInput.value = ''
  keywordError.value = ''
}

function removeKeyword(index: number) {
  if (form.keywords.length === 1) {
    keywordError.value = '规则组至少保留一个关键词，暂不支持删除整条规则'
    return
  }

  form.keywords.splice(index, 1)
  keywordError.value = ''
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
          v-if="mode === 'create'"
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
        <el-input
          v-else
          :model-value="form.ruleName"
          readonly
        />
        <p
          v-if="isExistingRuleNameSelected"
          class="rule-name-hint"
        >
          已选规则的品类结论为“{{ matchedRuleNameOption?.categoryResult }}”，不可修改。
        </p>
      </el-form-item>
      <el-form-item
        v-if="mode === 'create'"
        label="匹配关键词"
      >
        <el-input
          v-model="form.keywords[0]"
          placeholder="例如：A4打印纸"
        />
      </el-form-item>
      <el-form-item
        v-else
        label="匹配关键词"
      >
        <div class="keyword-editor">
          <div class="keyword-tags">
            <el-tag
              v-for="(keyword, index) in form.keywords"
              :key="keyword"
              :closable="form.keywords.length > 1"
              @close="removeKeyword(index)"
            >
              {{ keyword }}
            </el-tag>
          </div>
          <div class="keyword-input-row">
            <el-input
              v-model="keywordInput"
              placeholder="输入新关键词后添加"
              @keyup.enter="addKeyword"
            />
            <el-button @click="addKeyword">
              添加
            </el-button>
          </div>
          <p class="keyword-hint">
            关键词至少保留一个；删除最后一个关键词需等待规则组删除功能支持。
          </p>
          <p
            v-if="keywordError"
            class="keyword-error"
          >
            {{ keywordError }}
          </p>
        </div>
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
        :disabled="
          !form.ruleName.trim()
          || !form.keywords.some((keyword) => keyword.trim())
        "
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

.keyword-editor {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 10px;
}

.keyword-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.keyword-input-row {
  display: flex;
  gap: 8px;
}

.keyword-hint,
.keyword-error {
  margin: 0;
  font-size: 12px;
}

.keyword-hint {
  color: #64748b;
}

.keyword-error {
  color: #dc2626;
}
</style>
