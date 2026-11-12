const API_BASE = '/api';

function getStoredToken() {
  return localStorage.getItem('udqm_token') || '';
}

async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Always use admin role for single user 'Kids'
  headers['x-user-role'] = 'admin';

  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed with status ${response.status}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  return response;
}

export const api = {
  // Auth & Profile
  login: (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  getMe: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  updateProfile: (profile) => request('/auth/profile', { method: 'PUT', body: JSON.stringify(profile) }),

  // Dashboard
  getDashboard: () => request('/dashboard'),

  // Products
  getProducts: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/products?${query}`);
  },
  getProductCounts: () => request('/products/counts'),
  getProduct: (id) => request(`/products/${id}`),
  createProduct: (data) => request('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id, data) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),
  recordProductFeedback: (query, productId, action = 'selected') => request('/products/feedback', { method: 'POST', body: JSON.stringify({ query, productId, action }) }),

  // WhatsApp Smart Parser & Config
  parseWhatsAppMessage: (message) => request('/whatsapp/parse', { method: 'POST', body: JSON.stringify({ message }) }),
  getWhatsAppConfig: () => request('/whatsapp/config'),
  saveWhatsAppConfig: (config) => request('/whatsapp/config', { method: 'POST', body: JSON.stringify(config) }),

  // Imports
  previewRateSheet: (formData) => request('/imports/preview', { method: 'POST', body: formData }),
  commitImport: (previewId) => request('/imports/commit', { method: 'POST', body: JSON.stringify({ previewId }) }),
  getImportHistory: () => request('/imports/history'),
  seedOfficialRates: () => request('/imports/seed-official', { method: 'POST' }),

  // Quotations
  createQuotation: (data) => request('/quotations', { method: 'POST', body: JSON.stringify(data) }),
  updateQuotation: (id, data) => request(`/quotations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteQuotation: (id) => request(`/quotations/${id}`, { method: 'DELETE' }),
  getQuotations: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/quotations?${query}`);
  },
  getQuotation: (id) => request(`/quotations/${id}`),
  updateQuotationStatus: (id, status) => request(`/quotations/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  duplicateQuotation: (id) => request(`/quotations/${id}/duplicate`, { method: 'POST' }),
  auditShare: (id, channel, recipient) => request(`/quotations/${id}/audit-share`, { method: 'POST', body: JSON.stringify({ channel, recipient }) }),

  // Customers
  getCustomers: (search = '') => request(`/customers?search=${encodeURIComponent(search)}`),
  createCustomer: (data) => request('/customers', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (id, data) => request(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCustomer: (id) => request(`/customers/${id}`, { method: 'DELETE' }),
  getCustomerQuotations: (id) => request(`/customers/${id}/quotations`),

  // Settings, Logo & QR Code
  getSettings: () => request('/settings'),
  updateSettings: (settings) => request('/settings', { method: 'POST', body: JSON.stringify(settings) }),
  uploadLogo: (formData) => request('/settings/logo', { method: 'POST', body: formData }),
  resetLogo: () => request('/settings/logo', { method: 'DELETE' }),
  uploadQrCode: (formData) => request('/settings/qr-code', { method: 'POST', body: formData }),
  resetQrCode: () => request('/settings/qr-code', { method: 'DELETE' }),
  getApiKey: () => request('/settings/api-key'),
  regenerateApiKey: () => request('/settings/api-key/regenerate', { method: 'POST' }),

  // Audit Logs
  getAuditLogs: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/audit?${query}`);
  }
};
