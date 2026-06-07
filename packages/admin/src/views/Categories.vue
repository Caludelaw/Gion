<template>
  <div>
    <div class="header">
      <h1 class="page-title">📂 栏目管理</h1>
      <button @click="showForm = !showForm" class="btn-primary">{{ showForm ? '取消' : '+ 新建栏目' }}</button>
    </div>

    <div v-if="showForm" class="card">
      <h3>{{ editing ? '编辑栏目' : '新建栏目' }}</h3>
      <div class="form-row">
        <div class="form-group">
          <label>名称</label>
          <input v-model="form.name" class="input" placeholder="栏目名称" />
        </div>
        <div class="form-group">
          <label>Slug</label>
          <input v-model="form.slug" class="input" placeholder="url-slug" />
        </div>
      </div>
      <div class="form-group">
        <label>描述</label>
        <input v-model="form.description" class="input" placeholder="栏目描述" />
      </div>
      <div class="form-group">
        <label>父栏目</label>
        <select v-model="form.parentId" class="input">
          <option value="">无（顶级栏目）</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.data?.name || c.id }}</option>
        </select>
      </div>
      <div class="actions">
        <button @click="save" class="btn-primary" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
      </div>
    </div>

    <div v-if="categories.length" class="table-wrap">
      <table>
        <thead><tr><th>名称</th><th>Slug</th><th>父栏目</th><th>内容数</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="c in categories" :key="c.id">
            <td>{{ c.data?.name || c.id }}</td>
            <td>{{ c.data?.slug || '-' }}</td>
            <td>{{ parentName(c.data?.parentId) }}</td>
            <td>{{ c._count || 0 }}</td>
            <td>
              <button @click="edit(c)" class="btn-sm">编辑</button>
              <button @click="deleteCat(c)" class="btn-sm btn-red">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="empty">暂无栏目，点击「新建栏目」创建</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api/index.js'

const categories = ref([])
const showForm = ref(false)
const editing = ref(null)
const saving = ref(false)
const form = ref({ name: '', slug: '', description: '', parentId: '' })

onMounted(load)
async function load() {
  try { categories.value = (await api.listContent('category', { limit: 100 })).docs || [] } catch (e) { console.error(e) }
}
function parentName(id) {
  if (!id) return '—'
  const p = categories.value.find(c => c.id === id)
  return p?.data?.name || id
}
function edit(c) {
  editing.value = c
  form.value = { name: c.data?.name || '', slug: c.data?.slug || '', description: c.data?.description || '', parentId: c.data?.parentId || '' }
  showForm.value = true
}
async function save() {
  saving.value = true
  try {
    if (editing.value) {
      await api.updateContent('category', editing.value.id, { ...editing.value.data, ...form.value })
    } else {
      await api.createContent('category', form.value)
    }
    showForm.value = false
    editing.value = null
    form.value = { name: '', slug: '', description: '', parentId: '' }
    await load()
  } catch (e) { alert('保存失败: ' + e.message) }
  saving.value = false
}
async function deleteCat(c) {
  if (!confirm('确认删除栏目「' + (c.data?.name || c.id) + '」？子栏目和文章不受影响。')) return
  await api.deleteContent('category', c.id)
  await load()
}
</script>

<style scoped>
.page-title { font-size: 24px; margin-bottom: 0; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 24px; margin-bottom: 16px; }
.card h3 { margin-bottom: 16px; font-size: 16px; }
.form-group { margin-bottom: 14px; flex: 1; }
.form-group label { display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 6px; }
.form-row { display: flex; gap: 16px; }
.input { width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 14px; background: var(--bg); color: var(--text-primary); }
.actions { margin-top: 12px; }
.btn-primary { padding: 10px 24px; background: var(--primary); color: #fff; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; }
.btn-sm { padding: 4px 12px; border: 1px solid var(--border); border-radius: 4px; font-size: 12px; cursor: pointer; background: var(--bg); color: var(--text-primary); margin-right: 4px; }
.btn-red { color: var(--danger); border-color: var(--danger); }
.table-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { padding: 10px 16px; text-align: left; border-bottom: 1px solid var(--border); }
th { font-weight: 600; color: var(--text-secondary); background: var(--bg); }
.empty { padding: 32px; text-align: center; color: var(--text-muted); }
</style>
