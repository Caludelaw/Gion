<template>
  <div>
    <div class="header">
      <h1 class="page-title">👥 用户管理</h1>
      <span class="page-info">共 {{ users.length }} 位用户</span>
    </div>

    <table v-if="users.length" class="table">
      <thead>
        <tr>
          <th>用户名</th>
          <th>邮箱</th>
          <th style="width:100px">角色</th>
          <th>注册时间</th>
          <th>状态</th>
          <th style="width:200px">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="u in users" :key="u.id">
          <td><strong>{{ u.data?.displayName || u.data?.username || u.id }}</strong></td>
          <td>{{ u.data?.email || '-' }}</td>
          <td>
            <select v-model="u.data.role" @change="updateRole(u)" class="role-select">
              <option value="admin">管理员</option>
              <option value="editor">编辑</option>
              <option value="user">用户</option>
            </select>
          </td>
          <td class="date-col">{{ fmtDate(u.createdAt, 'date') }}</td>
          <td>
            <span :class="`badge ${u.status === 'active' ? 'badge-published' : 'badge-archived'}`">
              {{ u.status === 'active' ? '正常' : '禁用' }}
            </span>
          </td>
          <td>
            <button @click="toggleUser(u)" class="btn-sm">
              {{ u.status === 'active' ? '禁用' : '启用' }}
            </button>
            <button @click="resetPassword(u)" class="btn-sm" title="重置密码">🔑</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else class="empty">暂无用户</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api/index.js'
import { fmtDate, notifyError } from '../utils/format.js'

const users = ref([])

onMounted(async () => {
  try {
    const { docs } = await api.listContent('user', { limit: 200 })
    users.value = (docs || []).map(u => ({
      ...u,
      data: { ...u.data, role: u.data?.role || 'user' }
    }))
  } catch (e) { console.error(e) }
})

async function toggleUser(u) {
  const newStatus = u.status === 'active' ? 'archived' : 'active'
  try {
    await api.updateContent('user', u.id, { status: newStatus })
    u.status = newStatus
  } catch (e) { notifyError('操作', e) }
}

async function updateRole(u) {
  try {
    await api.updateContent('user', u.id, { data: { ...u.data, role: u.data.role } })
  } catch (e) { notifyError('更新角色', e) }
}

function resetPassword(u) {
  const email = u.data?.email
  if (!email) { notifyError('重置密码', '该用户没有邮箱'); return }
  if (!confirm(`确定重置 ${u.data?.username} 的密码？`)) return
  notifyError('重置密码', '请通过邮件链接重置（尚未实现邮件发送）')
}
</script>

<style scoped>
.role-select {
  padding: 4px 8px; border: 1px solid var(--border); border-radius: 4px;
  font-size: 12px; background: var(--surface); color: var(--text-primary); cursor: pointer;
}
</style>
