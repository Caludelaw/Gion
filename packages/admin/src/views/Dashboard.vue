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
        <h3 style="margin: 32px 0 12px; font-size: 16px;">内容概览</h3>
        <div class="chart-bar" v-if="statusChart.data.length">
          <div class="bar-row" v-for="item in statusChart.data" :key="item.label">
            <span class="bar-label">{{ item.label }}</span>
            <div class="bar-track">
              <div class="bar-fill" :style="{ width: statusChart.pct(item.count) + '%', background: item.color }"></div>
            </div>
            <span class="bar-count">{{ item.count }}</span>
          </div>
        </div>

        <h3 style="margin: 32px 0 12px; font-size: 16px;">按类型分布</h3>
        <div class="chart-bar" v-if="typeChart.data.length">
          <div class="bar-row" v-for="item in typeChart.data" :key="item.label">
            <span class="bar-label">{{ item.label }}</span>
            <div class="bar-track">
              <div class="bar-fill" :style="{ width: typeChart.pct(item.count) + '%', background: item.color }"></div>
            </div>
            <span class="bar-count">{{ item.count }}</span>
          </div>
        </div>
      </div>

      <div style="width:260px">
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
import { ref, reactive, onMounted } from 'vue'
import { api } from '../api/index.js'

const stats = ref([])
const recent = ref([])
const sys = ref(null)
const statusChart = reactive({ data: [], pct: () => 0 })
const typeChart = reactive({ data: [], pct: () => 0 })

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4']

onMounted(async () => {
  try {
    const [types, health, articles] = await Promise.all([
      api.listTypes(),
      api.health().catch(() => null),
      api.listContent('article', { limit: 10, status: 'published' })
    ])

    const contentTypes = (types.types||[]).filter(t => !['user','api_key','webhook','audit_log','activitypub_activity','revision'].includes(t.name))

    // Fetch counts per content type
    const counts = await Promise.all(contentTypes.map(async t => {
      try {
        const r = await api.listContent(t.name, { limit: 1 })
        return { label: t.label, count: r.total || 0, name: t.name }
      } catch { return { label: t.label, count: 0, name: t.name } }
    }))
    stats.value = counts

    // Status distribution chart
    const statuses = ['published', 'draft', 'scheduled', 'archived']
    const statusLabels = { published: '已发布', draft: '草稿', scheduled: '定时', archived: '归档' }
    const statusColors = { published: '#10B981', draft: '#F59E0B', scheduled: '#6366F1', archived: '#9CA3AF' }
    const statusCounts = await Promise.all(statuses.map(async s => {
      let total = 0
      for (const t of contentTypes) {
        try {
          const r = await api.listContent(t.name, { limit: 1, status: s })
          total += r.total || 0
        } catch {}
      }
      return { label: statusLabels[s], count: total, color: statusColors[s] }
    }))
    const maxStatus = Math.max(1, ...statusCounts.map(s => s.count))
    statusChart.data = statusCounts
    statusChart.pct = (c) => Math.round((c / maxStatus) * 100)

    // Type distribution chart
    const maxType = Math.max(1, ...counts.map(c => c.count))
    typeChart.data = counts.map((c, i) => ({ ...c, color: COLORS[i % COLORS.length] }))
    typeChart.pct = (c) => Math.round((c / maxType) * 100)

    recent.value = (articles.docs || []).slice(0, 8)

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

.chart-bar { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 16px; }
.bar-row { display: flex; align-items: center; gap: 12px; padding: 6px 0; }
.bar-label { width: 50px; font-size: 13px; color: var(--text-secondary); text-align: right; flex-shrink: 0; }
.bar-track { flex: 1; height: 20px; background: var(--tag-bg); border-radius: 4px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 4px; transition: width 0.6s ease; min-width: 2px; }
.bar-count { width: 32px; font-size: 13px; font-weight: 600; color: var(--text-primary); text-align: left; }
</style>
