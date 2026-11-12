import { request } from './apiClient';

export const customerApi = {
  getCustomers: (search = '') => request(`/customers?search=${encodeURIComponent(search)}`),
  createCustomer: (data) => request('/customers', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (id, data) => request(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCustomer: (id) => request(`/customers/${id}`, { method: 'DELETE' }),
  getCustomerQuotations: (id) => request(`/customers/${id}/quotations`)
};
