import { auth } from './firebase.js'

const BASE = '/api'

async function getToken() {
  const user = auth.currentUser
  if (!user) return null
  return user.getIdToken()
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' }
  const token = await getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`)
    err.status = res.status
    throw err
  }

  return data
}

export const api = {
  get:   (path)       => request('GET',   path),
  post:  (path, body) => request('POST',  path, body),
  patch: (path, body) => request('PATCH', path, body),
}

export const integrations = {
  list:        ()                 => api.get('/integrations'),
  scanGitHub:  (repo, ref='main') => api.post('/integrations/scan/github', { repo, ref }),
  scanText:    (content, fname)   => api.post('/integrations/scan/text', { content, filename: fname }),
  rotate:      (id)               => api.patch(`/integrations/${id}/rotate`),
  openSecrets: ()                 => api.get('/integrations/secrets/open'),
  remediate:   (id)               => api.patch(`/integrations/secrets/${id}/remediate`),
}
