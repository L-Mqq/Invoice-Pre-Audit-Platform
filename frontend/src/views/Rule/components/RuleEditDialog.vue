<script setup lang="ts">
import {
  reactive,
  watch,
} from 'vue'

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
}>()

const emit = defineEmits<{
  'update:modelValue': [visible: boolean]
  submit: [value: RuleFormValue]
}>()

const form = reactive<RuleFormValue>({
  ruleName: '',
  keyword: '',
  categoryResult: '可以',
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
          v-model="form.ruleName"
          placeholder="例如：办公耗材"
        />
      </el-form-item>
      <el-form-item label="匹配关键词">
        <el-input
          v-model="form.keyword"
          placeholder="例如：A4打印纸"
        />
      </el-form-item>
      <el-form-item label="品类结论">
        <el-radio-group v-model="form.categoryResult">
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
