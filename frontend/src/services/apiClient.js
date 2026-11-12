/**
 * UD-QM Centralized API Client
 * Supports VITE_API_BASE_URL (Render backend) and relative /api proxy
 */

const rawApiOrigin = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '';
export const API_BASE = rawApiOrigin ? `${rawApiOrigin.replace(/\/$/, '')}/api` : '/api';

export function getUploadUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const baseUrl = rawApiOrigin ? rawApiOrigin.replace(/\/$/, '') : '';
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${baseUrl}${cleanPath}`;
}

export function getStoredToken() {
  return localStorage.getItem('udqm_token') || '';
}

export async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Single user profile identifier
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
