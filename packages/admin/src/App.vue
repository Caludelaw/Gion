<template>
  <div v-if="auth.isLoggedIn" class="layout">
    <aside class="sidebar">
      <div class="logo" @click="$router.push('/dashboard')">⚡ Gion</div>
      <nav>
        <div class="nav-section">内容</div>
        <template v-for="t in types" :key="t.name">
          <router-link :to="`/content/${t.name}`" class="nav-item">{{ t.label }}</router-link>
        </template>
        <router-link to="/media" class="nav-item">🖼️ 媒体库</router-link>
        <router-link to="/categories" class="nav-item">📂 栏目管理</router-link>
        <router-link to="/navigation" class="nav-item">🧭 导航菜单</router-link>

        <div class="nav-section">管理</div>
        <router-link to="/users" class="nav-item">👥 用户管理</router-link>
        <router-link to="/apikeys" class="nav-item">🔑 API Keys</router-link>
        <router-link to="/webhooks" class="nav-item">🔗 Webhooks</router-link>
        <router-link to="/settings" class="nav-item">⚙️ 站点配置</router-link>
        <router-link to="/theme" class="nav-item">🎨 外观主题</router-link>
        <router-link to="/theme-manager" class="nav-item">📦 主题管理</router-link>

        <div class="nav-section">安全</div>
        <router-link to="/audit" class="nav-item">📋 审计日志</router-link>
        <router-link to="/workflow" class="nav-item">✅ 审核队列</router-link>

        <div class="nav-section">开发</div>
        <router-link to="/pipelines" class="nav-item">🔄 管道模板</router-link>
        <a href="/api/graphql" target="_blank" class="nav-item">🔬 GraphiQL</a>
        <a href="/ws-test.html" target="_blank" class="nav-item">📡 WS 测试</a>
      </nav>
      <div class="sidebar-footer">
        <div class="lang-switch">
          <select v-model="locale" @change="switchLang" class="lang-select">
            <option v-for="l in i18n.supportedLocales" :key="l.code" :value="l.code">{{ l.flag }} {{ l.label }}</option>
          </select>
        </div>
        <span class="user">{{ auth.user?.username }}</span>
        <button @click="logout" class="btn-logout">退出</button>
      </div>
    </aside>
    <main class="main">
      <router-view :types="types" />
    </main>
  </div>
  <router-view v-else />
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from './stores/auth.js'
import { api } from './api/index.js'
import { useI18n } from './i18n.js'

const router = useRouter()
const types = ref([])
const i18n = useI18n()
const locale = ref(i18n.locale.value)

onMounted(async () => {
  if (auth.isLoggedIn) {
    try {
      const res = await api.listTypes()
      types.value = res.types || []
    } catch {
      auth.clearSession()
      router.push('/login')
    }
  }
})

function switchLang() {
  i18n.setLocale(locale.value)
}

function logout() {
  auth.clearSession()
  router.push('/login')
}
</script>

<style>
.layout { display: flex; height: 100vh; }
.sidebar {
  width: 220px; background: var(--surface); border-right: 1px solid var(--border);
  display: flex; flex-direction: column; padding: 16px 0; overflow-y: auto;
}
.logo {
  font-size: 18px; font-weight: 700; color: var(--primary); padding: 0 20px 20px;
  cursor: pointer;
}
.nav-section {
  font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;
  padding: 12px 20px 6px; letter-spacing: 0.5px;
}
.nav-item {
  display: block; padding: 8px 20px; color: var(--text-secondary); text-decoration: none;
  font-size: 13px; transition: all 0.15s;
}
.nav-item:hover, .nav-item.router-link-active { color: var(--primary); background: #F0FDF4; }
.sidebar-footer { margin-top: auto; padding: 16px 20px; border-top: 1px solid var(--border); }
.lang-switch { margin-bottom: 8px; }
.lang-select {
  width: 100%; padding: 4px 8px; background: var(--bg); border: 1px solid var(--border);
  border-radius: 4px; font-size: 12px; color: var(--text-primary); cursor: pointer;
}
.user { font-size: 13px; color: var(--text-secondary); display: block; margin-bottom: 8px; }
.btn-logout {
  font-size: 12px; color: var(--danger); background: none; border: none; cursor: pointer;
}
.main {
  flex: 1; overflow-y: auto; padding: 32px; background: var(--bg);
}
</style>
