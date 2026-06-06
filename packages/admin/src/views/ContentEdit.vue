<template>
  <div>
    <div class="header">
      <h2>{{ isNew ? '新建' : '编辑' }}{{ typeLabel }}</h2>
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

        <select v-else-if="f.type === 'enum' && f.values"
          v-model="formData[f.name]">
          <option v-for="v in f.values" :key="v" :value="v">{{ v }}</option>
        </select>

        <textarea v-else-if="f.type === 'json'"
          v-model="formData[f.name]"
          rows="12" placeholder="JSON 内容..."></textarea>

        <input v-else v-model="formData[f.name]"
          type="text"
          :placeholder="f.description || f.label" />
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-else-if="loading" class="info">保存中...</p>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api/index.js'

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

onMounted(async () => {
  try {
    // Get content type schema
    const schema = await api.getContentTypeSchema ? null : null

    // Get existing doc if editing
    if (!isNew.value) {
      const doc = await api.get(props.type, props.id)
      if (doc) {
        Object.assign(formData, doc.data)
      }
    }
  } catch (e) {
    // Fallback: add common fields
  }

  // Infer fields from types prop
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
})

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
h2 { font-size: 22px; }
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
.field label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--text); }
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
