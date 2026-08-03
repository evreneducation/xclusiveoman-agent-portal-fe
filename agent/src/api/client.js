// In dev, VITE_API_PROXY_TARGET is unset and the Vite proxy handles same-origin
// '/api' requests (see vite.config.js). In production, set VITE_API_PROXY_TARGET
// to the backend's absolute URL so the built app can reach a separately hosted API.
const API_TARGET = import.meta.env.VITE_API_PROXY_TARGET?.replace(/\/+$/, '');
const BASE_URL = API_TARGET ? `${API_TARGET}/api` : '/api';

let accessToken = null;
let onUnauthorized = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

// Called by AuthContext once, so a hard 401 (refresh also failed) can clear
// client state without this module needing to import React.
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

async function rawRequest(path, { method = 'GET', body, skipAuth = false } = {}) {
  const isFormData = body instanceof FormData;
  const headers = isFormData ? {} : { 'Content-Type': 'application/json' };
  if (!skipAuth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    credentials: 'include', // sends the httpOnly refresh cookie
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  return { ok: res.ok, status: res.status, data };
}

async function tryRefresh() {
  const { ok, data } = await rawRequest('/auth/refresh', { method: 'POST', skipAuth: true });
  if (ok && data?.accessToken) {
    setAccessToken(data.accessToken);
    return true;
  }
  return false;
}

/**
 * Main request helper. On a 401 (expired access token) it makes one attempt
 * to refresh via the httpOnly cookie and retries the original call before
 * giving up and notifying AuthContext.
 */
export async function apiRequest(path, options = {}) {
  let result = await rawRequest(path, options);

  if (result.status === 401 && !options.skipAuth && !options._retried) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      result = await rawRequest(path, options);
    } else {
      onUnauthorized?.();
    }
  }

  if (!result.ok) {
    const message = result.data?.message || result.data?.error || `Request failed (${result.status})`;
    const error = new Error(message);
    error.status = result.status;
    error.data = result.data;
    throw error;
  }

  return result.data;
}

export const api = {
  get: (path) => apiRequest(path, { method: 'GET' }),
  post: (path, body, options) => apiRequest(path, { method: 'POST', body, ...options }),
  patch: (path, body) => apiRequest(path, { method: 'PATCH', body }),
  put: (path, body) => apiRequest(path, { method: 'PUT', body }),
  del: (path) => apiRequest(path, { method: 'DELETE' }),
  // FormData upload — pass a FormData instance as body (e.g. NEFT slips, documents).
  postForm: (path, formData) => apiRequest(path, { method: 'POST', body: formData }),
};

export { tryRefresh };
