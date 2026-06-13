<template>
  <div>
    <h1 class="page-title">🎨 主题管理</h1>
    <p class="desc">管理您网站的前端主题。Taichu 默认提供一个干净简洁的博客主题。您可以上传自定义主题替换它。</p>

    <div class="cards">
      <div class="card" v-for="t in themes" :key="t.name" :class="{ active: t.active }">
        <div class="card-header">
          <h3>{{ t.label }}</h3>
          <span v-if="t.active" class="badge active">使用中</span>
        </div>
        <p class="card-desc">{{ t.description }}</p>
        <div class="card-actions">
          <button v-if="!t.active" @click="activate(t.name)" class="btn-primary">启用</button>
          <button v-if="t.name !== 'default'" @click="removeTheme(t.name)" class="btn-danger">删除</button>
        </div>
      </div>
    </div>

    <div class="card upload-card">
      <h3>📤 上传自定义主题</h3>
      <p class="desc">上传一个 .zip 文件，包含 index.html 和静态资源文件。</p>
      <div class="form-group">
        <label>主题名称</label>
        <input v-model="themeName" class="input" placeholder="my-theme" />
      </div>
      <div class="form-group">
        <label>{{ fileLabel }}</label>
        <input type="file" class="input" @change="handleFile" accept=".zip" />
      </div>
      <button @click="upload" class="btn-primary" :disabled="!file || !themeName || uploading">
        {{ uploading ? '上传中...' : '上传主题' }}
      </button>
    </div>

    <div class="note">
      <h3>💡 如何创建自定义主题</h3>
      <p>1. 创建 <code>index.html</code> 文件，其中通过 <code>window.__TAICHU__</code> 读取站点配置和主题变量</p>
      <p>2. 通过 <code>/api/content/article</code> 等 REST API 获取内容数据</p>
      <p>3. 将所有文件打包成 <code>.zip</code>，上传至此页面</p>
      <p>4. Taichu 会自动将主题注入站点配置并渲染前端页面</p>
      <p class="mt-8"><strong>主题变量参考：</strong></p>
      <pre class="code-block">{{ themeVarExample }}</pre>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api/index.js'

const themes = ref([])
const themeName = ref('')
const file = ref(null)
const fileLabel = ref('选择文件')
const uploading = ref(false)

const themeVarExample = `// window.__TAICHU__ 包含以下配置：
{
  apiBase: "/api",
  site: {
    name: "我的博客",
    icp: "粤ICP备XXXXXXXX号-1",
    gongan: "粤公网安备 XXXXXX号"
  },
  theme: {
    primaryColor: "#10B981",
    fontFamily: "'Noto Sans SC', sans-serif",
    maxWidth: "800px"
  },
  seo: {
    title: "SEO 标题",
    description: "SEO 描述",
    keywords: ["关键词1", "关键词2"]
  }
}`

onMounted(async () => {
  try {
    const data = await api.request('/theme')
    themes.value = data.themes || []
  } catch (e) {
    // Fallback
    themes.value = [
      { name: 'default', label: '默认博客主题', description: 'Taichu 内置简洁博客主题', active: true, builtin: true },
      { name: 'theme-minimal', label: '极简主题', description: '衬线字体 + 留白布局', active: false, builtin: true }
    ]
  }
})

function handleFile(e) {
  file.value = e.target.files[0]
  fileLabel.value = file.value ? file.value.name : '选择文件'
}

async function activate(name) {
  try {
    await api.request('/theme/activate/' + name, { method: 'POST' })
    themes.value.forEach(t => t.active = (t.name === name))
  } catch (e) { alert('切换失败: ' + e.message) }
}

async function upload() {
  uploading.value = true
  try {
    const form = new FormData()
    form.append('file', file.value)
    form.append('name', themeName.value)
    const res = await fetch('/api/theme/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('taichu_token')}` },
      body: form
    })
    if (!res.ok) throw new Error((await res.json()).message)
    themes.value.push({ name: themeName.value, label: themeName.value, description: '自定义主题', active: false })
    themeName.value = ''
    file.value = null
    fileLabel.value = '选择文件'
  } catch (e) { alert('上传失败: ' + e.message) }
  uploading.value = false
}

function removeTheme(name) {
  if (!confirm('确认删除主题「'+name+'」？')) return
  fetch('/api/theme/' + name, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('taichu_token')}` } })
  themes.value = themes.value.filter(t => t.name !== name)
}
</script>

<style scoped>
.page-title { font-size: 24px; margin-bottom: 8px; }
.desc { color: var(--text-secondary); font-size: 14px; margin-bottom: 24px; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 20px; }
.card.active { border-color: var(--primary); }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.card h3 { font-size: 16px; }
.badge { background: var(--primary); color: #fff; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
.badge.active { background: #10B981; }
.card-desc { font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; }
.card-actions { display: flex; gap: 8px; }
.upload-card { margin-bottom: 24px; }
.form-group { margin-bottom: 14px; }
.form-group label { display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 6px; }
.input { width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 14px; background: var(--bg); color: var(--text-primary); }
.btn-primary { padding: 10px 24px; background: var(--primary); color: #fff; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; }
.btn-primary:disabled { opacity: 0.6; }
.btn-danger { padding: 6px 14px; background: var(--danger); color: #fff; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; }
.note { background: var(--primary-bg); border: 1px solid var(--primary); border-radius: 8px; padding: 20px; }
.note h3 { font-size: 14px; margin-bottom: 8px; }
.note p { font-size: 13px; color: var(--text-secondary); margin-bottom: 4px; line-height: 1.8; }
.mt-8 { margin-top: 12px; }
.code-block { background: #1F2937; color: #E5E7EB; padding: 12px 16px; border-radius: 6px; font-size: 12px; overflow-x: auto; margin-top: 8px; white-space: pre; }
</style>
