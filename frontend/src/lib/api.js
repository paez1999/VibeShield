import { auth } from './firebase.js'

const BASE = '/api'

async function getToken() {
  return auth.currentUser?.getIdToken() || null
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' }
  const token = await getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) { const err = new Error(data.error || `HTTP ${res.status}`); err.status = res.status; throw err }
  return data
}

export const api = {
  get:   (path)       => request('GET',   path),
  post:  (path, body) => request('POST',  path, body),
  patch: (path, body) => request('PATCH', path, body),
}

export const vulnsApi = {
  list:      ()            => api.get('/vulns'),
  resolve:   (id)          => api.patch(`/vulns/${id}/resolve`),
  ignore:    (id)          => api.patch(`/vulns/${id}/ignore`),
  bulk:      (ids, action) => api.post('/vulns/bulk', { ids, action }),
}

export const scansApi = {
  scanCode: (repo, ref) => api.post('/scan/code', { repo, ref }),
  scanApi:  (url)       => api.post('/scan/api',  { url }),
  scanDeps: (repo)      => api.post('/scan/deps', { repo }),
  scanText: (content, filename) => api.post('/scan/text', { content, filename }),
  history:  ()          => api.get('/scan/history'),
}

export const endpointsApi = {
  list: () => api.get('/endpoints'),
}

export const webhooksApi = {
  list:   ()       => api.get('/webhooks'),
  create: (repo)   => api.post('/webhooks', { repo }),
  remove: (id)     => request('DELETE', `/webhooks/${id}`),
}
