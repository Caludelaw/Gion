<template>
  <div>
    <h2 class="page-title">仪表盘</h2>
    <div class="cards">
      <div class="card" v-for="s in stats" :key="s.label">
        <div class="card-num">{{ s.count }}</div>
        <div class="card-label">{{ s.label }}</div>
      </div>
    </div>

    <h3 style="margin: 32px 0 12px; font-size: 16px;">最近内容</h3>
    <div class="recent" v-if="recent.length">
      <div class="recent-item" v-for="doc in recent" :key="doc.id">
        <strong>{{ doc.data.title || doc.id }}</strong>
        <span class="meta">{{ doc.type }} · {{ doc.status }} · {{ fmtDate(doc.updatedAt) }}</span>
      </div>
    </div>
    <p v-else class="empty">暂无内容</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api/index.js'

const stats = ref([])
const recent = ref([])

onMounted(async () => {
  try {
    const res = await api.listTypes()
    const types = res.types || []
    const contentTypes = types.filter(t => !['user', 'api_key'].includes(t.name))

    // Stats — count per type
    const counts = await Promise.all(
      contentTypes.map(async t => {
        const r = await api.list(t.name, { limit: 1 })
        return { label: t.label, count: r.total || 0 }
      })
    )
    stats.value = counts

    // Recent — latest 10 from article type
    const articles = await api.list('article', { limit: 10 })
    recent.value = articles.docs || []
  } catch (e) {
    console.error(e)
  }
})

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('zh-CN') : '-'
}
</script>

<style scoped>
.page-title { font-size: 22px; margin-bottom: 24px; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; }
.card {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 20px; text-align: center;
}
.card-num { font-size: 28px; font-weight: 700; color: var(--primary); }
.card-label { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }
.recent { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
.recent-item {
  padding: 12px 16px; display: flex; justify-content: space-between; align-items: center;
  border-bottom: 1px solid var(--border);
}
.recent-item:last-child { border-bottom: none; }
.recent-item strong { font-size: 14px; }
.meta { font-size: 12px; color: var(--text-secondary); }
.empty { color: var(--text-secondary); font-size: 14px; }
</style>
