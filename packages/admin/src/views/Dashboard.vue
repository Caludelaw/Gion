<template>
  <div>
    <h2 class="page-title">仪表盘</h2>

    <div class="cards">
      <div class="card" v-for="s in stats" :key="s.label">
        <div class="card-num">{{ s.count }}</div>
        <div class="card-label">{{ s.label }}</div>
      </div>
    </div>

    <div class="row">
      <div style="flex:1">
        <h3 style="margin: 32px 0 12px; font-size: 16px;">最近内容</h3>
        <div class="recent" v-if="recent.length">
          <div class="recent-item" v-for="doc in recent" :key="doc.id">
            <router-link :to="`/content/${doc.type}/${doc.id}`" class="recent-link">
              {{ doc.data?.title || doc.id }}
            </router-link>
            <span class="meta">{{ doc.type }} · {{ statusLabel(doc.status) }} · {{ fmtDate(doc.updatedAt) }}</span>
          </div>
        </div>
        <p v-else class="empty">暂无内容</p>
      </div>

      <div style="width:260px">
        <h3 style="margin: 32px 0 12px; font-size: 16px;">系统信息</h3>
        <div class="system-info" v-if="sys">
          <div class="sys-row"><span>版本</span><code>{{ sys.version }}</code></div>
          <div class="sys-row"><span>Node.js</span><code>{{ sys.node }}</code></div>
          <div class="sys-row"><span>运行时间</span><code>{{ formatUptime(sys.uptime) }}</code></div>
          <div class="sys-row"><span>内存</span><code>{{ sys.memory }}</code></div>
          <div class="sys-row"><span>存储</span><code>{{ sys.store }}</code></div>
          <div class="sys-row"><span>WS 连接</span><code>{{ sys.ws }}</code></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api/index.js'

const stats = ref([])
const recent = ref([])
const sys = ref(null)

onMounted(async () => {
  try {
    const [types, health, articles] = await Promise.all([
      api.listTypes(),
      api.health().catch(() => null),
      api.listContent('article', { limit: 10, status: 'published' })
    ])

    const contentTypes = (types.types||[]).filter(t => !['user','api_key','webhook','audit_log'].includes(t.name))
    const counts = await Promise.all(contentTypes.map(async t => {
      try {
        const r = await api.listContent(t.name, { limit: 1 })
        return { label: t.label, count: r.total || 0 }
      } catch { return { label: t.label, count: 0 } }
    }))
    stats.value = counts

    recent.value = articles.docs || []

    if (health) {
      sys.value = {
        version: health.version,
        node: health.node,
        uptime: health.uptime,
        memory: health.memory?.heapUsed || '',
        store: health.store,
        ws: health.ws?.connected || 0
      }
    }
  } catch (e) { console.error(e) }
})

function statusLabel(s) { return s === 'published' ? '已发布' : s === 'draft' ? '草稿' : s === 'archived' ? '已归档' : s || '-' }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('zh-CN') : '-' }
function formatUptime(s) {
  var h = Math.floor(s/3600), m = Math.floor((s%3600)/60);
  return h > 0 ? h+'h '+m+'m' : m+'m '+(s%60)+'s';
}
</script>

<style scoped>
.page-title { font-size: 22px; margin-bottom: 24px; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 20px; text-align: center; }
.card-num { font-size: 28px; font-weight: 700; color: var(--primary); }
.card-label { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }
.row { display: flex; gap: 32px; flex-wrap: wrap; }
.recent { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; }
.recent-item { padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); gap: 8px; }
.recent-item:last-child { border-bottom: none; }
.recent-link { font-size: 14px; color: var(--text-primary); text-decoration: none; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.recent-link:hover { color: var(--primary); }
.meta { font-size: 12px; color: var(--text-secondary); white-space: nowrap; }
.system-info { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; }
.sys-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; font-size: 13px; border-bottom: 1px solid var(--border); }
.sys-row:last-child { border-bottom: none; }
.sys-row span { color: var(--text-secondary); }
.sys-row code { color: var(--primary); font-size: 12px; }
.empty { color: var(--text-secondary); font-size: 14px; }
</style>
