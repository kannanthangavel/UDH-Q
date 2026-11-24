import {
  request,
  getUploadUrl,
  getApiOrigin,
  setCustomApiBaseUrl,
  getApiBase,
  getApiUrl,
  getAbsoluteApiUrl,
  getQuickDownloadUrl,
  checkBackendHealth,
  API_BASE,
  getStoredToken
} from './apiClient';
import { authApi } from './authApi';
import { customerApi } from './customerApi';
import { productApi } from './productApi';
import { quotationApi } from './quotationApi';
import { whatsappApi } from './whatsappApi';
import { receiptApi } from './receiptApi';
import { supplierBillApi } from './supplierBillApi';
import { settingsApi, dashboardApi, importsApi, auditApi } from './settingsApi';

export {
  request,
  getUploadUrl,
  getApiOrigin,
  setCustomApiBaseUrl,
  getApiBase,
  getApiUrl,
  getAbsoluteApiUrl,
  getQuickDownloadUrl,
  checkBackendHealth,
  API_BASE,
  getStoredToken,
  authApi,
  customerApi,
  productApi,
  quotationApi,
  whatsappApi,
  receiptApi,
  supplierBillApi,
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
  ...receiptApi,
  ...supplierBillApi,
  ...customerApi,
  ...settingsApi,
  ...auditApi
};

export default api;
