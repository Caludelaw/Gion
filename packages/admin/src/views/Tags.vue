<template>
  <div>
    <div class="header">
      <h1 class="page-title">🏷️ 标签管理</h1>
      <button class="btn" @click="showCreate = true">+ 新建标签</button>
    </div>

    <div v-if="showCreate" class="card" style="margin-bottom:20px">
      <h3 style="font-size:15px;margin-bottom:12px">新建标签</h3>
      <div class="form-row">
        <div class="form-group" style="flex:1">
          <label>标签名称</label>
          <input v-model="newTag.name" class="input" placeholder="例如：技术、前端、开源" @keyup.enter="createTag" />
        </div>
        <div class="form-group" style="flex:1">
          <label>Slug（可选）</label>
          <input v-model="newTag.slug" class="input" placeholder="自动生成" />
        </div>
      </div>
      <button class="btn-primary" @click="createTag" :disabled="!newTag.name || creating">
        {{ creating ? '创建中...' : '创建' }}
      </button>
      <button class="btn-sm" @click="showCreate = false" style="margin-left:8px">取消</button>
      <p v-if="error" class="error-msg">{{ error }}</p>
    </div>

    <table v-if="tags.length" class="table">
      <thead>
        <tr>
          <th>标签</th>
          <th>Slug</th>
          <th>文章数</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="t in tags" :key="t.name">
          <td><span class="tag">{{ t.name }}</span></td>
          <td class="date-col">{{ t.slug }}</td>
          <td>{{ t.count || 0 }}</td>
          <td><button @click="removeTag(t.name)" class="btn-sm btn-danger">删除</button></td>
        </tr>
      </tbody>
    </table>
    <p v-else-if="!loading" class="empty">暂无标签</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api/index.js'
import { notifyError } from '../utils/format.js'

const tags = ref([])
const loading = ref(false)
const showCreate = ref(false)
const creating = ref(false)
const error = ref('')
const newTag = ref({ name: '', slug: '' })

async function load() {
  loading.value = true
  try {
    const { docs } = await api.listContent('article', { limit: 500, status: 'published' })
    const tagMap = {}
    for (const doc of docs) {
      for (const t of doc.data?.tags || []) {
        if (!tagMap[t]) tagMap[t] = { name: t, slug: t.toLowerCase().replace(/\s+/g, '-'), count: 0 }
        tagMap[t].count++
      }
    }
    tags.value = Object.values(tagMap).sort((a, b) => b.count - a.count)
  } catch (e) {
    error.value = '加载失败'
  } finally {
    loading.value = false
  }
}

async function createTag() {
  error.value = ''
  creating.value = true
  try {
    const name = newTag.value.name.trim()
    const slug = newTag.value.slug.trim() || name.toLowerCase().replace(/\s+/g, '-')
    if (tags.value.find(t => t.name === name)) {
      error.value = '标签已存在'
      return
    }
    tags.value.push({ name, slug, count: 0 })
    tags.value.sort((a, b) => b.count - a.count)
    newTag.value = { name: '', slug: '' }
    showCreate.value = false
  } catch (e) {
    notifyError('创建', e)
  } finally {
    creating.value = false
  }
}

function removeTag(name) {
  if (!confirm(`确定删除标签"${name}"？`)) return
  tags.value = tags.value.filter(t => t.name !== name)
}

onMounted(load)
</script>
