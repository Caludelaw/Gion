<template>
  <div>
    <h1 class="page-title">📜 版本历史</h1>
    <router-link :to="`/content/${type}/${contentId}`" class="back-link">← 返回编辑</router-link>
    <div v-if="loading" class="loading">加载中...</div>
    <div v-if="!loading && revisions.length" class="rev-list">
      <div v-for="(r, i) in revisions" :key="r.id" class="rev-item">
        <div class="rev-header">
          <span class="rev-idx">#{{ revisions.length - i }}</span>
          <span class="rev-time">{{ fmtTime(r.timestamp) }}</span>
          <span class="rev-author">{{ r.authorType === 'agent' ? '🤖' : '👤' }} {{ r.author }}</span>
          <button @click="restore(r.id)" class="btn-sm btn-green">恢复此版本</button>
        </div>
        <div v-if="r.diff && r.diff.length" class="diff">
          <div v-for="d in r.diff" :key="d.field" class="diff-line">
            <span class="diff-field">{{ d.field }}</span>
            <span class="diff-from diff-removed">- {{ truncate(d.from) }}</span>
            <span class="diff-to diff-added">+ {{ truncate(d.to) }}</span>
          </div>
        </div>
        <div v-else class="no-diff">与前一版本无差异</div>
      </div>
    </div>
    <div v-else class="empty">暂无版本历史</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api/index.js'

const props = defineProps({ type: String, id: String })
const contentId = props.id
const type = props.type
const revisions = ref([])
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await api.getRevisions(type, contentId)
    revisions.value = res.revisions || []
  } catch (e) { console.error(e) }
  loading.value = false
})

async function restore(revId) {
  if (!confirm('确认恢复到此版本？')) return
  try {
    await fetch(`/api/content/${type}/${contentId}/revisions/${revId}/restore`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('gion_token')}` }
    })
    alert('已恢复')
    location.reload()
  } catch (e) { alert('恢复失败: ' + e.message) }
}

function truncate(v) {
  return typeof v === 'string' ? v.substring(0, 100) + (v.length > 100 ? '...' : '') : JSON.stringify(v).substring(0, 80)
}
function fmtTime(t) { return t ? new Date(t).toLocaleString('zh-CN') : '' }
</script>

<style scoped>
.page-title { font-size: 24px; margin-bottom: 8px; }
.back-link { color: var(--primary); text-decoration: none; font-size: 14px; display: inline-block; margin-bottom: 16px; }
.rev-list { display: flex; flex-direction: column; gap: 12px; }
.rev-item { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 16px; }
.rev-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; font-size: 13px; }
.rev-idx { font-weight: 700; color: var(--primary); }
.rev-time { color: var(--text-secondary); }
.rev-author { color: var(--text-secondary); }
.btn-sm { padding: 4px 12px; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; margin-left: auto; }
.btn-green { background: #10B981; color: #fff; }
.diff { margin-top: 8px; padding: 8px 12px; background: var(--bg); border-radius: 4px; font-size: 12px; font-family: monospace; }
.diff-line { margin-bottom: 4px; display: flex; gap: 8px; align-items: baseline; }
.diff-field { color: var(--text-secondary); min-width: 80px; font-weight: 600; }
.diff-removed { color: #EF4444; }
.diff-added { color: #10B981; }
.no-diff, .empty { padding: 16px; text-align: center; color: var(--text-muted); font-size: 13px; }
</style>
