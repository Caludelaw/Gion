<template>
  <div>
    <h1 class="page-title">🔄 管道模板</h1>
    <p class="desc">定义 Agent 内容处理管道，Agent 可通过 MCP <code>list_pipelines</code> tool 发现和调用。</p>
    <div class="cards">
      <div v-for="t in templates" :key="t.name" class="card">
        <h3>{{ t.label }}</h3>
        <div class="steps">
          <div v-for="(s, i) in t.steps" :key="s.name" class="step">
            <span class="step-num">{{ i + 1 }}</span>
            <span class="step-name">{{ s.name }}</span>
            <span v-if="s.config" class="step-config">{{ JSON.stringify(s.config) }}</span>
          </div>
        </div>
      </div>
    </div>
    <div v-if="!templates.length" class="empty">暂无管道模板</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api/index.js'

const templates = ref([])
onMounted(async () => {
  try { templates.value = (await api.getPipelines()).templates || [] } catch (e) { console.error(e) }
})
</script>

<style scoped>
.page-title { font-size: 24px; margin-bottom: 8px; }
.desc { color: var(--text-secondary); margin-bottom: 24px; font-size: 14px; }
code { background: var(--bg); padding: 1px 6px; border-radius: 3px; font-size: 12px; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 20px; }
.card h3 { font-size: 16px; margin-bottom: 12px; }
.steps { display: flex; flex-wrap: wrap; gap: 6px; }
.step { display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: var(--bg); border-radius: 4px; font-size: 12px; }
.step-num { width: 18px; height: 18px; background: var(--primary); color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; }
.step-name { font-weight: 500; }
.step-config { color: var(--text-muted); font-size: 10px; }
.empty { padding: 32px; text-align: center; color: var(--text-muted); }
</style>
