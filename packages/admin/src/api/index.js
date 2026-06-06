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

  // Health
  health: () => request('/health')
}
