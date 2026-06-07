<template>
  <div>
    <div class="header">
      <h1 class="page-title">🧭 导航菜单</h1>
      <button @click="addItem" class="btn-primary">+ 添加菜单项</button>
    </div>

    <div v-if="showForm" class="card">
      <h3>{{ editing !== null ? '编辑' : '新建' }}菜单项</h3>
      <div class="form-row">
        <div class="form-group">
          <label>标题</label>
          <input v-model="form.title" class="input" placeholder="菜单标题" />
        </div>
        <div class="form-group">
          <label>链接</label>
          <input v-model="form.url" class="input" placeholder="/about 或 /post/slug" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>排序</label>
          <input v-model.number="form.order" class="input" type="number" min="0" />
        </div>
        <div class="form-group">
          <label>打开方式</label>
          <select v-model="form.target" class="input">
            <option value="">当前页</option>
            <option value="_blank">新窗口</option>
          </select>
        </div>
      </div>
      <div class="actions">
        <button @click="save" class="btn-primary">{{ saving ? '保存中...' : '保存' }}</button>
        <button @click="showForm = false; editing = null" class="btn">取消</button>
      </div>
    </div>

    <div v-if="items.length" class="table-wrap">
      <table>
        <thead><tr><th>排序</th><th>标题</th><th>链接</th><th>打开方式</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="item in items" :key="item.id">
            <td>{{ item.data?.order || 0 }}</td>
            <td>{{ item.data?.title }}</td>
            <td>{{ item.data?.url }}</td>
            <td>{{ item.data?.target === '_blank' ? '新窗口' : '当前页' }}</td>
            <td>
              <button @click="editItem(item)" class="btn-sm">编辑</button>
              <button @click="deleteItem(item)" class="btn-sm btn-red">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="empty">暂无菜单项，点击「添加菜单项」创建</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api/index.js'

const items = ref([])
const showForm = ref(false)
const editing = ref(null)
const saving = ref(false)
const form = ref({ title: '', url: '', order: 0, target: '' })

onMounted(load)
async function load() {
  try {
    const docs = await api.listContent('navigation', { limit: 50 })
    items.value = (docs.docs || []).sort((a, b) => (a.data?.order || 0) - (b.data?.order || 0))
  } catch { items.value = [] }
}

function addItem() { editing.value = null; form.value = { title: '', url: '', order: items.value.length, target: '' }; showForm.value = true }
function editItem(item) { editing.value = item; form.value = { ...item.data }; showForm.value = true }

async function save() {
  saving.value = true
  try {
    if (editing.value) {
      await api.updateContent('navigation', editing.value.id, { ...editing.value.data, ...form.value })
    } else {
      await api.createContent('navigation', form.value)
    }
    showForm.value = false; editing.value = null; await load()
  } catch (e) { alert('保存失败: ' + e.message) }
  saving.value = false
}

async function deleteItem(item) {
  if (!confirm('确认删除？')) return
  await api.deleteContent('navigation', item.id)
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
.actions { display: flex; gap: 8px; margin-top: 12px; }
.btn-primary { padding: 10px 24px; background: var(--primary); color: #fff; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; }
.btn { padding: 10px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; font-size: 14px; cursor: pointer; }
.btn-sm { padding: 4px 12px; border: 1px solid var(--border); border-radius: 4px; font-size: 12px; cursor: pointer; margin-right: 4px; }
.btn-red { color: var(--danger); border-color: var(--danger); }
.table-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { padding: 10px 16px; text-align: left; border-bottom: 1px solid var(--border); }
th { font-weight: 600; color: var(--text-secondary); background: var(--bg); }
.empty { padding: 32px; text-align: center; color: var(--text-muted); }
</style>
