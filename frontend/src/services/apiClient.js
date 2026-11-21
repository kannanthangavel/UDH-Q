/**
 * UD-QM Centralized API Client
 * Supports:
 * 1. Runtime override via localStorage ('udqm_api_base_url') for instant cloud linking
 * 2. Build-time VITE_API_BASE_URL or VITE_API_URL (Render backend URL on Vercel)
 * 3. Relative '/api' proxy in local development or full-stack same-origin deployments
 */

const CUSTOM_API_STORAGE_KEY = 'udqm_api_base_url';

// Clear any stale direct onrender.com override from localStorage so browsers always use
// the reliable same-origin /api proxy (Vercel rewrite -> Render, or Vite proxy -> localhost:5000).
try {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(CUSTOM_API_STORAGE_KEY);
    if (saved && saved.includes('onrender.com')) {
      localStorage.removeItem(CUSTOM_API_STORAGE_KEY);
    }
  }
} catch (e) {}

export function getApiOrigin() {
  try {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(CUSTOM_API_STORAGE_KEY) : '';
    if (stored && stored.trim()) {
      return stored.trim().replace(/\/+$/, '');
    }
  } catch (e) {}

  const envUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '';
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // Always prefer same-origin ('') so:
  // - Locally: Vite proxies /api and /uploads to http://localhost:5000
  // - On Vercel (udh-q.vercel.app): Vercel rewrites /api and /uploads server-side to Render,
  //   avoiding CORS issues and Indian ISP blocks on *.onrender.com domains!
  return '';
}

export function setCustomApiBaseUrl(url) {
  try {
    if (!url || !url.trim()) {
      localStorage.removeItem(CUSTOM_API_STORAGE_KEY);
    } else {
      let clean = url.trim().replace(/\/+$/, '');
      if (clean.endsWith('/api')) {
        clean = clean.slice(0, -4);
      }
      localStorage.setItem(CUSTOM_API_STORAGE_KEY, clean);
    }
  } catch (e) {}
}

export function getApiBase() {
  const origin = getApiOrigin();
  return origin ? `${origin}/api` : '/api';
}

// Keep static export for legacy imports; prefer getApiBase() / getApiUrl() for dynamic calls
export const API_BASE = getApiBase();

export function getApiUrl(endpoint = '') {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const base = getApiBase();
  return `${base}${cleanEndpoint}`;
}

export function getAbsoluteApiUrl(endpoint = '') {
  const origin = getApiOrigin() || (typeof window !== 'undefined' ? window.location.origin : '');
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${origin.replace(/\/+$/, '')}/api${cleanEndpoint}`;
}

export function getUploadUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }
  const baseUrl = getApiOrigin();
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${baseUrl}${cleanPath}`;
}

export function getStoredToken() {
  try {
    return localStorage.getItem('udqm_token') || '';
  } catch (e) {
    return '';
  }
}

export async function checkBackendHealth(customOrigin = null) {
  const base = customOrigin
    ? `${customOrigin.trim().replace(/\/+$/, '').replace(/\/api$/, '')}/api`
    : getApiBase();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35000);

  try {
    const res = await fetch(`${base}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timer);

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        ok: false,
        reason: 'HTML_RESPONSE',
        message: 'Backend API is not connected to this deployment (received HTML page instead of JSON API).'
      };
    }

    const data = await res.json();
    if (res.ok && data?.status === 'ok') {
      return { ok: true, data };
    }
    return {
      ok: false,
      reason: 'UNHEALTHY',
      message: data?.error || `Backend returned status ${res.status}`
    };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return {
        ok: false,
        reason: 'TIMEOUT',
        message: 'Backend server timed out (if hosted on Render free tier, it may take ~30 seconds to wake up).'
      };
    }
    return {
      ok: false,
      reason: 'NETWORK_ERROR',
      message: 'Cannot reach backend API server. Check your internet connection or backend URL.'
    };
  }
}

export async function request(endpoint, options = {}) {
  const headers = {
    Accept: 'application/json',
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
    delete headers['content-type'];
  }

  const url = getApiUrl(endpoint);
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || 60000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      signal: options.signal || controller.signal
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. The backend server may be starting up — please try again in a few seconds.');
    }
    throw new Error('Unable to connect to the UD-QM backend server. Please check your connection or backend URL.');
  } finally {
    clearTimeout(timer);
  }

  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    if (contentType.includes('application/json')) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Request failed with status ${response.status}`);
    }
    if (response.status === 502 || response.status === 503 || response.status === 504 || response.status === 405) {
      throw new Error('Backend server is waking up or updating (HTTP ' + response.status + '). Please try again in 10-15 seconds.');
    }
    throw new Error(`Server response error (${response.status}). The backend API may be restarting.`);
  }

  if (options.rawResponse) {
    return response;
  }

  if (!contentType.includes('application/json')) {
    throw new Error(
      'Backend server is currently starting up (received HTML instead of JSON). Please wait 15 seconds and retry.'
    );
  }

  return response.json();
}
