<script setup lang="ts">
import Header from './components/Header.vue'
import Sidebar from './components/Sidebar.vue'
</script>

<template>
  <div class="layout-page">
    <Header />
    <div class="layout-body">
      <Sidebar />
      <main class="layout-content" aria-label="内容详情">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
.layout-page {
  display: flex;
  height: 100dvh;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  background: #f8fafc;
}

.layout-body {
  display: flex;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.layout-content {
  min-width: 0;
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 28px;
}

@media (max-width: 640px) {
  .layout-content {
    padding: 20px 16px;
  }
}
</style>
