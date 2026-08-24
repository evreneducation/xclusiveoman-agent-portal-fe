// Factory instead of a module-level singleton: the agent and admin modules each
// instantiate their own client so their access tokens and 401 handlers stay
// isolated even though they now live in the same JS bundle (see AUTH-7 in
// context/AuthContext.jsx — /agent and /admin are fully separate auth contexts).
export function createApiClient() {
  // Always same-origin: '/api', proxied to the real backend by vite.config.js's
  // dev-server proxy locally and by vercel.json's rewrite in production — never
  // an absolute cross-origin URL (this used to build one from
  // VITE_API_PROXY_TARGET when set, e.g. in .env.production). An absolute URL
  // made every request cross-site, which made the browser treat the httpOnly
  // refresh cookie (xo_refresh, auth.controller.js) as a third-party cookie —
  // silently dropped by Safari always, and increasingly by Chrome/Firefox too —
  // so /auth/refresh always came back "Missing refresh token" on the deployed
  // site even though login itself succeeded. Same-origin makes it first-party,
  // which no browser blocks.
  //
  // VITE_API_PROXY_TARGET itself is untouched and still read by
  // createSocketClient.js, which connects directly to the backend's absolute
  // URL on purpose — sockets authenticate with the in-memory access token, not
  // this cookie, so being cross-origin there was never the problem.
  const BASE_URL = '/api';

  let accessToken = null;
  let onUnauthorized = null;

  function setAccessToken(token) {
    accessToken = token;
  }

  function getAccessToken() {
    return accessToken;
  }

  // Called by AuthContext once, so a hard 401 (refresh also failed) can clear
  // client state without this module needing to import React.
  function setUnauthorizedHandler(handler) {
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
  async function apiRequest(path, options = {}) {
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

  // Binary downloads (PDF export etc.) — same Authorization header + one
  // refresh-and-retry-on-401 contract as apiRequest above, but the response
  // body is a Blob rather than parsed JSON, so it can't share that function's
  // JSON-parsing return path. Error responses are still JSON ({error,
  // message}) even though a success response is binary, so those are parsed
  // for the message the same way apiRequest does.
  async function rawBlobRequest(path, { method = 'GET' } = {}) {
    const headers = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(`${BASE_URL}${path}`, { method, headers, credentials: 'include' });
  }

  async function apiBlobRequest(path, options = {}) {
    let res = await rawBlobRequest(path, options);

    if (res.status === 401 && !options._retried) {
      const refreshed = await tryRefresh();
      if (refreshed) {
        res = await rawBlobRequest(path, { ...options, _retried: true });
      } else {
        onUnauthorized?.();
      }
    }

    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      try {
        const data = await res.json();
        message = data?.message || data?.error || message;
      } catch {
        // Response body wasn't JSON — keep the generic status message.
      }
      const error = new Error(message);
      error.status = res.status;
      throw error;
    }

    return res.blob();
  }

  const api = {
    get: (path) => apiRequest(path, { method: 'GET' }),
    post: (path, body, options) => apiRequest(path, { method: 'POST', body, ...options }),
    patch: (path, body) => apiRequest(path, { method: 'PATCH', body }),
    put: (path, body) => apiRequest(path, { method: 'PUT', body }),
    del: (path) => apiRequest(path, { method: 'DELETE' }),
    // FormData upload — pass a FormData instance as body (e.g. NEFT slips, documents).
    postForm: (path, formData) => apiRequest(path, { method: 'POST', body: formData }),
    // Binary download (e.g. PDF export) — resolves to a Blob, not JSON.
    getBlob: (path) => apiBlobRequest(path, { method: 'GET' }),
  };

  return { api, setAccessToken, getAccessToken, setUnauthorizedHandler, tryRefresh };
}
