<template>
  <div>
    <div class="header">
      <div class="header-left">
        <h2>{{ isNew ? '新建' : '编辑' }}{{ typeLabel }}</h2>
        <span v-if="autoSaveStatus" class="autosave-indicator" :class="{ saving: autoSaveStatus === 'saving' }">
          {{ autoSaveStatus === 'saving' ? '保存中...' : `已自动保存 ${autoSaveTime}` }}
        </span>
      </div>
      <div class="actions">
        <button class="btn" @click="save('draft')">保存草稿</button>
        <button class="btn btn-publish" @click="save('published')">发布</button>
      </div>
    </div>

    <div class="form" v-if="fields.length">
      <div class="field" v-for="f in fields" :key="f.name">
        <label>{{ f.label }} <span v-if="f.required" class="req">*</span></label>

        <input v-if="f.type === 'string' || f.type === 'number'"
          v-model="formData[f.name]"
          :type="f.type === 'number' ? 'number' : 'text'"
          :placeholder="f.description || f.label" />

        <input v-else-if="f.type === 'date'"
          v-model="formData[f.name]"
          type="date" />

        <label v-else-if="f.type === 'boolean'" class="checkbox-field">
          <input type="checkbox" v-model="formData[f.name]" /> {{ f.label }}
        </label>

        <select v-else-if="f.type === 'reference' && f.refType" v-model="formData[f.name]">
          <option value="">— 选择 —</option>
        </select>

        <select v-else-if="f.type === 'enum' && f.values"
          v-model="formData[f.name]">
          <option v-for="v in f.values" :key="v" :value="v">{{ v }}</option>
        </select>

        <textarea v-else-if="f.type === 'json' && f.name !== 'body'"
          v-model="formData[f.name]"
          rows="12" placeholder="JSON 内容..."></textarea>

        <RichEditor v-else-if="f.type === 'json' && f.name === 'body'"
          v-model="formData[f.name]"
          :placeholder="'输入正文...'" />

        <input v-else v-model="formData[f.name]"
          type="text"
          :placeholder="f.description || f.label" />
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-else-if="loading" class="info">保存中...</p>

    <RelationshipsManager v-if="!isNew && route.params.id" :doc-id="route.params.id" :doc-type="props.type" />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api/index.js'
import RichEditor from '../components/RichEditor.vue'
import RelationshipsManager from '../components/RelationshipsManager.vue'

const props = defineProps({ type: String, id: String, types: Array })
const route = useRoute()
const router = useRouter()

const isNew = computed(() => !route.params.id || route.params.id === 'new')
const typeLabel = computed(() => {
  const t = (props.types || []).find(t => t.name === props.type)
  return t ? t.label : props.type
})

const fields = ref([])
const formData = reactive({})
const loading = ref(false)
const error = ref('')

// ── Auto-Save ──────────────────────────────────────
const draftKey = computed(() =>
  isNew.value
    ? `taichu-draft-${props.type}`
    : `taichu-draft-${props.type}-${props.id}`
)
const autoSaveStatus = ref('')   // '' | 'saving' | 'saved'
const autoSaveTime = ref('')
const draftRestored = ref(false)
let saveTimer = null

function persistDraft() {
  const data = JSON.parse(JSON.stringify(formData))
  // Only save if there's actual content
  const hasContent = Object.values(data).some(v => v !== '' && v !== null && v !== undefined)
  if (!hasContent) return
  try {
    localStorage.setItem(draftKey.value, JSON.stringify({ time: Date.now(), data }))
  } catch (e) {
    // localStorage full or unavailable — silently skip
  }
}

function debouncedSave() {
  autoSaveStatus.value = 'saving'
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    persistDraft()
    autoSaveStatus.value = 'saved'
    autoSaveTime.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    setTimeout(() => { if (autoSaveStatus.value === 'saved') autoSaveStatus.value = '' }, 3000)
  }, 2000)
}

function clearDraft() {
  clearTimeout(saveTimer)
  try { localStorage.removeItem(draftKey.value) } catch {}
  autoSaveStatus.value = ''
}

function restoreDraft() {
  try {
    const raw = localStorage.getItem(draftKey.value)
    if (!raw) return false
    const saved = JSON.parse(raw)
    if (saved?.data && typeof saved.data === 'object') {
      // Only restore fields that exist in current schema
      for (const key of Object.keys(saved.data)) {
        if (key in formData || fields.value.some(f => f.name === key)) {
          formData[key] = saved.data[key]
        }
      }
      draftRestored.value = true
      return true
    }
  } catch {}
  return false
}

// Watch all formData changes for auto-save
watch(() => ({ ...formData }), () => {
  if (!draftRestored.value && Object.keys(formData).length > 0) {
    draftRestored.value = true
  }
  if (draftRestored.value) {
    debouncedSave()
  }
}, { deep: true })

