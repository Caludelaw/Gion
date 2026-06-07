<template>
  <div>
    <h1 class="page-title">⚙️ 站点配置</h1>
    <div v-if="loading" class="loading">加载中...</div>

    <div v-if="!loading && settings" class="card">
      <div class="form-group">
        <label>站点名称</label>
        <input v-model="settings.siteName" class="input" />
      </div>

      <h3 class="section-title">合规配置</h3>
      <div class="form-group">
        <label>ICP 备案号</label>
        <input v-model="settings.icpNumber" class="input" placeholder="例如：粤ICP备XXXXXXXX号-1" />
      </div>
      <div class="form-group">
        <label>公安备案号</label>
        <input v-model="settings.gonganNumber" class="input" placeholder="例如：粤公网安备 XXXXXX号" />
      </div>

      <h3 class="section-title">SEO</h3>
      <div class="form-group">
        <label>SEO 标题</label>
        <input v-model="settings.seoTitle" class="input" />
      </div>
      <div class="form-group">
        <label>SEO 描述</label>
        <textarea v-model="settings.seoDescription" class="input textarea" rows="3"></textarea>
      </div>
      <div class="form-group">
        <label>SEO 关键词 (逗号分隔)</label>
        <input v-model="keywordsStr" class="input" placeholder="Taichu, CMS, AI Agent" />
      </div>

      <h3 class="section-title">统计 & 语言</h3>
      <div class="form-group">
        <label>统计 ID (百度/Google)</label>
        <input v-model="settings.analyticsId" class="input" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>默认语言</label>
          <select v-model="settings.language" class="input">
            <option value="zh-CN">中文</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
          </select>
        </div>
        <div class="form-group">
          <label>时区</label>
          <select v-model="settings.timezone" class="input">
            <option value="Asia/Shanghai">上海 (UTC+8)</option>
            <option value="Asia/Tokyo">东京 (UTC+9)</option>
            <option value="America/New_York">纽约 (UTC-5)</option>
            <option value="Europe/London">伦敦 (UTC+0)</option>
          </select>
        </div>
      </div>

      <div class="actions">
        <button @click="save" class="btn-primary" :disabled="saving">{{ saving ? '保存中...' : '保存配置' }}</button>
        <span v-if="saved" class="saved">✅ 已保存</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../api/index.js'

const loading = ref(true)
const saving = ref(false)
const saved = ref(false)
const settings = ref(null)

const keywordsStr = computed({
  get: () => (settings.value?.seoKeywords || []).join(', '),
  set: (v) => { settings.value.seoKeywords = v.split(',').map(s => s.trim()).filter(Boolean) }
})

onMounted(async () => {
  try {
    const data = await api.getSettings()
    settings.value = data
  } catch (e) {
    console.error(e)
  }
  loading.value = false
})

async function save() {
  saving.value = true
  saved.value = false
  try {
    await fetch('/api/site-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('taichu_token')}` },
      body: JSON.stringify(settings.value)
    })
    saved.value = true
    setTimeout(() => saved.value = false, 2000)
  } catch (e) { alert('保存失败: ' + e.message) }
  saving.value = false
}
</script>

<style scoped>
.page-title { font-size: 24px; margin-bottom: 24px; }
.card { max-width: 640px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 24px; }
.section-title { font-size: 15px; font-weight: 600; color: var(--text-primary); margin: 24px 0 12px; padding-top: 16px; border-top: 1px solid var(--border); }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 6px; font-weight: 500; }
.form-row { display: flex; gap: 16px; }
.form-row .form-group { flex: 1; }
.input { width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 14px; background: var(--bg); color: var(--text-primary); }
.textarea { resize: vertical; }
.actions { margin-top: 24px; display: flex; align-items: center; gap: 12px; }
.btn-primary { padding: 10px 24px; background: var(--primary); color: #fff; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; }
.btn-primary:disabled { opacity: 0.6; }
.saved { color: var(--primary); font-size: 13px; }
</style>
