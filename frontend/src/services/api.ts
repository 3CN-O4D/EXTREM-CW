import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  timeout: 25000,
});

// --- Lightweight GET cache -------------------------------------------------
// Switching tabs remounts pages. Without a cache every remount refetches the
// same data and shows a loading screen. We keep recent GET responses in memory
// so a revisit renders instantly. Any mutation (POST/PUT/PATCH/DELETE) clears
// the cache, so edits are always followed by fresh reads.
const CACHE_TTL_MS = 30_000;
const CACHE_MAX_ENTRIES = 80;
const getCache = new Map<string, { at: number; data: unknown }>();

function cacheKey(config: { url?: string; params?: unknown }): string {
  return `${config.url ?? ''}?${JSON.stringify(config.params ?? {})}`;
}

export function clearApiCache(): void {
  getCache.clear();
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if ((config.method ?? 'get').toLowerCase() === 'get') {
    const entry = getCache.get(cacheKey(config));
    if (entry && Date.now() - entry.at < CACHE_TTL_MS) {
      const cached = entry.data;
      config.adapter = () =>
        Promise.resolve({
          data: cached,
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        });
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    const method = (response.config.method ?? 'get').toLowerCase();
    if (method === 'get' && response.status === 200) {
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
