<script setup lang="ts">
import {
  onBeforeUnmount,
  reactive,
  ref,
  watch,
} from 'vue'
import type {
  CategoryRuleNameCheckResult,
} from '../../../apis/categoryRule'
import {
  checkCategoryRuleName,
} from '../../../apis/categoryRule'

export interface RuleFormValue {
  id?: number
  ruleName: string
  categoryResult: '可以' | '存疑' | '不可以'
  keywords: string[]
  renamed?: boolean
}

const props = defineProps<{
  modelValue: boolean
  mode: 'create' | 'edit'
  rule: RuleFormValue | null
  submitting: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [visible: boolean]
  submit: [value: RuleFormValue]
  removeLastKeyword: [value: RuleFormValue]
}>()

const form = reactive<RuleFormValue>({
  ruleName: '',
  categoryResult: '可以',
  keywords: [],
})

const keywordInput = ref('')
const keywordError = ref('')
const isRenaming = ref(false)
const renameError = ref('')
const nameConflict = ref(false)
let nameCheckTimer: ReturnType<typeof setTimeout> | undefined
let nameCheckRequestId = 0

function resetForm() {
  form.id = props.rule?.id
  form.ruleName = props.rule?.ruleName || ''
  form.categoryResult = props.rule?.categoryResult || '可以'
  form.keywords = props.rule?.keywords.length
    ? [...props.rule.keywords]
    : []
  keywordInput.value = ''
  keywordError.value = ''
  isRenaming.value = false
  renameError.value = ''
  resetNameCheck()
}

function handleClose() {
  emit('update:modelValue', false)
}

async function handleSubmit() {
  if (!commitKeyword()) {
    return
  }

  const ruleName = validateRuleName()

  if (!ruleName) {
    return
  }

  const nameCheckResult = await checkCurrentRuleName(ruleName)

  if (!nameCheckResult || nameCheckResult.exists) {
    return
  }

  const keywords = form.keywords
    .map((keyword) => keyword.trim())
    .filter(Boolean)

  if (keywords.length === 0) {
    keywordError.value = '请至少保留一个匹配关键词'
    return
  }

  emit('submit', {
    id: form.id,
    ruleName,
    categoryResult: form.categoryResult,
    keywords,
    renamed: props.mode === 'edit'
      && normalizeRuleName(ruleName) !== normalizeRuleName(props.rule?.ruleName || ''),
  })
}

function normalizeRuleName(value: string) {
  return value.trim().replace(/[\s　]+/g, ' ')
}

function normalizeRuleNameKey(value: string) {
  return normalizeRuleName(value).toLowerCase()
}

function validateRuleName() {
  const rawRuleName = form.ruleName
  const ruleName = normalizeRuleName(rawRuleName)

  renameError.value = ''

  if (!ruleName) {
    renameError.value = '规则名称不能为空'
    return null
  }

  if (/[\u0000-\u001F\u007F]/.test(rawRuleName)) {
    renameError.value = '规则名称不能包含换行或控制字符'
    return null
  }

  if ([...ruleName].length > 128) {
    renameError.value = '规则名称不能超过 128 个字符'
    return null
  }

  return ruleName
}

function shouldCheckRuleName() {
  return props.mode === 'create' || isRenaming.value
}

function getExcludeRuleId() {
  return props.mode === 'edit' ? form.id : undefined
}

function resetNameCheck() {
  if (nameCheckTimer) {
    clearTimeout(nameCheckTimer)
    nameCheckTimer = undefined
  }

  nameCheckRequestId += 1
  nameConflict.value = false
}

async function checkRuleName(
  ruleName: string,
): Promise<CategoryRuleNameCheckResult | null> {
  const requestId = ++nameCheckRequestId

  nameConflict.value = false

  try {
    const result = await checkCategoryRuleName(
      ruleName,
      getExcludeRuleId(),
    )

    if (requestId !== nameCheckRequestId) {
      return null
    }

    nameConflict.value = result.exists

    return result
  } catch {
    return null
  }
}

async function checkCurrentRuleName(
  ruleName: string,
) {
  if (!shouldCheckRuleName()) {
    return {
      ruleName,
      exists: false,
      categoryResult: null,
    }
  }

  if (nameCheckTimer) {
    clearTimeout(nameCheckTimer)
    nameCheckTimer = undefined
  }

  return checkRuleName(ruleName)
}

