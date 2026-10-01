# CBVA deployment (Vultr VPS + Caddy + Cloudflare, frontend on Cloudflare Pages)

```
Browser ──► app.<domain>  (Cloudflare Pages: Vite SPA)
   │
   └──────► api.<domain>  (Cloudflare proxy ─► Caddy :443 ─► api:8000 [FastAPI, 1 worker]) ─► external MongoDB
```

Replace `example.com` placeholders in: `deploy/Caddyfile` (site address), `frontend/public/_headers` (`connect-src`), `backend/.env` (`FRONTEND_ORIGIN`), Pages env (`VITE_API_URL`).

## 1. Cloudflare

1. DNS: `A api.<domain>` → VPS static IPv4 (**proxied / orange cloud**). The `app` record is created by Pages.
2. SSL/TLS mode: **Full (strict)**. Caddy obtains a Let's Encrypt cert on the origin. For the very first issuance, set the `api` record to DNS-only (grey cloud) until Caddy logs `certificate obtained`, then switch to proxied.
3. Optional: in `ufw`, restrict 80/443 to Cloudflare ranges once everything works (https://www.cloudflare.com/ips). Keep `deploy/Caddyfile` `trusted_proxies` in sync with that list.

## 2. Cloudflare Pages (frontend)

| Setting | Value |
|---|---|
| Framework preset | None (Vite) |
| Root directory | `frontend` |
| Build command | `npm ci && npm run build` |
| Build output directory | `dist` |
| `NODE_VERSION` (env var) | `22` (any current LTS; local dev used 24) |
| `VITE_API_URL` (env var, **Production**) | `https://api.<domain>` — the build **fails** if missing or containing `localhost` |
| Custom domain | `app.<domain>` |

> **Warning: preview deployments (`*.pages.dev`) are NOT allowed by the backend CORS.** `FRONTEND_ORIGIN` lists exact origins only and `CORS_ORIGIN_REGEX` is empty. A preview build will load but every API call will be blocked. Either disable previews, or add a specific preview origin to `FRONTEND_ORIGIN` temporarily. Also note `VITE_API_URL` must be set for the Preview environment too, or preview builds fail.

`frontend/public/_headers` (CSP etc.) and `_redirects` (SPA fallback) are copied into `dist/` and honoured by Pages. `frontend/vercel.json` is untouched and unused on Pages (left for the old Vercel deployment).

CSP note: if you add a new third-party origin (fonts, images, analytics) the app will silently lose it until it is added to `_headers`. Check the browser console for `Content Security Policy` errors after deploys.

## 3. MongoDB (Atlas or self-managed) allowlist checklist

- [ ] Reserve a **static IPv4** on Vultr (Instance → Settings → IPv4) so the allowlist does not break on rebuild.
- [ ] Add only `<vps-ip>/32` to Atlas **Network Access**. Remove `0.0.0.0/0`.
- [ ] Dedicated DB user with `readWrite` on the app database only (no `atlasAdmin`).
- [ ] Atlas region close to the VPS (Mumbai `ap-south-1` for a Mumbai/Bangalore VPS). Check the cluster tier: M0 caps at 500 connections / 512 MB (the app opens ≤ 10).
- [ ] Backups enabled; do one test restore into a scratch database.
- [ ] Rotate any credential that ever sat in a developer's local `.env` (`MONGODB_URL_PROD_READ`).
- [ ] Alerts on connections, disk, and replication lag.

## 4. VPS setup

```bash
# on your laptop
scp deploy/bootstrap-vps.sh root@<vps-ip>:/root/
ssh root@<vps-ip> 'bash bootstrap-vps.sh deploy "$(cat ~/.ssh/id_ed25519.pub)"'   # pass the PUBLIC key text
# open a second terminal: ssh deploy@<vps-ip>   (confirm it works BEFORE closing the first)
```

Then as `deploy` in `/opt/cbva` place `docker-compose.yml`, `Caddyfile`, and `.env` (`chmod 600`, based on `backend/.env.example`; `ENV=prod`; `SECRET_KEY` from `openssl rand -hex 32`).

GitHub repo secrets for `.github/workflows/deploy.yml`: `SSH_HOST`, `SSH_USER` (`deploy`), `SSH_KEY` (private key), `GHCR_PULL_TOKEN` (PAT with `read:packages`). Create a GitHub **environment** named `production` (add required reviewers if you want manual approval).

## 5. First-run order

```bash
cd /opt/cbva
export GHCR_OWNER=<github-owner> TAG=<image-tag-or-latest>
docker login ghcr.io -u <user>            # PAT with read:packages
docker compose pull

# 1) Bootstrap: first admin + KRA seed + current FY (idempotent). Needs ADMIN_EMAIL / ADMIN_PASSWORD (>= 12 chars) in .env
docker compose run --rm --no-deps api python -m app.cli bootstrap

# 2) Look for leftover demo accounts (admin@cbva.com, mm@*, vc@*). Read-only by default; exits 1 if any are found.
docker compose run --rm --no-deps api python -m app.cli check-demo-users
#    ...then, once your real admin works:
docker compose run --rm --no-deps api python -m app.cli check-demo-users --deactivate

# 3) Start and verify
docker compose up -d
docker compose ps                                   # api should become "healthy"
curl -fsS https://api.<domain>/health/ready         # {"status":"ok","db":"up",...}
docker stats --no-stream                            # api RSS expected well under 700 MiB
```

Remove `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env` after step 1.

Bootstrap does **not** create leaders (it needs real names/practices) and warns if the `leaders` collection is empty. `GET /api/consolidated-summary` returns **503** until a `consolidated_summaries` document exists for the requested FY in Mongo (the source xlsx is not shipped in the image).

## 6. Rollback

1. The deploy job records `/opt/cbva/.current_tag` and `/opt/cbva/.previous_tag`, and rolls back automatically if the new container never turns healthy.
2. Manual: `cd /opt/cbva && export GHCR_OWNER=<owner> TAG=$(cat .previous_tag) && docker compose up -d api && curl -fsS https://api.<domain>/health/ready && echo $TAG > .current_tag`.
3. The code has no schema migrations (index creation is additive), so there is no DB rollback step. For data problems, restore the Atlas snapshot into a **new** database and switch `DATABASE_NAME`.
4. Frontend: Cloudflare Pages → Deployments → "Rollback to this deployment" on the previous build.
5. Keep the last 3 image tags in GHCR (do not prune them).

## 7. Operating notes

- Single uvicorn worker, `mem_limit: 700m`, 2 GB swap. Do not raise workers on a 1 vCPU/1 GB box.
- The login limiter and per-email throttle are in-process: they reset on container restart. That is acceptable for a single instance; do not scale out without moving them to shared storage.
- `/health` is liveness (no DB), `/health/ready` checks Mongo (2 s timeout; 503 if down) and is what Docker and Caddy use.
- `ENV=prod` disables `/docs`, `/redoc`, `/openapi.json`.
- Tokens live in browser `localStorage` (access 15 min, refresh 7 days, rotated; revoked on password change / deactivation / logout). The CSP in `_headers` is the main XSS mitigation, so keep `script-src 'self'` free of `unsafe-inline`.
