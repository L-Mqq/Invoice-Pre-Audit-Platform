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
.layout-page { min-height: 100vh; background: #f8fafc; }
.layout-body { display: flex; min-height: calc(100vh - 72px); }
.layout-content { flex: 1; min-width: 0; padding: 28px; }
@media (max-width: 640px) { .layout-body { min-height: calc(100vh - 64px); } }
</style>
