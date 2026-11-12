/**
 * Unified API Client for Udhayam Quotation Maker
 */

const BASE_URL = '/api';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = options.headers || {};

  // If not FormData, default to application/json
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  const contentType = response.headers.get('content-type');
  let data;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = (data && data.error) ? data.error : (typeof data === 'string' ? data : response.statusText);
    throw new Error(errorMsg || `Request failed with status ${response.status}`);
  }

  return data;
}

export const api = {
  // Dashboard
  getDashboardMetrics: () => request('/dashboard/metrics'),

  // Price Lists & Products
  uploadExcel: (formData) => request('/pricelists/upload', { method: 'POST', body: formData }),
  previewSheet: (payload) => request('/pricelists/preview', { method: 'POST', body: JSON.stringify(payload) }),
  confirmImport: (payload) => request('/pricelists/confirm-import', { method: 'POST', body: JSON.stringify(payload) }),
  getPriceLists: () => request('/pricelists'),
  getActivePriceList: () => request('/pricelists/active'),
  activatePriceList: (id) => request(`/pricelists/${id}/activate`, { method: 'POST' }),
  deletePriceList: (id) => request(`/pricelists/${id}`, { method: 'DELETE' }),
  clearAllPriceLists: () => request('/pricelists/clear-all', { method: 'POST' }),
  getProducts: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/pricelists/products?${query}`);
  },
  overrideProductPrice: (id, payload) => request(`/pricelists/products/${id}/override-price`, { method: 'POST', body: JSON.stringify(payload) }),

  // Message Parsing
  parseMessage: (messageOrPayload, priceListId) => {
    const body = typeof messageOrPayload === 'string' ? { message: messageOrPayload, priceListId } : messageOrPayload;
    return request('/parse-message', { method: 'POST', body: JSON.stringify(body) });
  },
  parseWhatsAppMessage: (messageOrPayload, priceListId) => {
    const body = typeof messageOrPayload === 'string' ? { message: messageOrPayload, priceListId } : messageOrPayload;
    return request('/parse-message', { method: 'POST', body: JSON.stringify(body) });
  },

  // Quotations & Queue
  getQuotations: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/quotations?${query}`);
  },
  getQuotationQueue: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/quotations/queue?${query}`);
  },
  getQuotation: (id) => request(`/quotations/${id}`),
  createQuotation: (payload) => request('/quotations', { method: 'POST', body: JSON.stringify(payload) }),
  updateQuotation: (id, payload) => request(`/quotations/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  finalizeQuotation: (id) => request(`/quotations/${id}/finalize`, { method: 'POST' }),
  approveQuotation: (id, payload = {}) => request(`/quotations/${id}/approve`, { method: 'POST', body: JSON.stringify(payload) }),
  duplicateQuotation: (id) => request(`/quotations/${id}/duplicate`, { method: 'POST' }),
  generatePdf: (id) => request(`/quotations/${id}/pdf`, { method: 'POST' }),
  getPdfUrl: (id, download = false) => `/api/quotations/${id}/pdf?download=${download}`,
  uploadCustomLogo: (id, formData) => request(`/quotations/${id}/custom-logo`, { method: 'POST', body: formData }),
  uploadQuotationCustomLogo: (id, file) => {
    const fd = new FormData();
    fd.append('logo', file);
    return request(`/quotations/${id}/custom-logo`, { method: 'POST', body: fd });
  },
  setLogoSource: (id, logoSource) => request(`/quotations/${id}/logo-source`, { method: 'PUT', body: JSON.stringify({ logoSource }) }),
  updateQuotationLogoSource: (id, logoSource) => request(`/quotations/${id}/logo-source`, { method: 'PUT', body: JSON.stringify({ logoSource }) }),
  shareWhatsApp: (id) => request(`/quotations/${id}/whatsapp-share`, { method: 'POST' }),
  getWhatsAppShare: (id) => request(`/quotations/${id}/whatsapp-share`, { method: 'POST' }),
  sendQuotationWhatsApp: (id, payload = {}) => request(`/quotations/${id}/send-whatsapp`, { method: 'POST', body: JSON.stringify(payload) }),
  shareEmail: (id, payload = {}) => request(`/quotations/${id}/email-share`, { method: 'POST', body: JSON.stringify(payload) }),
  updateWhatsAppStatus: (id, status) => request(`/quotations/${id}/whatsapp-status`, { method: 'POST', body: JSON.stringify({ status }) }),

  // WhatsApp Business Integration & Inbox
  getWhatsAppInbox: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/whatsapp/inbox?${query}`);
  },
  getWhatsAppConversation: (phone) => request(`/whatsapp/conversations/${encodeURIComponent(phone)}`),
  simulateWhatsAppMessage: (payload) => request('/whatsapp/simulate-incoming', { method: 'POST', body: JSON.stringify(payload) }),
  getWhatsAppStatus: () => request('/whatsapp/status'),

  // Real-Time Notifications
  getNotifications: () => request('/notifications'),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => request('/notifications/mark-all-read', { method: 'POST' }),
  getNotificationStreamUrl: () => '/api/notifications/stream',

  // Audit Logs
  getAuditLogs: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/audit?${query}`);
  },

  // Settings & Company Logo
  getSettings: () => request('/settings'),
  updateSettings: (payload) => request('/settings', { method: 'PUT', body: JSON.stringify(payload) }),
  uploadCompanyLogo: (formData) => request('/settings/company-logo', { method: 'POST', body: formData }),
  removeCompanyLogo: () => request('/settings/company-logo', { method: 'DELETE' }),
  deleteCompanyLogo: () => request('/settings/company-logo', { method: 'DELETE' }),
  getCompanyLogoUrl: (filename) => filename ? `/api/settings/logo/${filename}` : null,

  // Demo
  resetDemoData: (payload = {}) => request('/demo/reset', { method: 'POST', body: JSON.stringify(payload) }),
  getSampleExcelUrl: () => '/api/demo/sample-excel'
};
