<template>
  <div>
    <div class="header">
      <h2 class="page-title">🖼️ 媒体库</h2>
      <button class="btn" @click="triggerUpload">+ 上传文件</button>
      <input ref="fileInput" type="file" multiple accept="image/*,video/*,application/pdf" @change="handleUpload" style="display:none" />
    </div>

    <div v-if="uploading" class="upload-status">上传中...</div>
    <div v-if="uploadError" class="upload-error">{{ uploadError }}</div>

    <div v-if="media.length" class="grid">
      <div v-for="m in media" :key="m.id" class="card">
        <div class="preview" @click="preview(m)">
          <img v-if="m.data.mimeType?.startsWith('image/')" :src="m.data.url" :alt="m.data.altText" loading="lazy" />
          <div v-else class="file-icon">{{ fileIcon(m.data.mimeType) }}</div>
        </div>
        <div class="info">
          <div class="name" :title="m.data.filename">{{ m.data.filename }}</div>
          <div class="meta">
            <span>{{ formatSize(m.data.size) }}</span>
            <span v-if="m.data.width">{{ m.data.width }}×{{ m.data.height }}</span>
          </div>
          <div class="actions">
            <button class="btn-sm" @click="copyUrl(m.data.url)">复制链接</button>
            <button class="btn-sm btn-danger" @click="remove(m)">删除</button>
          </div>
        </div>
      </div>
    </div>
    <p v-else-if="!uploading" class="empty">暂无媒体文件，上传图片或文档开始使用</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api/index.js'

const media = ref([])
const uploading = ref(false)
const uploadError = ref('')
const fileInput = ref(null)

function triggerUpload() {
  fileInput.value?.click()
}

async function handleUpload(e) {
  const files = e.target.files
  if (!files.length) return

  uploading.value = true
  uploadError.value = ''

  for (const file of files) {
    try {
      await api.uploadMedia(file)
    } catch (err) {
      uploadError.value = `上传 ${file.name} 失败: ${err.message}`
    }
  }

  uploading.value = false
  fileInput.value.value = ''
  await load()
}

async function load() {
  try {
    const res = await api.listMedia()
    media.value = res.docs || []
  } catch (e) {
    console.error(e)
  }
}

async function remove(m) {
  if (!confirm(`删除 "${m.data.filename}"？`)) return
  try {
    await api.deleteMedia(m.id)
    media.value = media.value.filter(x => x.id !== m.id)
  } catch (e) {
    alert(e.message)
  }
}

function preview(m) {
  if (m.data.mimeType?.startsWith('image/')) {
    window.open(m.data.url, '_blank')
  }
}

async function copyUrl(url) {
  const full = window.location.origin + url
  await navigator.clipboard.writeText(full)
  alert('链接已复制')
}

function formatSize(bytes) {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function fileIcon(mime) {
  if (!mime) return '📄'
  if (mime.startsWith('video/')) return '🎬'
  if (mime.includes('pdf')) return '📕'
  return '📄'
}

onMounted(load)
</script>

<style scoped>
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-title { font-size: 22px; }
.btn {
  padding: 8px 20px; background: var(--primary); color: white; border: none;
  border-radius: var(--radius); font-size: 14px; cursor: pointer; font-weight: 600;
}
.btn:hover { background: var(--primary-dark); }
.upload-status { padding: 12px; background: #DBEAFE; border-radius: var(--radius); margin-bottom: 16px; font-size: 14px; }
.upload-error { padding: 12px; background: #FEE2E2; border-radius: var(--radius); margin-bottom: 16px; font-size: 14px; color: #DC2626; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
.card {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  overflow: hidden; transition: border-color 0.2s;
}
.card:hover { border-color: var(--primary); }
.preview {
  height: 160px; display: flex; align-items: center; justify-content: center;
  background: var(--bg); cursor: pointer; overflow: hidden;
}
.preview img { width: 100%; height: 100%; object-fit: cover; }
.file-icon { font-size: 48px; }
.info { padding: 12px; }
.name { font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px; }
.meta { font-size: 11px; color: var(--text-secondary); display: flex; gap: 8px; margin-bottom: 8px; }
.actions { display: flex; gap: 6px; }
.btn-sm { padding: 4px 10px; font-size: 11px; border: 1px solid var(--border); background: var(--surface); border-radius: 4px; cursor: pointer; }
.btn-sm:hover { background: var(--bg); }
.btn-danger { color: var(--danger); }
.btn-danger:hover { border-color: var(--danger); background: #FEF2F2; }
.empty { color: var(--text-secondary); font-size: 14px; margin-top: 40px; text-align: center; }
</style>
