const BASE = '/api'

function getToken() {
  return localStorage.getItem('vs_token')
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
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
    err.details = data.details
    throw err
  }

  return data
}

export const api = {
  get:    (path)       => request('GET',    path),
  post:   (path, body) => request('POST',   path, body),
  patch:  (path, body) => request('PATCH',  path, body),
  delete: (path)       => request('DELETE', path),
}

export const auth = {
  signup: (orgName, email, password) => api.post('/auth/signup', { orgName, email, password }),
  login:  (email, password)          => api.post('/auth/login',  { email, password }),
  logout: ()                         => api.post('/auth/logout'),
}

export const integrations = {
  list:        ()                  => api.get('/integrations'),
  get:         (type)              => api.get(`/integrations/${type}`),
  scanGitHub:  (repo, ref='main')  => api.post('/integrations/scan/github', { repo, ref }),
  scanText:    (content, filename) => api.post('/integrations/scan/text', { content, filename }),
  rotate:      (id)                => api.patch(`/integrations/${id}/rotate`),
  openSecrets: ()                  => api.get('/integrations/secrets/open'),
  remediate:   (id)                => api.patch(`/integrations/secrets/${id}/remediate`),
}
