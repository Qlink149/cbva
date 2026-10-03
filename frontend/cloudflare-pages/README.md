# Cloudflare Pages only

`_headers` and `_redirects` are the Cloudflare Pages equivalents of the `headers` and `rewrites` in `../vercel.json`.
They are **not** in `public/` any more, so a Vercel build does not ship them. To deploy on Cloudflare Pages instead,
copy both files into `../public/` before building. In `_headers`, `connect-src https://api.example.com` is rewritten to the
origin of `VITE_API_URL` at build time by `vite.config.js`. Keep the CSP here in sync with `vercel.json`.
