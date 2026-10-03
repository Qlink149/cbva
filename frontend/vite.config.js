import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Production builds must point at a real API: no silent localhost fallback.
  if (mode === 'production') {
    const apiUrl = loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL || process.env.VITE_API_URL;
    if (!apiUrl) {
      throw new Error('VITE_API_URL is required for production builds (e.g. https://api.example.com).');
    }
    if (/localhost|127\.0\.0\.1/i.test(apiUrl)) {
      throw new Error(`VITE_API_URL must not point at localhost in a production build (got "${apiUrl}").`);
    }
  }
  const apiOrigin = (() => {
    const url = loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL || process.env.VITE_API_URL;
    try { return url ? new URL(url).origin : null; } catch { return null; }
  })();
  // Vercel: the CSP lives in vercel.json (static, read before the build), so it lists both API origins. A production
  // build whose VITE_API_URL is not one of them would ship an app whose every API call is blocked by its own CSP:
  // fail the build instead. (Escape hatch: SKIP_CSP_ORIGIN_CHECK=1, e.g. for a custom host that you add to the CSP later.)
  if (mode === 'production' && apiOrigin && process.env.SKIP_CSP_ORIGIN_CHECK !== '1') {
    try {
      const cfg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8'));
      const csp = (cfg.headers || []).flatMap((h) => h.headers || []).find((h) => h.key === 'Content-Security-Policy');
      const connect = csp && /(?:^|;)\s*connect-src ([^;]*)/.exec(csp.value);
      if (connect && !connect[1].split(/\s+/).includes(apiOrigin)) {
        throw new Error(`VITE_API_URL origin ${apiOrigin} is not in the connect-src of vercel.json's CSP (${connect[1]}). `
          + 'Add it to vercel.json or fix VITE_API_URL (Vercel env var for this environment).');
      }
    } catch (e) {
      if (e instanceof SyntaxError || e.code === 'ENOENT') { /* no usable vercel.json: nothing to check */ } else { throw e; }
    }
  }
  // Cloudflare Pages path only: cloudflare-pages/_headers (copied into public/) ships with the placeholder
  // https://api.example.com in connect-src. Rewrite it to the real API origin in dist/_headers.
  const cspApiOrigin = {
    name: 'csp-api-origin',
    apply: 'build',
    closeBundle() {
      const f = path.resolve(process.cwd(), 'dist', '_headers');
      if (!apiOrigin || !fs.existsSync(f)) return;
      fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replaceAll('https://api.example.com', apiOrigin));
    },
  };
  return {
  logLevel: 'info',
  plugins: [
    cspApiOrigin,
    base44({
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: process.env.NODE_ENV !== 'production',
      visualEditAgent: process.env.NODE_ENV !== 'production',
    }),
    react(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          radix: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select', '@radix-ui/react-tabs', '@radix-ui/react-tooltip'],
          recharts: ['recharts'],
          motion: ['framer-motion'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
};
});
