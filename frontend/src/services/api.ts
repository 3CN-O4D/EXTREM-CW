import axios from 'axios';

declare module 'axios' {
  interface AxiosRequestConfig {
    // Bypass the cached copy and hit the network. The fresh response still
    // refreshes the cache for the next visit.
    skipCache?: boolean;
  }
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  timeout: 25000,
});

// --- Stale-while-revalidate GET cache --------------------------------------
// Switching tabs remounts pages. Without a cache every remount refetches the
// same data and shows a loading screen. We keep recent GET responses in memory:
//  - younger than FRESH: serve instantly, no network
//  - younger than STALE: serve instantly, refresh in the background
//  - older: fetch normally
// Any mutation (POST/PUT/PATCH/DELETE) clears the cache, so edits are always
// followed by fresh reads.
const CACHE_FRESH_MS = 60_000;
const CACHE_STALE_MS = 30 * 60_000;
const CACHE_MAX_ENTRIES = 80;
const getCache = new Map<string, { at: number; data: unknown }>();
const revalidating = new Set<string>();

function cacheKey(config: { url?: string; params?: unknown }): string {
  return `${config.url ?? ''}?${JSON.stringify(config.params ?? {})}`;
}

// Tells listeners (pages that want live data) that a background refresh landed.
function announceCacheUpdate(key: string): void {
  window.dispatchEvent(new CustomEvent('api:cache-updated', { detail: { key } }));
}

// Fetch the same URL again without touching the cache read path. The response
// interceptor stores the new data, so the next visit is fresh.
function revalidateInBackground(key: string, config: any): void {
  if (revalidating.has(key)) return;
  revalidating.add(key);
  api
    .request({ ...config, adapter: undefined, skipCache: true })
    .then(() => announceCacheUpdate(key))
    .catch(() => {
      // Keep serving the cached copy; the next visit will try again.
    })
    .finally(() => revalidating.delete(key));
}

export function clearApiCache(): void {
  getCache.clear();
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if ((config.method ?? 'get').toLowerCase() === 'get' && !config.skipCache) {
    const key = cacheKey(config);
    const entry = getCache.get(key);
    if (entry) {
      const age = Date.now() - entry.at;
      if (age < CACHE_STALE_MS) {
        const cached = entry.data;
        config.adapter = () =>
          Promise.resolve({
            data: cached,
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          });
        if (age >= CACHE_FRESH_MS) revalidateInBackground(key, config);
      }
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    const method = (response.config.method ?? 'get').toLowerCase();
    if (method === 'get') {
      if (getCache.size >= CACHE_MAX_ENTRIES) {
        const oldest = getCache.keys().next().value;
        if (oldest !== undefined) getCache.delete(oldest);
      }
      getCache.set(cacheKey(response.config), { at: Date.now(), data: response.data });
    } else {
      // Mutations invalidate everything so the next read is authoritative.
      getCache.clear();
    }
    return response;
  },
  (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url || '';

    // A saved token can outlive the session. Clear it and let the app fall
    // back to the landing / login screen instead of showing an endless loader.
    if (status === 401 && !url.includes('/auth/token')) {
      clearApiCache();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('auth:expired'));
    }
    return Promise.reject(error);
  },
);

export default api;
