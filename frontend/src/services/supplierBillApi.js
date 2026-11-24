import { request } from './apiClient';

export const supplierBillApi = {
  getSupplierBills: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/supplier-bills?${query}`);
  },
  getDueAlerts: () => request('/supplier-bills/due-alerts'),
  createSupplierBill: (data) => request('/supplier-bills', { method: 'POST', body: JSON.stringify(data) }),
  updateSupplierBill: (id, data) => request(`/supplier-bills/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSupplierBill: (id) => request(`/supplier-bills/${id}`, { method: 'DELETE' }),
  sendSupplierAlert: (id) => request(`/supplier-bills/${id}/send-alert`, { method: 'POST' })
};
