import { request, getAbsoluteApiUrl } from './apiClient';

export const receiptApi = {
  getReceipts: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/receipts?${query}`);
  },
  getReceipt: (id) => request(`/receipts/${id}`),
  createReceipt: (data) => request('/receipts', { method: 'POST', body: JSON.stringify(data) }),
  deleteReceipt: (id) => request(`/receipts/${id}`, { method: 'DELETE' }),
  getReceiptPdfUrl: (id, format = 'A4') => getAbsoluteApiUrl(`/receipts/${id}/pdf?format=${format}`)
};