// Warn on unsaved changes before leaving
function beforeUnload(e) {
  const hasContent = Object.values(formData).some(v => v !== '' && v !== null && v !== undefined)
  if (hasContent && !loading.value) {
    e.preventDefault()
  }
}

onBeforeUnmount(() => {
  clearTimeout(saveTimer)
  window.removeEventListener('beforeunload', beforeUnload)
})

onMounted(async () => {
  window.addEventListener('beforeunload', beforeUnload)

  let schemaLoaded = false
  try {
    // Get content type schema from API (returns JSON Schema: { properties: { title: {...} } })
    const schema = await api.getContentTypeSchema(props.type)
    const schemaFields = schema?.properties || schema?.fields
    if (schemaFields) {
      fields.value = Object.entries(schemaFields).map(([name, def]) => ({
        name,
        label: def.label || def.title || name,
        type: def.type || 'string',
        required: def.required || false,
        maxLength: def.maxLength
      }))
      schemaLoaded = true
    }
  } catch (e) {
    // Schema API unavailable — fall back to props-based inference
  }

  if (!schemaLoaded) {
    // Infer fields from types prop as fallback
    const ct = (props.types || []).find(t => t.name === props.type)
    if (ct) {
      fields.value = ct.fields || Object.keys(ct).filter(k => !['name', 'label', 'description', 'schemaOrg'].includes(k))
    } else {
      fields.value = [
        { name: 'title', label: '标题', type: 'string', required: true },
        { name: 'slug', label: 'Slug', type: 'string', required: true },
        { name: 'body', label: '正文', type: 'json', required: true }
      ]
    }
  }

  // Get existing doc if editing
  if (!isNew.value) {
    try {
      const doc = await api.get(props.type, props.id)
      if (doc) {
        Object.assign(formData, doc.data)
        // After loading server data, check for newer local draft
        restoreDraft()
      }
    } catch (e) {
      error.value = 'Failed to load document'
    }
  } else {
    // New doc: restore draft if exists
    if (restoreDraft()) {
      autoSaveStatus.value = 'saved'
      autoSaveTime.value = '已恢复'
      setTimeout(() => { autoSaveStatus.value = '' }, 3000)
    }
  }
})

// Auto-generate slug from title (only for new documents)
let slugAutoGenerated = false
watch(() => formData.title, (title) => {
  if (!isNew.value || slugAutoGenerated || !title) return
  const hasSlugField = fields.value.some(f => f.name === 'slug')
  if (hasSlugField && (!formData.slug || formData.slug === slugify(formData.title))) {
    formData.slug = slugify(title)
  }
})

watch(() => formData.slug, () => {
  slugAutoGenerated = true
})

function slugify(str) {
  return String(str)
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80)
}

async function save(status) {
  error.value = ''
  loading.value = true
  try {
    const data = { ...formData }

    // Parse JSON fields
    for (const f of fields.value) {
      if (f.type === 'json' && typeof data[f.name] === 'string') {
        try { data[f.name] = JSON.parse(data[f.name]) } catch {}
      }
    }

    if (isNew.value) {
      await api.create(props.type, data, status)
    } else {
      await api.update(props.type, props.id, data)
    }

    clearDraft()
    router.push(`/content/${props.type}`)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.header-left { display: flex; align-items: center; gap: 12px; }
h2 { font-size: 22px; }
.autosave-indicator {
  font-size: 12px; color: var(--text-muted);
  padding: 2px 8px; background: var(--tag-bg); border-radius: 4px;
  transition: opacity 0.3s;
}
.autosave-indicator.saving { color: var(--primary); }
.actions { display: flex; gap: 8px; }
.btn {
  padding: 8px 20px; background: var(--bg); border: 1px solid var(--border);
  border-radius: var(--radius); font-size: 14px; cursor: pointer;
}
.btn:hover { border-color: var(--primary); }
.btn-publish { background: var(--primary); color: white; border-color: var(--primary); }
.btn-publish:hover { background: var(--primary-dark); }
.form { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; }
.field { margin-bottom: 16px; }
.field label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--text-primary); }
.req { color: var(--danger); }
input, select, textarea {
  width: 100%; padding: 8px 12px; border: 1px solid var(--border);
  border-radius: var(--radius); font-size: 14px; outline: none; font-family: inherit;
}
input:focus, select:focus, textarea:focus { border-color: var(--primary); }
textarea { resize: vertical; min-height: 100px; font-family: 'Courier New', monospace; font-size: 13px; }
.error { color: var(--danger); font-size: 14px; margin-top: 12px; }
.info { color: var(--text-secondary); font-size: 14px; margin-top: 12px; }
</style>
