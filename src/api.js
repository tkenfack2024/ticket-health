// src/api.js
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

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

    adminCreatePermission: (data) => request('/api/admin/permissions', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  adminRevokePermission: (userId, code) => request(`/api/admin/users/${userId}/permissions/${code}`, {
    method: 'DELETE',
  }),

  // --- RÔLES DYNAMIQUES ---
  adminGetRoles: () => request('/api/admin/roles'),
  adminCreateRole: (data) => request('/api/admin/roles', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  adminGetRolePermissions: (id) => request(`/api/admin/roles/${id}/permissions`),
  adminAddRolePermission: (id, code) => request(`/api/admin/roles/${id}/permissions`, {
    method: 'POST',
    body: JSON.stringify({ permission_code: code }),
  }),
  adminRemoveRolePermission: (id, code) => request(`/api/admin/roles/${id}/permissions/${code}`, {
    method: 'DELETE',
  }),

  // GDPR
  gdprGetProcessing: () => request('/api/gdpr/processing'),
  gdprCreateProcessing: (data) => request('/api/gdpr/processing', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  gdprUpdateProcessing: (id, data) => request(`/api/gdpr/processing/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  gdprDeleteProcessing: (id) => request(`/api/gdpr/processing/${id}`, {
    method: 'DELETE',
  }),
  gdprExportUrl: () => {
    const token = localStorage.getItem('ht_token')
    return `http://localhost:3001/api/gdpr/export?token=${token}`
  },

  // Revue des logs
  adminReviewLog: (id) => request(`/api/admin/logs/${id}/review`, { method: 'POST' }),
  adminBulkReviewLogs: (ids) => request('/api/admin/logs/bulk-review', {
    method: 'POST',
    body: JSON.stringify({ log_ids: ids }),
  }),
  adminUnreviewLog: (id) => request(`/api/admin/logs/${id}/unreview`, { method: 'POST' }),
  adminGetReviewStats: () => request('/api/admin/logs/review-stats'),
  // Incidents DORA / BAIT
  getDoraCriteria: () => request('/api/incidents/criteria'),
  getMajorIncidents: () => request('/api/incidents/major'),
  getIncidentStats: () => request('/api/incidents/stats'),
  getIncidentNotification: (id) => request(`/api/incidents/${id}/notification`),

  // CMDB
  cmdbGetCis: (params = {}) => {
    const clean = {}
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') clean[k] = v
    })
    const qs = new URLSearchParams(clean).toString()
    return request(`/api/cmdb/cis${qs ? '?' + qs : ''}`)
  },
  cmdbGetCi: (id) => request(`/api/cmdb/cis/${id}`),
  cmdbCreateCi: (data) => request('/api/cmdb/cis', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  cmdbUpdateCi: (id, data) => request(`/api/cmdb/cis/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  cmdbDeleteCi: (id) => request(`/api/cmdb/cis/${id}`, {
    method: 'DELETE',
  }),

  // Liaison ticket ↔ CI
  getTicketCis: (ticketId) => request(`/api/cmdb/tickets/${ticketId}/cis`),
  linkTicketCi: (ticketId, ciId, isPrimary = false) => request(`/api/cmdb/tickets/${ticketId}/cis`, {
    method: 'POST',
    body: JSON.stringify({ ci_id: ciId, is_primary: isPrimary }),
  }),
  unlinkTicketCi: (ticketId, ciId) => request(`/api/cmdb/tickets/${ticketId}/cis/${ciId}`, {
    method: 'DELETE',
  }),
  setPrimaryCi: (ticketId, ciId) => request(`/api/cmdb/tickets/${ticketId}/cis/${ciId}/primary`, {
    method: 'POST',
  }),

  // Portail Self-Service
  portalGetMyTickets: (params = {}) => {
    const clean = {}
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') clean[k] = v
    })
    const qs = new URLSearchParams(clean).toString()
    return request(`/api/portal/my-tickets${qs ? '?' + qs : ''}`)
  },
  portalGetMyTicket: (id) => request(`/api/portal/my-tickets/${id}`),
  portalAddComment: (ticketId, text) => request(`/api/portal/my-tickets/${ticketId}/comment`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  }),
  portalConfirmResolved: (ticketId) => request(`/api/portal/my-tickets/${ticketId}/confirm-resolved`, {
    method: 'POST',
  }),
  portalGetKb: (params = {}) => {
    const clean = {}
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') clean[k] = v
    })
    const qs = new URLSearchParams(clean).toString()
    return request(`/api/portal/kb${qs ? '?' + qs : ''}`)
  },
  portalGetKbArticle: (id) => request(`/api/portal/kb/${id}`),
  portalVoteKb: (id, helpful) => request(`/api/portal/kb/${id}/vote`, {
    method: 'POST',
    body: JSON.stringify({ helpful }),
  }),

  // Problèmes (ITIL)
  problemsGetAll: (params = {}) => {
    const clean = {}
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') clean[k] = v
    })
    const qs = new URLSearchParams(clean).toString()
    return request(`/api/problems${qs ? '?' + qs : ''}`)
  },
  problemsGet: (id) => request(`/api/problems/${id}`),
  problemsCreate: (data) => request('/api/problems', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  problemsUpdate: (id, data) => request(`/api/problems/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  problemsDelete: (id) => request(`/api/problems/${id}`, {
    method: 'DELETE',
  }),
  problemsLinkTicket: (problemId, ticketId) => request(`/api/problems/${problemId}/link-ticket`, {
    method: 'POST',
    body: JSON.stringify({ ticket_id: ticketId }),
  }),
  problemsUnlinkTicket: (problemId, ticketId) => request(`/api/problems/${problemId}/unlink-ticket/${ticketId}`, {
    method: 'DELETE',
  }),
  problemsCreateKb: (id) => request(`/api/problems/${id}/create-kb`, {
    method: 'POST',
  }),
  problemsGetStats: () => request('/api/problems/stats'),

  getAssetsFull: (params = {}) => {
    const clean = {}
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') clean[k] = v
    })
    const qs = new URLSearchParams(clean).toString()
    return request(`/api/assets/full${qs ? '?' + qs : ''}`)
  },

  // Préférences de notification
  getNotificationPreferences: () => request('/api/notifications/preferences'),
  updateNotificationPreferences: (data) => request('/api/notifications/preferences', {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  // Catalogue de services
  catalogGetServices: () => request('/api/catalog/services'),
  catalogGetService: (id) => request(`/api/catalog/services/${id}`),
  catalogCreateRequest: (data) => request('/api/catalog/requests', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  catalogGetMyRequests: () => request('/api/catalog/my-requests'),
  catalogGetRequest: (id) => request(`/api/catalog/requests/${id}`),
  catalogAdminGetRequests: (params = {}) => {
    const clean = {}
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') clean[k] = v
    })
    const qs = new URLSearchParams(clean).toString()
    return request(`/api/catalog/admin/requests${qs ? '?' + qs : ''}`)
  },
  catalogAdminApprove: (id) => request(`/api/catalog/admin/requests/${id}/approve`, { method: 'POST' }),
  catalogAdminReject: (id, reason) => request(`/api/catalog/admin/requests/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  }),
  catalogAdminGetServices: () => request('/api/catalog/admin/services'),
  catalogAdminCreateService: (data) => request('/api/catalog/admin/services', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  catalogAdminUpdateService: (id, data) => request(`/api/catalog/admin/services/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  catalogAdminDeleteService: (id) => request(`/api/catalog/admin/services/${id}`, {
    method: 'DELETE',
  }),

  // Changements (RFC)
  changesGetAll: (params = {}) => {
    const clean = {}
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') clean[k] = v
    })
    const qs = new URLSearchParams(clean).toString()
    return request(`/api/changes${qs ? '?' + qs : ''}`)
  },
  changesGet: (id) => request(`/api/changes/${id}`),
  changesCreate: (data) => request('/api/changes', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  changesUpdate: (id, data) => request(`/api/changes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  changesSubmit: (id) => request(`/api/changes/${id}/submit`, { method: 'POST' }),
  changesApprove: (id) => request(`/api/changes/${id}/approve`, { method: 'POST' }),
  changesReject: (id, reason) => request(`/api/changes/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  }),
  changesStart: (id) => request(`/api/changes/${id}/start`, { method: 'POST' }),
  changesComplete: (id) => request(`/api/changes/${id}/complete`, { method: 'POST' }),
  changesRollback: (id) => request(`/api/changes/${id}/rollback`, { method: 'POST' }),
  changesClose: (id) => request(`/api/changes/${id}/close`, { method: 'POST' }),
  changesLinkTicket: (id, ticketId) => request(`/api/changes/${id}/link-ticket`, {
    method: 'POST',
    body: JSON.stringify({ ticket_id: ticketId }),
  }),
  changesUnlinkTicket: (id, ticketId) => request(`/api/changes/${id}/unlink-ticket/${ticketId}`, {
    method: 'DELETE',
  }),
  changesDelete: (id) => request(`/api/changes/${id}`, { method: 'DELETE' }),

  changesAnalyzeImpact: (id, ciIds) => request(`/api/changes/${id}/analyze-impact`, {
    method: 'POST',
    body: JSON.stringify({ ci_ids: ciIds }),
  }),

  // Fournisseurs (ISO 20000)
  suppliersGetAll: (params = {}) => {
    const clean = {}
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') clean[k] = v
    })
    const qs = new URLSearchParams(clean).toString()
    return request(`/api/suppliers${qs ? '?' + qs : ''}`)
  },
  suppliersCreate: (data) => request('/api/suppliers', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  suppliersUpdate: (id, data) => request(`/api/suppliers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  suppliersDelete: (id) => request(`/api/suppliers/${id}`, {
    method: 'DELETE',
  }),

  // Fichiers fournisseurs
  suppliersGetFiles: (supplierId) => request(`/api/suppliers/${supplierId}/files`),
  suppliersUploadFile: async (supplierId, file) => {
    const token = localStorage.getItem('ht_token')
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch(`${API_URL}/api/suppliers/${supplierId}/files`, {
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
  suppliersDeleteFile: (fileId) => request(`/api/suppliers/files/${fileId}`, { method: 'DELETE' }),
  suppliersDownloadFileUrl: (fileId) => {
    const token = localStorage.getItem('ht_token')
    return `${API_URL}/api/suppliers/files/${fileId}/download?token=${token}`
  },

  // Risques (ISO 27001)
  risksGetAll: (params = {}) => {
    const clean = {}
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') clean[k] = v
    })
    const qs = new URLSearchParams(clean).toString()
    return request(`/api/risks${qs ? '?' + qs : ''}`)
  },
  risksCreate: (data) => request('/api/risks', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  risksUpdate: (id, data) => request(`/api/risks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  risksDelete: (id) => request(`/api/risks/${id}`, { method: 'DELETE' }),

  // Facility (Bâtiments & Salles)
  facilityGetTree: () => request('/api/facility/tree'),
  facilityCreateSite: (data) => request('/api/facility/sites', { method: 'POST', body: JSON.stringify(data) }),
  facilityCreateFloor: (data) => request('/api/facility/floors', { method: 'POST', body: JSON.stringify(data) }),
  facilityCreateRoom: (data) => request('/api/facility/rooms', { method: 'POST', body: JSON.stringify(data) }),

  // Ressources Physiques (Lits / Tables)
  resourcesGetAll: (params = {}) => {
    const clean = {}
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') clean[k] = v
    })
    const qs = new URLSearchParams(clean).toString()
    return request(`/api/resources${qs ? '?' + qs : ''}`)
  },
  resourcesCreate: (data) => request('/api/resources', { method: 'POST', body: JSON.stringify(data) }),
  resourcesUpdate: (id, data) => request(`/api/resources/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  resourcesDelete: (id) => request(`/api/resources/${id}`, { method: 'DELETE' }),

  // Réservations (Desksharing)
  resourcesGetBookings: (params = {}) => {
    const clean = {}
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') clean[k] = v
    })
    const qs = new URLSearchParams(clean).toString()
    return request(`/api/resources/bookings${qs ? '?' + qs : ''}`)
  },
  resourcesBook: (id, data) => request(`/api/resources/${id}/book`, { method: 'POST', body: JSON.stringify(data) }),
  resourcesCancelBooking: (bookingId) => request(`/api/resources/bookings/${bookingId}`, { method: 'DELETE' }),


  // Patients (DPI)
  patientsGetAll: (params = {}) => {
    const clean = {}
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') clean[k] = v
    })
    const qs = new URLSearchParams(clean).toString()
    return request(`/api/patients${qs ? '?' + qs : ''}`)
  },
  patientsCreate: (data) => request('/api/patients', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

    patientsUpdate: (id, data) => request(`/api/patients/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

    patientsDelete: (id) => request(`/api/patients/${id}`, { method: 'DELETE' }),

  // Visites (Triage)
  visitsGetAll: (params = {}) => {
    const clean = {}
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') clean[k] = v
    })
    const qs = new URLSearchParams(clean).toString()
    return request(`/api/patients/visits${qs ? '?' + qs : ''}`)
  },
  visitsCreate: (patientId, data) => request(`/api/patients/${patientId}/visit`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  visitsStart: (visitId) => request(`/api/patients/visits/${visitId}/start`, {
    method: 'POST',
  }),

  // Ordonnances & Examens
  prescriptionsGet: (recordId) => request(`/api/patients/records/${recordId}/prescriptions`),
  prescriptionsCreate: (recordId, data) => request(`/api/patients/records/${recordId}/prescriptions`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  examsGet: (patientId) => request(`/api/patients/${patientId}/exams`),
  examsCreate: (recordId, data) => request(`/api/patients/records/${recordId}/exams`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
    examsUpdate: async (examId, data, file) => {
    const token = localStorage.getItem('ht_token')
    const formData = new FormData()
    if (data.status) formData.append('status', data.status)
    if (data.result_notes) formData.append('result_notes', data.result_notes)
    if (file) formData.append('file', file)

    const res = await fetch(`${API_URL}/api/patients/exams/${examId}`, {
      method: 'PATCH',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })
    if (!res.ok) throw new Error('Erreur lors de l\'upload')
    return res.json()
  },

	  examsDownloadUrl: (examId) => {
    const token = localStorage.getItem('ht_token')
    return `${API_URL}/api/patients/exams/${examId}/download?token=${token}`
  },

  // Dossier Médical
  recordsGetAll: (patientId) => request(`/api/patients/${patientId}/records`),
  recordsCreate: (patientId, data) => request(`/api/patients/${patientId}/records`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // Suivi
  prescriptionsGetPending: () => request('/api/patients/prescriptions/pending'),
  prescriptionsFinish: (id) => request(`/api/patients/prescriptions/${id}/finish`, { method: 'PATCH' }),
  examsGetPending: () => request('/api/patients/exams/pending'),

  // Statistiques de capacité
  getCapacityStats: () => request('/api/stats/capacity')

}