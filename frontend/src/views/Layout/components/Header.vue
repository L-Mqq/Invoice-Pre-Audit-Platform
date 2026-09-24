<template>
  <header class="app-header">
    <div class="brand-block">
      <span class="brand-mark">发</span>
      <div>
        <h1>材料费发票智能预审与管理平台</h1>
        <p>Invoice Pre-Audit Platform</p>
      </div>
    </div>

    <div class="header-actions">
      <span class="username">管理员</span>
      <el-button class="logout-button" plain>退出登录</el-button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  box-sizing: border-box;
  display: flex;
  height: 72px;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  border-bottom: 1px solid #e2e8f0;
  background: rgb(255 255 255 / 96%);
  box-shadow: 0 4px 16px rgb(15 23 42 / 5%);
}

.brand-block { display: flex; align-items: center; gap: 12px; color: #172554; }
.brand-mark { display: grid; width: 38px; height: 38px; place-items: center; border-radius: 11px; color: #fff; background: #2563eb; font-size: 20px; font-weight: 700; box-shadow: 0 6px 14px rgb(37 99 235 / 22%); }
.brand-block h1 { margin: 0; font-size: 17px; font-weight: 700; }
.brand-block p { margin: 3px 0 0; color: #64748b; font-size: 11px; letter-spacing: .02em; }
.header-actions { display: flex; align-items: center; gap: 16px; }
.username { color: #334155; font-size: 14px; font-weight: 600; }
.logout-button { border-color: #cbd5e1; color: #475569; }
.logout-button:hover { border-color: #2563eb; color: #2563eb; background: #eff6ff; }

@media (max-width: 640px) {
  .app-header { height: 64px; padding: 0 16px; }
  .brand-block h1 { font-size: 14px; }
  .brand-block p { display: none; }
  .brand-mark { width: 34px; height: 34px; font-size: 17px; }
  .header-actions { gap: 8px; }
  .username { font-size: 13px; }
}
</style>
