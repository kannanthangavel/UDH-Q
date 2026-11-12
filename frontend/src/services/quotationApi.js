import { request } from './apiClient';

export const quotationApi = {
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
  auditShare: (id, channel, recipient) => request(`/quotations/${id}/audit-share`, { method: 'POST', body: JSON.stringify({ channel, recipient }) })
};
