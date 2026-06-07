const BASE = '/api'

async function request(path, options = {}) {
  const token = localStorage.getItem('gion_token')
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(BASE + path, { ...options, headers })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || res.statusText)
  return data
}

export const api = {
  // Auth
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  createApiKey: (body) => request('/auth/apikeys', { method: 'POST', body: JSON.stringify(body) }),
  listApiKeys: () => request('/auth/apikeys'),
  revokeApiKey: (prefix) => request(`/auth/apikeys/${prefix}`, { method: 'DELETE' }),

  // Content
  list: (type, params = {}) => {
    const q = new URLSearchParams(params).toString()
    return request(`/content/${type}${q ? '?' + q : ''}`)
  },
  get: (type, id) => request(`/content/${type}/${id}`),
  create: (type, data, status = 'draft') =>
    request(`/content/${type}`, { method: 'POST', body: JSON.stringify({ data, status }) }),
  update: (type, id, data) =>
    request(`/content/${type}/${id}`, { method: 'PUT', body: JSON.stringify({ data }) }),
  delete: (type, id) =>
    request(`/content/${type}/${id}`, { method: 'DELETE' }),

  // Content Types
  listTypes: () => request('/content-types'),
  getContentTypeSchema: (name) => request(`/content-types/${name}`),

  // Media
  uploadMedia: async (file) => {
    const token = localStorage.getItem('gion_token')
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(BASE + '/media/upload', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || res.statusText)
    return data
  },
  listMedia: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return request(`/media${q ? '?' + q : ''}`)
  },
  getMedia: (id) => request(`/media/${id}`),
  deleteMedia: (id) => request(`/media/${id}`, { method: 'DELETE' }),

  // Health
  health: () => request('/health')
}
