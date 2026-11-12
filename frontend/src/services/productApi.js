import { request } from './apiClient';

export const productApi = {
  getProducts: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/products?${query}`);
  },
  getProductCounts: () => request('/products/counts'),
  getProduct: (id) => request(`/products/${id}`),
  createProduct: (data) => request('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id, data) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),
  recordProductFeedback: (query, productId, action = 'selected') => 
    request('/products/feedback', { method: 'POST', body: JSON.stringify({ query, productId, action }) })
};
