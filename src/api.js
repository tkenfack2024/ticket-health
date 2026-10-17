// src/api.js
const API_URL = 'http://localhost:3001'

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('ht_token')

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Erreur serveur' }))
    throw new Error(error.error || `Erreur HTTP ${res.status}`)
  }

  return res.json()
}

export const api = {
  // Test
  health: () => request('/'),

  // Méthodes génériques (utiles pour les modules avancés)
  get: (endpoint) => request(endpoint),
  post: (endpoint, data) => request(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  put: (endpoint, data) => request(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  patch: (endpoint, data) => request(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  delete: (endpoint) => request(endpoint, { method: 'DELETE' }),

  // ============ AUTH ============
  register: (data) => request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  login: (data) => request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  requestOtp: (email) => request('/api/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }),
  verifyOtp: (email, code) => request('/api/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  }),
  me: () => request('/api/auth/me'),

  // ============ TICKETS ============
  getTickets: () => request('/api/tickets'),
  getTicket: (id) => request(`/api/tickets/${id}`),
  createTicket: (data) => request('/api/tickets', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateTicket: (id, data) => request(`/api/tickets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  archiveTicket: (id) => request(`/api/tickets/${id}/archive`, {
    method: 'POST',
  }),

  // ============ COMMENTAIRES ============
  getComments: (ticketId) => request(`/api/tickets/${ticketId}/comments`),
  addComment: (ticketId, data) => request(`/api/tickets/${ticketId}/comments`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // ============ ADMIN ============
  adminGetUsers: () => request('/api/admin/users'),
  adminCreateUser: (data) => request('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  adminUpdateUser: (id, data) => request(`/api/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  adminResetPassword: (id, newPassword) => request(`/api/admin/users/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ newPassword }),
  }),
  adminDeactivateUser: (id) => request(`/api/admin/users/${id}`, {
    method: 'DELETE',
  }),

  // Modules
  adminGetModules: () => request('/api/admin/modules'),
  adminCreateModule: (data) => request('/api/admin/modules', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  adminUpdateModule: (id, data) => request(`/api/admin/modules/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  adminDeleteModule: (id) => request(`/api/admin/modules/${id}`, {
    method: 'DELETE',
  }),

  // Assets
adminGetAssets: (params = {}) => {
  const clean = {}
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      clean[k] = v
    }
  })
  const qs = new URLSearchParams(clean).toString()
  return request(`/api/admin/assets${qs ? '?' + qs : ''}`)
},
  adminGetAsset: (id) => request(`/api/admin/assets/${id}`),
  adminCreateAsset: (data) => request('/api/admin/assets', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  adminUpdateAsset: (id, data) => request(`/api/admin/assets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  adminDeleteAsset: (id) => request(`/api/admin/assets/${id}`, {
    method: 'DELETE',
  }),
  // Logs
  adminGetLogs: (params = {}) => {
    const clean = {}
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') clean[k] = v
    })
    const qs = new URLSearchParams(clean).toString()
    return request(`/api/admin/logs${qs ? '?' + qs : ''}`)
  },

  // Archive
  adminGetArchivedTickets: () => request('/api/admin/tickets/archived'),
  adminRestoreTicket: (id) => request(`/api/admin/tickets/${id}/restore`, { method: 'POST' }),
  adminDeleteTicket: (id) => request(`/api/admin/tickets/${id}`, { method: 'DELETE' }),

  // Fichiers des assets
  getAssetFiles: (assetId) => request(`/api/admin/assets/${assetId}/files`),

  uploadAssetFile: async (assetId, file) => {
    const token = localStorage.getItem('ht_token')
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch(`${API_URL}/api/admin/assets/${assetId}/files`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Erreur upload' }))
      throw new Error(error.error || `Erreur HTTP ${res.status}`)
    }
    return res.json()
  },

  deleteAssetFile: (fileId) => request(`/api/admin/assets/files/${fileId}`, {
    method: 'DELETE',
  }),

  downloadAssetFileUrl: (fileId) => {
    const token = localStorage.getItem('ht_token')
    return `${API_URL}/api/admin/assets/files/${fileId}/download?token=${token}`
  },

  // Import CSV
  importAssetsCSV: async (file) => {
    const token = localStorage.getItem('ht_token')
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch(`${API_URL}/api/admin/assets/import-csv`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Erreur import' }))
      throw new Error(error.error || `Erreur HTTP ${res.status}`)
    }
    return res.json()
  },

  // Assets (accès public pour les tickets)
  getAssets: (params = {}) => {
    const clean = {}
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') clean[k] = v
    })
    const qs = new URLSearchParams(clean).toString()
    return request(`/api/assets${qs ? '?' + qs : ''}`)
  },
  getAssetPublic: (id) => request(`/api/assets/${id}`),


  // Export CSV logs
  adminExportLogsCSV: (params = {}) => {
    const clean = {}
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') clean[k] = v
    })
    const qs = new URLSearchParams(clean).toString()
    const token = localStorage.getItem('ht_token')
    return `${API_URL}/api/admin/logs/export${qs ? '?' + qs : ''}`
  },

  // Permissions
  adminGetPermissions: () => request('/api/admin/permissions'),
  adminGetUsersPermissions: () => request('/api/admin/users-permissions'),
  adminGrantPermission: (userId, code) => request(`/api/admin/users/${userId}/permissions`, {
    method: 'POST',
    body: JSON.stringify({ permission_code: code }),
  }),
  adminRevokePermission: (userId, code) => request(`/api/admin/users/${userId}/permissions/${code}`, {
    method: 'DELETE',
  }),


}