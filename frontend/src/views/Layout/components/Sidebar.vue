<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const emit = defineEmits<{ select: [key: string] }>()
const selected = ref('dashboard')
const menuRef = ref()
const router = useRouter()
const route = useRoute()
const routeMap: Record<string, string> = { dashboard: 'overview', 'invoice-list': 'invoice-list', 'upload-invoice': 'upload-invoice', 'reimbursement-progress': 'reimbursement-progress', rules: 'rules' }
watch(() => route.name, (name) => {
  const menuKey = Object.keys(routeMap).find((key) => routeMap[key] === name)
  if (menuKey) {
    selected.value = menuKey
    nextTick(() => {
      menuRef.value?.updateActiveIndex(menuKey)
      if (['invoice-list', 'upload-invoice', 'reimbursement-progress'].includes(menuKey)) {
        menuRef.value?.open('invoice')
      }
    })
  }
}, { immediate: true })

function handleSelect(key: string) {
  selected.value = key === 'invoice' ? 'invoice-list' : key
  menuRef.value?.updateActiveIndex(selected.value)
  emit('select', selected.value)
  const routeName = routeMap[selected.value]
  if (routeName && route.name !== routeName) router.push({ name: routeName })
}

</script>

<template>
  <aside class="sidebar">
    <el-menu ref="menuRef" class="side-menu" :default-active="selected" @select="handleSelect">
      <el-menu-item index="dashboard">
        <span class="menu-icon">▦</span>
        <span>本周概览</span>
      </el-menu-item>

      <el-sub-menu index="invoice">
        <template #title>
          <span class="invoice-menu-title">
            <span class="menu-icon">▤</span>
            <span>发票管理</span>
          </span>
        </template>
        <el-menu-item index="upload-invoice">上传发票</el-menu-item>
        <el-menu-item index="invoice-list">发票列表</el-menu-item>
        <el-menu-item index="reimbursement-progress">报销进度</el-menu-item>
      </el-sub-menu>

      <el-menu-item index="rules">
        <span class="menu-icon">⚙</span>
        <span>规则管理</span>
      </el-menu-item>
    </el-menu>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 224px;
  min-height: 0;
  flex: 0 0 224px;
  overflow-y: auto;
  border-right: 1px solid #e2e8f0;
  background: #fff;
}

.side-menu {
  min-height: 100%;
  border-right: 0;
  padding: 14px 10px;
}
.side-menu :deep(.el-menu-item), .side-menu :deep(.el-sub-menu__title) { height: 46px; line-height: 46px; margin: 3px 0; border-radius: 9px; color: #475569; }
.side-menu :deep(.el-menu-item.is-active) { color: #2563eb; background: #eff6ff; font-weight: 600; }
.side-menu :deep(.el-sub-menu.is-opened > .el-sub-menu__title) { color: #475569; }
.side-menu :deep(.el-menu--inline) { background: transparent; }
.side-menu :deep(.el-menu--inline .el-menu-item) { min-width: 0; padding-left: 48px !important; font-size: 13px; }
.menu-icon { display: inline-block; width: 24px; margin-right: 8px; color: #64748b; font-size: 17px; text-align: center; }
.invoice-menu-title { display: inline-flex; width: 100%; align-items: center; }
.side-menu :deep(.el-menu-item.is-active) .menu-icon, .side-menu :deep(.el-sub-menu.is-opened) .menu-icon { color: #2563eb; }
@media (max-width: 720px) { .sidebar { width: 180px; flex-basis: 180px; } .side-menu :deep(.el-menu--inline .el-menu-item) { padding-left: 36px !important; } }
</style>
