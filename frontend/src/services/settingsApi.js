import { request } from './apiClient';

export const settingsApi = {
  getSettings: () => request('/settings'),
  updateSettings: (settings) => request('/settings', { method: 'POST', body: JSON.stringify(settings) }),
  uploadLogo: (formData) => request('/settings/logo', { method: 'POST', body: formData }),
  resetLogo: () => request('/settings/logo', { method: 'DELETE' }),
  uploadQrCode: (formData) => request('/settings/qr-code', { method: 'POST', body: formData }),
  resetQrCode: () => request('/settings/qr-code', { method: 'DELETE' }),
  getApiKey: () => request('/settings/api-key'),
  regenerateApiKey: () => request('/settings/api-key/regenerate', { method: 'POST' })
};

export const dashboardApi = {
  getDashboard: () => request('/dashboard')
};

export const importsApi = {
  previewRateSheet: (formData) => request('/imports/preview', { method: 'POST', body: formData }),
  commitImport: (previewId) => request('/imports/commit', { method: 'POST', body: JSON.stringify({ previewId }) }),
  getImportHistory: () => request('/imports/history'),
  seedOfficialRates: () => request('/imports/seed-official', { method: 'POST' })
};

export const auditApi = {
  getAuditLogs: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/audit?${query}`);
  }
};