function scheduleRuleNameCheck() {
  resetNameCheck()

  if (!props.modelValue || !shouldCheckRuleName()) {
    return
  }

  const ruleName = normalizeRuleName(form.ruleName)

  if (!ruleName) {
    return
  }

  nameCheckTimer = setTimeout(() => {
    nameCheckTimer = undefined
    void checkRuleName(ruleName)
  }, 300)
}

function enableRename() {
  isRenaming.value = true
  renameError.value = ''
  scheduleRuleNameCheck()
}

function cancelRename() {
  form.ruleName = props.rule?.ruleName || ''
  isRenaming.value = false
  renameError.value = ''
  resetNameCheck()
}

function normalizeKeyword(keyword: string) {
  return keyword.trim().toLowerCase().replace(/[\s　]+/g, '')
}

function commitKeyword() {
  const keyword = keywordInput.value.trim()

  if (!keyword) {
    return true
  }

  if (form.keywords.some((item) => normalizeKeyword(item) === normalizeKeyword(keyword))) {
    keywordError.value = `关键词“${keyword}”重复`
    return false
  }

  form.keywords.push(keyword)
  keywordInput.value = ''
  keywordError.value = ''
  return true
}

function addKeyword() {
  commitKeyword()
}

function removeKeyword(index: number) {
  if (form.keywords.length === 1) {
    if (props.mode === 'edit') {
      emit('removeLastKeyword', {
        id: form.id,
        ruleName: form.ruleName,
        categoryResult: form.categoryResult,
        keywords: [...form.keywords],
      })
      return
    }

    form.keywords.splice(index, 1)
    keywordError.value = ''
    return
  }

  form.keywords.splice(index, 1)
  keywordError.value = ''
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
  () => form.ruleName,
  () => {
    if (isRenaming.value) {
      renameError.value = ''
    }

    scheduleRuleNameCheck()
  },
)

onBeforeUnmount(() => {
  resetNameCheck()
})
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
        <el-input
          v-if="mode === 'create'"
          v-model="form.ruleName"
          clearable
          placeholder="请输入新的规则名称"
        />
        <div
          v-else
          class="rule-name-edit-row"
        >
          <el-input
            v-model="form.ruleName"
            :readonly="!isRenaming"
          />
          <el-button
            v-if="!isRenaming"
            @click="enableRename"
          >
            重命名
          </el-button>
          <el-button
            v-else
            @click="cancelRename"
          >
            取消重命名
          </el-button>
        </div>
        <p
          v-if="mode === 'edit' && isRenaming"
          class="rule-name-hint"
        >
          重命名将同步修改该规则组下全部关键词。
        </p>
        <p
          v-if="renameError"
          class="rename-error"
        >
          {{ renameError }}
        </p>
        <p
          v-else-if="nameConflict"
          class="rename-error"
        >
          该规则名称已存在，不能合并规则组
        </p>
      </el-form-item>
      <el-form-item label="匹配关键词">
        <div class="keyword-editor">
          <div class="keyword-tags">
            <el-tag
              v-for="(keyword, index) in form.keywords"
              :key="keyword"
              closable
              @close="removeKeyword(index)"
            >
              {{ keyword }}
            </el-tag>
          </div>
          <div class="keyword-input-row">
            <el-input
              v-model="keywordInput"
              placeholder="输入新关键词后添加"
              @keydown.enter.prevent="addKeyword"
            />
            <el-button @click="addKeyword">
              添加
            </el-button>
          </div>
          <p class="keyword-hint">
            输入后可按回车或点击添加；保存时会自动加入当前输入。
          </p>
          <p
            v-if="mode === 'edit'"
            class="keyword-hint"
          >
            删除最后一个关键词将删除整个规则组。
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
          || (
            !form.keywords.some((keyword) => keyword.trim())
            && !keywordInput.trim()
          )
        "
        @click="handleSubmit"
      >
        保存
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.rule-name-hint {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 12px;
}

.rule-name-edit-row {
  display: flex;
  width: 100%;
  gap: 8px;
}

.rule-name-edit-row .el-input {
  flex: 1;
}

.rename-error {
  margin: 6px 0 0;
  color: #dc2626;
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
