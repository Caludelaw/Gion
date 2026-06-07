<template>
  <div>
    <div class="header">
      <h1 class="page-title">🔗 Webhooks</h1>
      <button @click="showForm = true" class="btn-primary">+ 新建 Webhook</button>
    </div>

    <div v-if="showForm" class="card">
      <h3>新建 Webhook</h3>
      <div class="form-group">
        <label>URL</label>
        <input v-model="form.url" class="input" placeholder="https://example.com/webhook" />
      </div>
      <div class="form-group">
        <label>标签</label>
        <input v-model="form.label" class="input" placeholder="我的 Webhook" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>事件</label>
          <select v-model="form.events" multiple class="input" style="height:100px">
            <option value="create">创建</option>
            <option value="update">更新</option>
            <option value="delete">删除</option>
            <option value="publish">发布</option>
            <option value="*">全部</option>
          </select>
        </div>
        <div class="form-group">
          <label>内容类型</label>
          <select v-model="form.types" multiple class="input" style="height:100px">
            <option value="article">文章</option>
            <option value="page">页面</option>
            <option value="*">全部</option>
          </select>
        </div>
      </div>
      <div class="actions">
        <button @click="createWebhook" class="btn-primary" :disabled="creating">{{ creating ? '创建中...' : '创建' }}</button>
        <button @click="showForm = false" class="btn">取消</button>
      </div>
    </div>

    <div v-if="hooks.length" class="table-wrap">
      <table>
        <thead><tr><th>标签</th><th>URL</th><th>事件</th><th>统计</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="h in hooks" :key="h.id">
            <td>{{ h.label }}</td>
            <td class="url">{{ h.url }}</td>
            <td><span v-for="e in h.events" :key="e" class="tag">{{ e }}</span></td>
            <td>✅ {{ h.stats?.delivered || 0 }} / ❌ {{ h.stats?.failed || 0 }}</td>
            <td><button @click="deleteHook(h.id)" class="btn-danger">删除</button></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="empty">暂无 Webhook</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api/index.js'

const hooks = ref([])
const showForm = ref(false)
const creating = ref(false)
const form = ref({ url: '', label: '', events: ['*'], types: ['*'] })

onMounted(load)
async function load() {
  try { hooks.value = (await api.getWebhooks()).webhooks || [] } catch (e) { console.error(e) }
}
async function createWebhook() {
  creating.value = true
  try {
    await fetch('/api/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('taichu_token')}` },
      body: JSON.stringify({ url: form.value.url, label: form.value.label, events: form.value.events, types: form.value.types })
    })
    showForm.value = false
    form.value = { url: '', label: '', events: ['*'], types: ['*'] }
    await load()
  } catch (e) { alert('创建失败: ' + e.message) }
  creating.value = false
}
async function deleteHook(id) {
  if (!confirm('确认删除？')) return
  await fetch(`/api/webhooks/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('taichu_token')}` } })
  await load()
}
</script>

<style scoped>
.page-title { font-size: 24px; margin-bottom: 0; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.card { max-width: 640px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 24px; margin-bottom: 24px; }
.card h3 { margin-bottom: 16px; font-size: 16px; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 6px; }
.form-row { display: flex; gap: 16px; }
.form-row .form-group { flex: 1; }
.input { width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 14px; background: var(--bg); color: var(--text-primary); }
.actions { display: flex; gap: 8px; margin-top: 16px; }
.btn-primary { padding: 10px 24px; background: var(--primary); color: #fff; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; }
.btn { padding: 10px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; font-size: 14px; cursor: pointer; }
.btn-danger { padding: 4px 12px; background: var(--danger); color: #fff; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; }
.table-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { padding: 10px 16px; text-align: left; border-bottom: 1px solid var(--border); }
.url { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tag { display: inline-block; margin: 1px; padding: 1px 6px; background: #F0FDF4; color: var(--primary); border-radius: 3px; font-size: 11px; }
.empty { padding: 32px; text-align: center; color: var(--text-muted); }
</style>
