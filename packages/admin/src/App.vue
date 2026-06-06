<template>
  <div v-if="auth.isLoggedIn" class="layout">
    <aside class="sidebar">
      <div class="logo" @click="$router.push('/dashboard')">⚡ Gion</div>
      <nav>
        <template v-for="t in types" :key="t.name">
          <router-link :to="`/content/${t.name}`" class="nav-item">
            {{ t.label }}
          </router-link>
        </template>
        <router-link to="/apikeys" class="nav-item">🔑 API Keys</router-link>
      </nav>
      <div class="sidebar-footer">
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

const router = useRouter()
const types = ref([])

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

function logout() {
  auth.clearSession()
  router.push('/login')
}
</script>

<style>
.layout { display: flex; height: 100vh; }
.sidebar {
  width: 220px; background: var(--surface); border-right: 1px solid var(--border);
  display: flex; flex-direction: column; padding: 16px 0;
}
.logo {
  font-size: 18px; font-weight: 700; color: var(--primary); padding: 0 20px 20px;
  cursor: pointer;
}
.nav-item {
  display: block; padding: 10px 20px; color: var(--text-secondary); text-decoration: none;
  font-size: 14px; transition: all 0.15s;
}
.nav-item:hover, .nav-item.router-link-active { color: var(--primary); background: #F0FDF4; }
.sidebar-footer { margin-top: auto; padding: 16px 20px; border-top: 1px solid var(--border); }
.user { font-size: 13px; color: var(--text-secondary); display: block; margin-bottom: 8px; }
.btn-logout {
  font-size: 12px; color: var(--danger); background: none; border: none; cursor: pointer;
}
.main {
  flex: 1; overflow-y: auto; padding: 32px; background: var(--bg);
}
</style>
