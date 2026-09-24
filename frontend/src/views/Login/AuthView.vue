<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { login, register } from '../../apis/auth'
import { useAuthStore } from '../../stores/auth'

type AuthMode = 'login' | 'register'
const mode = ref<AuthMode>('login')
const formRef = ref<FormInstance>()
const form = reactive({ username: '', password: '', confirmPassword: '' })
const authStore = useAuthStore()
const router = useRouter()

const validateConfirmPassword = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (mode.value === 'register' && value !== form.password) {
    callback(new Error('两次输入的密码不一致'))
    return
  }
  callback()
}

// 校验规则
const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }, { min: 3, max: 10, message: '用户名长度为 3-10 个字符', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }, { min: 6, message: '密码至少需要 6 个字符', trigger: 'blur' }],
  confirmPassword: [{ required: true, message: '请再次输入密码', trigger: 'blur' }, { validator: validateConfirmPassword, trigger: 'blur' }],
}

function switchMode(nextMode: AuthMode) { mode.value = nextMode; formRef.value?.resetFields() }

async function submitLegacy() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  if (mode.value === 'login') {
    ElMessage.info('登录接口待接入')
    return
  }

  try {
    await register({ username: form.username.trim(), password: form.password })
    ElMessage.success('注册成功，请登录')
    switchMode('login')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '注册失败，请稍后重试')
  }
}
async function submit() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  if (mode.value === 'login') {
    try {
      const response = await login({ username: form.username.trim(), password: form.password })
      authStore.login(response.data.token, response.data.user)
      ElMessage.success('登录成功')
      await router.replace('/layout')
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '登录失败，请稍后重试')
    }
    return
  }
  try {
    await register({ username: form.username.trim(), password: form.password })
    ElMessage.success('注册成功，请登录')
    switchMode('login')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '注册失败，请稍后重试')
  }
}
</script>

<template>
  <main class="auth-page"><section class="auth-panel">
    <div class="brand-block">
      <div class="brand-title">
        <h1>材料费发票智能预审与管理平台</h1>
        <p>Invoice Pre-Audit Platform</p>
      </div>
    </div>
    <div class="form-card">
      <div class="mode-switch"><button :class="{ active: mode === 'login' }" type="button" @click="switchMode('login')">登录</button><button :class="{ active: mode === 'register' }" type="button" @click="switchMode('register')">注册</button></div>
      <div class="form-heading"><h2>{{ mode === 'login' ? '欢迎登录' : '创建账号' }}</h2><p>{{ mode === 'login' ? '登录后管理和审核材料费发票' : '注册后即可使用平台功能' }}</p></div>
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="submit">
        <el-form-item label="用户名" prop="username"><el-input v-model="form.username" placeholder="请输入用户名" size="large" autocomplete="username" /></el-form-item>
        <el-form-item label="密码" prop="password"><el-input v-model="form.password" placeholder="请输入密码" size="large" type="password" show-password :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" /></el-form-item>
        <el-form-item v-if="mode === 'register'" label="确认密码" prop="confirmPassword"><el-input v-model="form.confirmPassword" placeholder="请再次输入密码" size="large" type="password" show-password autocomplete="new-password" /></el-form-item>
        <el-button class="submit-button" type="primary" size="large" native-type="submit">{{ mode === 'login' ? '登录' : '注册' }}</el-button>
      </el-form>
      <p class="switch-hint">{{ mode === 'login' ? '还没有账号？' : '已经有账号？' }} <button type="button" @click="switchMode(mode === 'login' ? 'register' : 'login')">{{ mode === 'login' ? '立即注册' : '返回登录' }}</button></p>
    </div>
  </section></main>
</template>

<style scoped>
.auth-page { min-height: 100vh; display: grid; place-items: center; padding: 32px 20px; background: linear-gradient(135deg, #eff6ff 0%, #f8fafc 55%, #eef2ff 100%); }
.auth-panel { width: min(100%, 440px); }.brand-block { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; color: #172554; }.brand-mark { display: grid; width: 46px; height: 46px; place-items: center; border-radius: 13px; color: #fff; background: #2563eb; font-size: 24px; font-weight: 700; }.brand-block h1 { margin: 0; font-size: 20px; }.brand-block p { margin: 4px 0 0; color: #64748b; font-size: 12px; }
.form-card { padding: 28px; border: 1px solid #e2e8f0; border-radius: 18px; background: rgb(255 255 255 / 94%); box-shadow: 0 20px 50px rgb(15 23 42 / 10%); }.mode-switch { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; margin-bottom: 26px; border-radius: 10px; background: #f1f5f9; }.mode-switch button { border: 0; border-radius: 8px; padding: 9px; color: #64748b; background: transparent; cursor: pointer; }.mode-switch button.active { color: #1d4ed8; background: #fff; font-weight: 600; }.form-heading h2 { margin: 0; color: #0f172a; font-size: 24px; }.form-heading p { margin: 8px 0 24px; color: #64748b; font-size: 14px; }.submit-button { width: 100%; margin-top: 8px; }.switch-hint { margin: 22px 0 0; color: #64748b; text-align: center; font-size: 13px; }.switch-hint button { padding: 0; border: 0; color: #2563eb; background: transparent; cursor: pointer; }
</style>

<style>
html, body, #app { width: 100%; height: 100%; margin: 0; overflow: hidden; }
.auth-page { box-sizing: border-box; width: 100%; height: 100dvh; min-height: 0; overflow: hidden; padding: 16px 20px; }
.auth-panel { max-height: 100%; }
.brand-block { margin-bottom: 14px; }
.form-card { box-sizing: border-box; padding: 22px 26px; }
.mode-switch { margin-bottom: 18px; }
.form-heading p { margin-bottom: 16px; }
.submit-button { margin-top: 4px; }
.switch-hint { margin-top: 14px; }
.el-form-item { margin-bottom: 14px; }
@media (max-height: 620px) {
  .auth-page { padding: 8px 16px; }
  .brand-block { margin-bottom: 8px; }
  .form-card { padding-top: 14px; padding-bottom: 14px; }
  .form-heading p { margin-bottom: 10px; }
  .el-form-item { margin-bottom: 8px; }
}
</style>
