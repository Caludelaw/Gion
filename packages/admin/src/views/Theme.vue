<template>
  <div>
    <h1 class="page-title">🎨 外观主题</h1>
    <p class="desc">Taichu 是 Headless CMS，前端主题由您的静态站点生成器或框架处理。此处配置全局样式变量，供 API 输出使用。</p>

    <div class="cards">
      <div class="card">
        <h3>🎨 品牌色彩</h3>
        <div class="form-group">
          <label>主色调</label>
          <div class="color-row">
            <input type="color" v-model="theme.primaryColor" class="color-input" />
            <input v-model="theme.primaryColor" class="input" placeholder="#10B981" />
          </div>
        </div>
        <div class="form-group">
          <label>背景色</label>
          <div class="color-row">
            <input type="color" v-model="theme.bgColor" class="color-input" />
            <input v-model="theme.bgColor" class="input" placeholder="#FFFFFF" />
          </div>
        </div>
        <div class="form-group">
          <label>文字色</label>
          <div class="color-row">
            <input type="color" v-model="theme.textColor" class="color-input" />
            <input v-model="theme.textColor" class="input" placeholder="#111827" />
          </div>
        </div>
      </div>

      <div class="card">
        <h3>🔤 排版</h3>
        <div class="form-group">
          <label>正文字体</label>
          <select v-model="theme.fontFamily" class="input">
            <option value="">系统默认</option>
            <option value="'Inter', sans-serif">Inter (现代)</option>
            <option value="'Noto Sans SC', sans-serif">Noto Sans SC (中文优化)</option>
            <option value="'Noto Serif SC', serif">Noto Serif SC (衬线中文)</option>
            <option value="'JetBrains Mono', monospace">JetBrains Mono (等宽)</option>
          </select>
        </div>
        <div class="form-group">
          <label>正文字号</label>
          <select v-model="theme.fontSize" class="input">
            <option value="14px">14px (小)</option>
            <option value="16px" selected>16px (默认)</option>
            <option value="18px">18px (大)</option>
            <option value="20px">20px (特大)</option>
          </select>
        </div>
      </div>

      <div class="card">
        <h3>📐 布局</h3>
        <div class="form-group">
          <label>内容宽度</label>
          <select v-model="theme.maxWidth" class="input">
            <option value="680px">680px (窄栏)</option>
            <option value="800px">800px (标准)</option>
            <option value="1024px">1024px (宽栏)</option>
            <option value="100%">100% (全宽)</option>
          </select>
        </div>
        <div class="form-group">
          <label>导航位置</label>
          <select v-model="theme.navPosition" class="input">
            <option value="top">顶部</option>
            <option value="left">左侧</option>
          </select>
        </div>
      </div>

      <div class="card">
        <h3>📝 自定义 CSS</h3>
        <div class="form-group">
          <label>全局 CSS（通过 API 输出）</label>
          <textarea v-model="theme.customCSS" class="input textarea" rows="6" placeholder="/* 自定义样式 */"></textarea>
        </div>
      </div>
    </div>

    <div class="actions">
      <button @click="save" class="btn-primary" :disabled="saving">{{ saving ? '保存中...' : '保存主题配置' }}</button>
      <span v-if="saved" class="saved">✅ 已保存</span>
    </div>

    <div class="note">
      <h3>💡 提示</h3>
      <p>这些配置通过 <code>GET /api/site-settings</code> 的 <code>theme</code> 字段输出，您的前端框架（Next.js / Nuxt / Hugo 等）可以直接读取使用。Taichu 不会渲染前端页面，只提供内容 API。</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api/index.js'

const saving = ref(false)
const saved = ref(false)
const theme = ref({
  primaryColor: '#10B981',
  bgColor: '#FFFFFF',
  textColor: '#111827',
  fontFamily: '',
  fontSize: '16px',
  maxWidth: '800px',
  navPosition: 'top',
  customCSS: ''
})

onMounted(async () => {
  try {
    const settings = await api.getSettings()
    if (settings.theme) theme.value = { ...theme.value, ...settings.theme }
  } catch {}
})

async function save() {
  saving.value = true
  saved.value = false
  try {
    await fetch('/api/site-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('taichu_token')}` },
      body: JSON.stringify({ theme: theme.value })
    })
    saved.value = true
    setTimeout(() => saved.value = false, 2000)
  } catch (e) { alert('保存失败: ' + e.message) }
  saving.value = false
}
</script>

<style scoped>
.page-title { font-size: 24px; margin-bottom: 8px; }
.desc { color: var(--text-secondary); margin-bottom: 24px; font-size: 14px; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; margin-bottom: 24px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 20px; }
.card h3 { font-size: 14px; font-weight: 600; margin-bottom: 14px; color: var(--text-primary); }
.form-group { margin-bottom: 14px; }
.form-group label { display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; }
.color-row { display: flex; gap: 8px; align-items: center; }
.color-input { width: 36px; height: 36px; border: 1px solid var(--border); border-radius: 4px; cursor: pointer; padding: 2px; }
.input { width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 14px; background: var(--bg); color: var(--text-primary); }
.textarea { resize: vertical; font-family: monospace; }
.actions { margin-bottom: 24px; display: flex; align-items: center; gap: 12px; }
.btn-primary { padding: 10px 24px; background: var(--primary); color: #fff; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; }
.saved { color: var(--primary); font-size: 13px; }
.note { background: var(--primary-bg); border: 1px solid var(--primary); border-radius: 8px; padding: 16px 20px; }
.note h3 { font-size: 14px; margin-bottom: 6px; }
.note p { font-size: 13px; color: var(--text-secondary); line-height: 1.6; }
code { background: var(--primary-bg); padding: 1px 6px; border-radius: 3px; font-size: 12px; }
</style>
