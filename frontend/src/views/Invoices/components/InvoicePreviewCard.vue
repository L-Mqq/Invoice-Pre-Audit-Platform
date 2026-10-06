<script setup lang="ts">
import type { InvoiceDetailFile } from '../../../apis/invoices'
import {
  getExtractionStatusLabel,
  getExtractionStatusType,
} from '../../../utils/status'

defineProps<{
  files: InvoiceDetailFile[]
  selectedFile: InvoiceDetailFile | null
  selectedFileId: number | null
  previewing: boolean
}>()

const emit = defineEmits<{
  preview: []
  'update:selectedFileId': [fileId: number]
}>()

</script>

<template>
  <el-card
    shadow="never"
    class="preview-card"
  >
    <div class="card-title">
      <h2>原始发票</h2>
      <el-button
        link
        type="primary"
        :disabled="!selectedFile"
        @click="emit('preview')"
      >
        放大预览
      </el-button>
    </div>

    <el-select
      v-if="files.length > 1"
      :model-value="selectedFileId"
      class="file-selector"
      placeholder="选择原始文件"
      @update:model-value="emit('update:selectedFileId', $event)"
    >
      <el-option
        v-for="file in files"
        :key="file.id"
        :label="file.originalName"
        :value="file.id"
      />
    </el-select>

    <div class="pdf-placeholder">
      <div class="pdf-icon">PDF</div>
      <strong>{{ selectedFile?.originalName || '暂无关联文件' }}</strong>
      <span>{{ selectedFile ? '点击预览查看原始发票' : '该发票暂未关联可预览文件' }}</span>
      <el-button
        type="primary"
        plain
        :disabled="!selectedFile"
        :loading="previewing"
        @click="emit('preview')"
      >
        预览文件
      </el-button>
    </div>
  </el-card>

  <el-card
    shadow="never"
    class="detail-card"
  >
    <div class="card-title">
      <h2>关联文件</h2>
      <span class="card-caption">{{ files.length }} 个文件</span>
    </div>

    <el-empty
      v-if="files.length === 0"
      description="暂无关联文件"
      :image-size="72"
    />
    <template v-else>
      <div
        v-for="file in files"
        :key="file.id"
        class="file-row"
      >
        <div>
          <strong>{{ file.originalName }}</strong>
          <span>{{ file.fileSize }} 字节</span>
        </div>
        <el-tag
          :type="getExtractionStatusType(file.extractionStatus)"
          effect="plain"
        >
          文件处理：{{ getExtractionStatusLabel(file.extractionStatus) }}
        </el-tag>
      </div>
    </template>
  </el-card>
</template>

<style scoped>
.detail-card,
.preview-card {
  border: 1px solid #e2e8f0;
  border-radius: 14px;
}

.card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.card-title h2 {
  margin: 0;
  font-size: 17px;
}

.card-caption {
  color: #94a3b8;
  font-size: 12px;
}

.file-selector {
  width: 100%;
  margin-bottom: 12px;
}

.pdf-placeholder {
  min-height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 1px dashed #bfdbfe;
  border-radius: 10px;
  background: #f8fbff;
  color: #64748b;
  text-align: center;
}

.pdf-icon {
  width: 58px;
  height: 68px;
  border-radius: 8px;
  background: #fee2e2;
  color: #dc2626;
  font-size: 14px;
  font-weight: 700;
  line-height: 68px;
}

.pdf-placeholder strong {
  color: #334155;
}

.pdf-placeholder span {
  font-size: 12px;
}

.file-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f1f5f9;
}

.file-row:last-child {
  border-bottom: 0;
}

.file-row > div {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-row strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.file-row span {
  color: #94a3b8;
  font-size: 12px;
}
</style>
