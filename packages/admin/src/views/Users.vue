<template>
  <div>
    <h1 class="page-title">👥 用户管理</h1>
    <div class="table-wrap">
      <table>
        <thead><tr><th>用户名</th><th>邮箱</th><th>角色</th><th>注册时间</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td>{{ u.data?.username || u.id }}</td>
            <td>{{ u.data?.email || '-' }}</td>
            <td>{{ u.data?.role || 'user' }}</td>
            <td>{{ fmtTime(u.createdAt) }}</td>
            <td><span :class="'tag ' + (u.status === 'published' ? 'tag-active' : 'tag-inactive')">{{ u.status === 'published' ? '正常' : '禁用' }}</span></td>
            <td>
              <button @click="toggleUser(u)" class="btn-sm">{{ u.status === 'published' ? '禁用' : '启用' }}</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!users.length" class="empty">暂无用户</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api/index.js'

const users = ref([])
onMounted(async () => {
  try { users.value = (await api.listContent('user')).docs || [] } catch (e) { console.error(e) }
})
async function toggleUser(u) {
  const newStatus = u.status === 'published' ? 'archived' : 'published'
  try {
    await api.updateContent('user', u.id, { ...u.data, status: newStatus })
    u.status = newStatus
  } catch (e) { alert('操作失败: ' + e.message) }
}
function fmtTime(t) { return t ? new Date(t).toLocaleString('zh-CN') : '' }
</script>

<style scoped>
.page-title { font-size: 24px; margin-bottom: 16px; }
.table-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { padding: 10px 16px; text-align: left; border-bottom: 1px solid var(--border); }
th { font-weight: 600; color: var(--text-secondary); background: var(--bg); }
.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
.tag-active { background: #DCFCE7; color: #166534; }
.tag-inactive { background: #FEE2E2; color: #991B1B; }
.btn-sm { padding: 4px 12px; border: 1px solid var(--border); border-radius: 4px; font-size: 12px; cursor: pointer; background: var(--bg); color: var(--text-primary); }
.empty { padding: 32px; text-align: center; color: var(--text-muted); }
</style>
