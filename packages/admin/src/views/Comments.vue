<template>
  <div>
    <div class="header">
      <h1 class="page-title">💬 评论管理</h1>
      <div class="search-bar">
        <select v-model="statusFilter" @change="load" class="input select-sm">
          <option value="">全部</option>
          <option value="pending">待审核</option>
          <option value="approved">已通过</option>
          <option value="spam">垃圾</option>
        </select>
      </div>
    </div>

    <table v-if="comments.length" class="table">
      <thead>
        <tr>
          <th style="width:180px">作者</th>
          <th>内容</th>
          <th style="width:80px">文章</th>
          <th style="width:80px">状态</th>
          <th style="width:100px">时间</th>
          <th style="width:160px">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in comments" :key="c.id" :class="{ pending: c.data?.status === 'pending' }">
          <td>
            <strong>{{ c.data?.author || '匿名' }}</strong>
            <div style="font-size:11px;color:var(--text-muted)">{{ c.data?.email || '' }}</div>
          </td>
          <td><div class="comment-body">{{ c.data?.body }}</div></td>
          <td>
            <a v-if="c.data?.postId" :href="`/post/${c.data.postId}`" target="_blank" class="post-link">
              🔗 查看
            </a>
          </td>
          <td><span :class="`badge badge-${statusBadge(c.data?.status)}`">{{ statusLabel(c.data?.status) }}</span></td>
          <td class="date-col">{{ fmtDate(c.createdAt, 'date') }}</td>
          <td>
            <button v-if="c.data?.status === 'pending'" @click="approve(c.id)" class="btn-sm" style="color:#065F46">✓ 通过</button>
            <button v-if="c.data?.status !== 'spam'" @click="markSpam(c.id)" class="btn-sm">🚫 垃圾</button>
            <button @click="remove(c.id)" class="btn-sm btn-danger">删除</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else class="empty">暂无评论</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api/index.js'
import { fmtDate, notifyError } from '../utils/format.js'

const comments = ref([])
const statusFilter = ref('pending')

async function load() {
  try {
    const { docs } = await api.listContent('comment', { limit: 200, status: statusFilter.value || undefined })
    comments.value = (docs || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  } catch (e) {
    console.error(e)
  }
}

async function approve(id) {
  try {
    await api.updateContent('comment', id, { data: { status: 'approved' } })
    load()
  } catch (e) { notifyError('操作', e) }
}

async function markSpam(id) {
  try {
    await api.updateContent('comment', id, { data: { status: 'spam' } })
    load()
  } catch (e) { notifyError('操作', e) }
}

async function remove(id) {
  if (!confirm('确认删除？')) return
  try {
    await api.deleteContent('comment', id)
    load()
  } catch (e) { notifyError('删除', e) }
}

function statusLabel(s) {
  const map = { pending: '待审核', approved: '已通过', spam: '垃圾' }
  return map[s] || s
}

function statusBadge(s) {
  const map = { pending: 'scheduled', approved: 'published', spam: 'archived' }
  return map[s] || 'archived'
}

onMounted(load)
</script>

<style scoped>
tr.pending { background: #FFFBEB; }
.comment-body { max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.post-link { font-size: 12px; color: var(--primary); text-decoration: none; }
</style>
