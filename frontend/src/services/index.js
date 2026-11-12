import { request, getUploadUrl, API_BASE, getStoredToken } from './apiClient';
import { authApi } from './authApi';
import { customerApi } from './customerApi';
import { productApi } from './productApi';
import { quotationApi } from './quotationApi';
import { whatsappApi } from './whatsappApi';
import { settingsApi, dashboardApi, importsApi, auditApi } from './settingsApi';

export {
  request,
  getUploadUrl,
  API_BASE,
  getStoredToken,
  authApi,
  customerApi,
  productApi,
  quotationApi,
  whatsappApi,
  settingsApi,
  dashboardApi,
  importsApi,
  auditApi
};

// Unified API client for seamless backward-compatibility
export const api = {
  ...authApi,
  ...dashboardApi,
  ...productApi,
  ...whatsappApi,
  ...importsApi,
  ...quotationApi,
  ...customerApi,
  ...settingsApi,
  ...auditApi
};

export default api;
