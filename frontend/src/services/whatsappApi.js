import { request } from './apiClient';

export const whatsappApi = {
  parseWhatsAppMessage: (message) => request('/whatsapp/parse', { method: 'POST', body: JSON.stringify({ message }) }),
  getWhatsAppConfig: () => request('/whatsapp/config'),
  saveWhatsAppConfig: (config) => request('/whatsapp/config', { method: 'POST', body: JSON.stringify(config) })
};
