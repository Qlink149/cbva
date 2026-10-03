// Single source of truth for the backend base URL.
// Production builds must set VITE_API_URL (enforced at build time in vite.config.js).
// The localhost fallback exists only for `vite` dev server.
const configured = import.meta.env.VITE_API_URL;

if (!configured && !import.meta.env.DEV) {
  throw new Error('VITE_API_URL is not set; refusing to fall back to localhost in a production build.');
}

export const API_BASE_URL = (configured || 'http://localhost:8000').replace(/\/+$/, '');
