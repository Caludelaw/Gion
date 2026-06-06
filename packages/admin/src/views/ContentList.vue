<template>
  <div>
    <div class="header">
      <h2 class="page-title">{{ typeLabel }}</h2>
      <button class="btn" @click="$router.push(`/content/${type}/new`)">+ 新建</button>
    </div>

    <table v-if="docs.length" class="table">
      <thead>
        <tr>
          <th>标题</th>
          <th>状态</th>
          <th>更新时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="doc in docs" :key="doc.id">
          <td>
            <a href="#" @click.prevent="$router.push(`/content/${type}/${doc.id}`)">
              {{ doc.data.title || doc.data.name || '(无标题)' }}
            </a>
          </td>
          <td><span :class="`badge badge-${doc.status}`">{{ doc.status }}</span></td>
          <td class="date">{{ fmtDate(doc.updatedAt) }}</td>
          <td>
            <button class="btn-sm" @click="$router.push(`/content/${type}/${doc.id}`)">编辑</button>
            <button class="btn-sm btn-danger" @click="remove(doc.id)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else class="empty">暂无{{ typeLabel }}内容</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { api } from '../api/index.js'

const props = defineProps({ type: String, types: Array })
const docs = ref([])

const typeLabel = computed(() => {
  const t = (props.types || []).find(t => t.name === props.type)
  return t ? t.label : props.type
})

async function load() {
  try {
    const res = await api.list(props.type)
    docs.value = res.docs || []
  } catch (e) {
    console.error(e)
  }
}

async function remove(id) {
  if (!confirm('确认删除？')) return
  try {
    await api.delete(props.type, id)
    docs.value = docs.value.filter(d => d.id !== id)
  } catch (e) {
    alert(e.message)
  }
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleString('zh-CN') : '-'
}

onMounted(load)
watch(() => props.type, load)
</script>

<style scoped>
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-title { font-size: 22px; }
.btn {
  padding: 8px 20px; background: var(--primary); color: white; border: none;
  border-radius: var(--radius); font-size: 14px; cursor: pointer; font-weight: 600;
}
.btn:hover { background: var(--primary-dark); }
.table { width: 100%; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); border-collapse: collapse; }
.table th, .table td { padding: 10px 16px; text-align: left; font-size: 14px; border-bottom: 1px solid var(--border); }
.table th { font-weight: 600; color: var(--text-secondary); background: var(--bg); }
.table a { color: var(--primary); text-decoration: none; }
.badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
.badge-published { background: #D1FAE5; color: #065F46; }
.badge-draft { background: #FEF3C7; color: #92400E; }
.badge-archived { background: #F3F4F6; color: #6B7280; }
.badge-active { background: #D1FAE5; color: #065F46; }
.badge-revoked { background: #FEE2E2; color: #991B1B; }
.date { color: var(--text-secondary); font-size: 13px; }
.btn-sm { padding: 4px 12px; font-size: 12px; border: 1px solid var(--border); background: var(--surface); border-radius: 4px; cursor: pointer; margin-right: 4px; }
.btn-sm:hover { border-color: var(--primary); }
.btn-danger { color: var(--danger); }
.btn-danger:hover { border-color: var(--danger); background: #FEF2F2; }
.empty { color: var(--text-secondary); font-size: 14px; margin-top: 40px; text-align: center; }
</style>
