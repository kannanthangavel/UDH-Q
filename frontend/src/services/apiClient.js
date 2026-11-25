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

export function getQuickDownloadUrl(type, identifier) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://udh-q.vercel.app';
  return `${origin.replace(/\/+$/, '')}/download/${type}/${identifier}`;
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

export const CANONICAL_RENDER_URL = 'https://ud-qm-backend.onrender.com';

export function warmUpBackend() {
  if (typeof window === 'undefined') return;
  try {
    fetch(`${CANONICAL_RENDER_URL}/api/health`, { mode: 'no-cors', cache: 'no-store' }).catch(() => {});
  } catch (e) {}
}

if (typeof window !== 'undefined') {
  setTimeout(warmUpBackend, 100);
}

export function getStoredToken() {
  try {
    return (typeof window !== 'undefined' && (sessionStorage.getItem('udqm_token') || localStorage.getItem('udqm_token'))) || '';
  } catch (e) {
    return '';
  }
}

export async function checkBackendHealth(customOrigin = null) {
  const base = customOrigin
    ? `${customOrigin.trim().replace(/\/+$/, '').replace(/\/api$/, '')}/api`
    : getApiBase();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(`${base}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timer);

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json().catch(() => null);
      if (res.ok && data?.status === 'ok') {
        return { ok: true, data };
      }
    }
  } catch (err) {
    clearTimeout(timer);
  }

  // Fallback: If same-origin proxy is waking up, check Render directly
  try {
    const directRes = await fetch(`${CANONICAL_RENDER_URL}/api/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    const directType = directRes.headers.get('content-type') || '';
    if (directType.includes('application/json')) {
      const data = await directRes.json().catch(() => null);
      if (directRes.ok && data?.status === 'ok') {
        return { ok: true, data, direct: true };
      }
    }
  } catch (e) {}

  return {
    ok: false,
    reason: 'WAKING_UP',
    message: 'Secure cloud server is starting up. Connecting automatically...'
  };
}

export async function request(endpoint, options = {}) {
  const maxRetries = options.retries !== undefined ? options.retries : 5;
  const timeoutMs = options.timeoutMs || 45000;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
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

    // On retry attempts (if same-origin proxy returned cold-start status or HTML),
    // alternate with direct Render URL to bypass proxy timeouts
    let url;
    if (attempt > 0 && typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
      url = `${CANONICAL_RENDER_URL}/api${cleanEndpoint}`;
    } else {
      url = getApiUrl(endpoint);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    let networkError = null;

    try {
      response = await fetch(url, {
        cache: 'no-store',
        ...options,
        headers,
        signal: options.signal || controller.signal
      });
    } catch (err) {
      networkError = err;
    } finally {
      clearTimeout(timer);
    }

    // If fetch failed due to abort or network error, and we have retries left:
    if (networkError) {
      if (attempt < maxRetries) {
        const delays = [2000, 3000, 4000, 5000, 5000, 5000];
        await new Promise(r => setTimeout(r, delays[attempt] || 4000));
        continue;
      }
      throw new Error('UD-QM cloud server is starting up. Please click retry in a few moments.');
    }

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    // If server returned cold-start status (502, 503, 504, 405) or HTML instead of JSON:
    const isColdStart = (
      response.status === 502 ||
      response.status === 503 ||
      response.status === 504 ||
      response.status === 405 ||
      (!response.ok && !isJson) ||
      (response.ok && !isJson && !options.rawResponse)
    );

    if (isColdStart && attempt < maxRetries) {
      // Backend is waking up on Render, pause and retry seamlessly
      const delays = [2000, 3000, 4000, 5000, 5000, 5000];
      await new Promise(r => setTimeout(r, delays[attempt] || 4000));
      continue;
    }

    if (!response.ok) {
      if (isJson) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }
      if (response.status === 502 || response.status === 503 || response.status === 504 || response.status === 405) {
        throw new Error('UD-QM cloud backend is finishing startup. Please retry in 10-15 seconds.');
      }
      throw new Error(`Server returned status ${response.status}. Please try again.`);
    }

    if (options.rawResponse) {
      return response;
    }

    if (!isJson) {
      throw new Error('UD-QM backend is finishing startup. Please retry in a few seconds.');
    }

    return response.json();
  }
}
