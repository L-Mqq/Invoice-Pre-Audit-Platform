<script setup lang="ts">
import { computed, ref } from 'vue'

type UploadStatus = 'ready' | 'uploading' | 'success' | 'failed'
interface UploadFile { id: number; name: string; size: string; status: UploadStatus; error?: string }

const isDragging = ref(false)
const isUploading = ref(false)
const files = ref<UploadFile[]>([])
const inputRef = ref<HTMLInputElement>()
const hasFiles = computed(() => files.value.length > 0)
const canUpload = computed(() => hasFiles.value && !isUploading.value)
const successCount = computed(() => files.value.filter((file) => file.status === 'success').length)
const failedCount = computed(() => files.value.filter((file) => file.status === 'failed').length)

function openFilePicker() { inputRef.value?.click() }
function formatSize(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB` }
function addFiles(selectedFiles: FileList | File[]) {
  const incoming = Array.from(selectedFiles)
  const hasZip = incoming.some((file) => file.name.toLowerCase().endsWith('.zip'))
  const hasPdf = incoming.some((file) => file.name.toLowerCase().endsWith('.pdf'))
  if (hasZip && (hasPdf || incoming.length > 1)) { window.alert('ZIP 只能单独上传，不能与 PDF 混合选择。'); return }
  const invalid = incoming.find((file) => { const name = file.name.toLowerCase(); return !(name.endsWith('.pdf') || name.endsWith('.zip')) || file.size > 20 * 1024 * 1024 })
  if (invalid) { window.alert(`文件“${invalid.name}”不是支持的 PDF/ZIP，或超过 20 MB 限制。`); return }
  files.value = incoming.slice(0, 50).map((file, index) => ({ id: Date.now() + index, name: file.name, size: formatSize(file.size), status: 'ready' }))
}
function handleInput(event: Event) { const target = event.target as HTMLInputElement; if (target.files) addFiles(target.files); target.value = '' }
function handleDrop(event: DragEvent) { isDragging.value = false; if (event.dataTransfer?.files) addFiles(event.dataTransfer.files) }
function removeFile(id: number) { if (!isUploading.value) files.value = files.value.filter((file) => file.id !== id) }
function clearFiles() { if (!isUploading.value) files.value = [] }
function startUpload() {
  if (!canUpload.value) return
  isUploading.value = true
  files.value = files.value.map((file) => ({ ...file, status: 'uploading' }))
  window.setTimeout(() => {
    files.value = files.value.map((file, index) => ({ ...file, status: index === files.value.length - 1 ? 'failed' : 'success', error: index === files.value.length - 1 ? '演示：该文件暂未完成解析' : undefined }))
    isUploading.value = false
  }, 900)
}
</script>

<template>
  <section class="upload-page">
    <div class="page-heading"><div><p class="eyebrow">INVOICE INTAKE</p><h1>上传发票</h1><p class="subtitle">上传 PDF 或 ZIP 文件，系统将自动提取发票信息并进行单价预审。</p></div><div class="rule-hint">支持 PDF / ZIP · 单文件不超过 20 MB · 最多 50 个文件</div></div>
    <div class="upload-grid">
      <el-card class="upload-card" shadow="never">
        <div class="drop-zone" :class="{ dragging: isDragging, 'has-files': hasFiles }" @click="openFilePicker" @dragenter.prevent="isDragging = true" @dragover.prevent="isDragging = true" @dragleave.prevent="isDragging = false" @drop.prevent="handleDrop">
          <input ref="inputRef" type="file" accept=".pdf,.zip,application/pdf,application/zip" multiple hidden @change="handleInput" />
          <div class="upload-icon">↑</div><h2>拖拽文件到这里</h2><p>或点击选择本地文件</p><el-button type="primary" plain @click.stop="openFilePicker">选择文件</el-button><span class="drop-note">ZIP 文件需单独上传，系统会自动提取其中的 PDF</span>
        </div>
        <div v-if="hasFiles" class="selected-header"><div><strong>待上传文件</strong><span>{{ files.length }} 个文件</span></div><el-button link type="danger" :disabled="isUploading" @click="clearFiles">清空</el-button></div>
        <div v-if="hasFiles" class="file-list"><div v-for="file in files" :key="file.id" class="file-row"><div class="file-type">{{ file.name.toLowerCase().endsWith('.zip') ? 'ZIP' : 'PDF' }}</div><div class="file-info"><strong>{{ file.name }}</strong><span>{{ file.size }}</span></div><el-tag v-if="file.status === 'ready'" effect="plain">待上传</el-tag><el-tag v-else-if="file.status === 'uploading'" type="warning" effect="plain">解析中</el-tag><el-tag v-else-if="file.status === 'success'" type="success" effect="plain">已完成</el-tag><el-tag v-else type="danger" effect="plain">失败</el-tag><el-button v-if="file.status === 'ready'" link type="danger" :disabled="isUploading" @click="removeFile(file.id)">移除</el-button></div></div>
        <div class="action-bar"><span class="processing-text"><span v-if="isUploading" class="dot" />{{ isUploading ? '正在解析并执行单价预审，请稍候…' : '提交后将自动创建上传批次' }}</span><el-button type="primary" size="large" :disabled="!canUpload" :loading="isUploading" @click="startUpload">开始上传</el-button></div>
      </el-card>
      <el-card class="result-card" shadow="never">
        <div class="card-title"><h2>批次结果</h2><el-tag v-if="isUploading" type="warning">处理中</el-tag><el-tag v-else-if="hasFiles && successCount + failedCount === files.length" :type="failedCount ? 'danger' : 'success'">{{ failedCount ? '部分失败' : '已完成' }}</el-tag><el-tag v-else type="info">未开始</el-tag></div>
        <div class="metrics"><div><strong>{{ files.length }}</strong><span>文件总数</span></div><div class="success"><strong>{{ successCount }}</strong><span>解析成功</span></div><div class="failed"><strong>{{ failedCount }}</strong><span>解析失败</span></div></div>
        <el-alert v-if="failedCount" title="部分文件未能完成解析" type="warning" :closable="false" show-icon description="请检查失败原因，修正文件后重新上传。" />
        <div v-else class="empty-result"><div class="empty-icon">✓</div><strong>上传后查看处理结果</strong><p>系统会逐个提取发票信息，并根据商品单价规则生成预审结果。</p></div>
      </el-card>
    </div>
  </section>
</template>

<style scoped>
.upload-page { max-width: 1180px; margin: 0 auto; color: #0f172a; }
.page-heading { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; margin-bottom: 24px; }.eyebrow { margin: 0 0 6px; color: #2563eb; font-size: 11px; font-weight: 700; letter-spacing: .14em; }h1 { margin: 0; font-size: 28px; letter-spacing: -.02em; }.subtitle { margin: 8px 0 0; color: #64748b; font-size: 14px; }.rule-hint { padding: 10px 14px; border: 1px solid #dbeafe; border-radius: 9px; background: #eff6ff; color: #2563eb; font-size: 12px; white-space: nowrap; }
.upload-grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(300px, .85fr); gap: 20px; }.upload-card, .result-card { border: 1px solid #e2e8f0; border-radius: 14px; }.drop-zone { min-height: 270px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1.5px dashed #bfdbfe; border-radius: 12px; background: #f8fbff; cursor: pointer; transition: .2s; }.drop-zone:hover, .drop-zone.dragging { border-color: #2563eb; background: #eff6ff; }.upload-icon { width: 48px; height: 48px; margin-bottom: 12px; border-radius: 14px; background: #dbeafe; color: #2563eb; font-size: 30px; line-height: 45px; text-align: center; }.drop-zone h2 { margin: 0; font-size: 17px; }.drop-zone p { margin: 7px 0 15px; color: #64748b; font-size: 13px; }.drop-note { margin-top: 14px; color: #94a3b8; font-size: 12px; }
.selected-header { display: flex; align-items: center; justify-content: space-between; margin: 22px 0 10px; }.selected-header strong { margin-right: 8px; }.selected-header span { color: #94a3b8; font-size: 12px; }.file-list { border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }.file-row { display: flex; align-items: center; gap: 10px; min-height: 62px; padding: 9px 12px; border-bottom: 1px solid #f1f5f9; }.file-row:last-child { border-bottom: 0; }.file-type { width: 38px; padding: 5px 0; border-radius: 6px; background: #eff6ff; color: #2563eb; font-size: 10px; font-weight: 700; text-align: center; }.file-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }.file-info strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }.file-info span { color: #94a3b8; font-size: 12px; }.action-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 20px; }.processing-text { color: #64748b; font-size: 12px; }.dot { display: inline-block; width: 7px; height: 7px; margin-right: 6px; border-radius: 50%; background: #f59e0b; }
.card-title { display: flex; align-items: center; justify-content: space-between; }.card-title h2 { margin: 0; font-size: 17px; }.metrics { display: grid; grid-template-columns: repeat(3, 1fr); margin: 22px 0; padding: 16px 0; border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; }.metrics div { display: flex; flex-direction: column; gap: 5px; text-align: center; border-right: 1px solid #f1f5f9; }.metrics div:last-child { border-right: 0; }.metrics strong { font-size: 24px; }.metrics span { color: #94a3b8; font-size: 12px; }.metrics .success strong { color: #16a34a; }.metrics .failed strong { color: #dc2626; }.empty-result { padding: 46px 20px 28px; text-align: center; color: #64748b; }.empty-icon { width: 40px; height: 40px; margin: 0 auto 12px; border-radius: 50%; background: #dcfce7; color: #16a34a; font-size: 23px; line-height: 40px; }.empty-result strong { color: #334155; font-size: 14px; }.empty-result p { margin: 9px auto 0; max-width: 250px; font-size: 12px; line-height: 1.7; }
@media (max-width: 850px) { .page-heading { align-items: flex-start; flex-direction: column; }.rule-hint { white-space: normal; }.upload-grid { grid-template-columns: 1fr; } }
</style>
