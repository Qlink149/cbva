# CBVA deployment: direct edge (Vultr VPS + Caddy + Let's Encrypt), frontend on Vercel

```
Browser ──► cbva.claraai.tech          (Vercel: Vite SPA, env Production)
        ──► cbva-staging.claraai.tech  (Vercel: same project, env Preview, domain bound to branch `staging`)
   │
   └─ API ──► cbva-api.claraai.tech          ─┐  A record -> Vultr (prod)
              cbva-api-staging.claraai.tech  ─┘  A record -> Vultr (staging)
                 │  :80/:443 straight to the VPS (no Cloudflare)
                 ▼
              Caddy (automatic HTTPS, Let's Encrypt) ─► api:8000 [FastAPI, 1 worker] ─► external MongoDB
```

| Environment | Frontend (Vercel) | API host (`SITE_ADDRESS`) | `FRONTEND_ORIGIN` on that server | DB |
|---|---|---|---|---|
| **production** | `https://cbva.claraai.tech` | `cbva-api.claraai.tech` | `https://cbva.claraai.tech` | `cbva` |
| **staging** | `https://cbva-staging.claraai.tech` | `cbva-api-staging.claraai.tech` | `https://cbva-staging.claraai.tech` | `cbva_staging` |

Use a **different `SECRET_KEY`, Mongo user and database for each server.**

| File | Purpose |
|---|---|
| `docker-compose.yml`, `Caddyfile` | runtime stack (api + caddy), direct mode; synced to `/opt/cbva` by CI |
| `bootstrap-vps.sh`, `docker-user-firewall.sh` | one-time hardening (`EDGE_MODE=direct` default); the DOCKER-USER ingress rules |
| `VULTR_FIREWALL.md` | Vultr Firewall Group rules for direct mode |
| `smoke-test.sh`, `test/edge-test.sh` | container smoke test; edge test (header stripping, real client IP) |
| `DATA_MIGRATION.md` | mongodump/mongorestore, index + count verification, "what an empty DB is missing" |
| `Caddyfile.cloudflare`, `docker-compose.cloudflare.yml`, `refresh-cloudflare-ips.sh`, `cloudflare-ips.conf` | **Cloudflare mode, kept for later** (see the last section) |

## 1. DNS at GoDaddy

DNS Manager → your domain `claraai.tech` → Add New Record. In GoDaddy the **Name** field is only the label (`cbva-api`), not the full host name.

| Type | Name | Value | TTL |
|---|---|---|---|
| **A** | `cbva-api` | production Vultr IPv4 | 600 s |
| **A** | `cbva-api-staging` | staging Vultr IPv4 | 600 s |
| **CNAME** | `cbva` | Vercel's target (shown in Vercel → Project → Settings → Domains once you add the domain; use exactly that value, not a remembered one) | 1 h |
| **CNAME** | `cbva-staging` | the same Vercel target | 1 h |

- A label can hold **either** a CNAME **or** other records. Delete any GoDaddy "parked" or forwarding record already on those four labels first.
- Reserve a **static IPv4** on each Vultr server and use that one.
- No `AAAA` records unless the server has IPv6 **and** the Vultr group allows 80/443 on IPv6 (see `VULTR_FIREWALL.md`).
- If you have `CAA` records on the domain they must allow Let's Encrypt: `0 issue "letsencrypt.org"`.
- **Check DNS before the first start of Caddy**, because Let's Encrypt limits failed validations (5 per hostname per hour):
  ```bash
  dig +short cbva-api.claraai.tech          # must print the VPS IP
  dig +short cbva-api-staging.claraai.tech
  ```
  (As of 2026-10-03, a probe against Let's Encrypt **staging** for `cbva-api.claraai.tech` failed with `NXDOMAIN`: the record does not exist yet.)

## 2. Vercel (frontend)

Project settings: Root Directory `frontend`, Framework Preset Vite, Build Command `npm run build`, Output Directory `dist`, Node.js 22.x.
`frontend/vercel.json` already carries the SPA rewrite and the security headers (CSP, nosniff, referrer, permissions, frame, immutable asset cache).

**Environment variables** (Settings → Environment Variables; a Vite variable is baked in at build time, so changing it needs a redeploy):

| Variable | Production | Preview | Development |
|---|---|---|---|
| `VITE_API_URL` | `https://cbva-api.claraai.tech` | `https://cbva-api-staging.claraai.tech` | leave unset (dev server falls back to `http://localhost:8000`) |

The build **fails** if `VITE_API_URL` is missing, points at localhost, or is an origin that is not in `connect-src` of `vercel.json`'s CSP
(which lists exactly the two API origins above). If you ever add another API host, add it to `vercel.json` too.

**Domains** (Settings → Domains):
- `cbva.claraai.tech` → Production.
- `cbva-staging.claraai.tech` → assign it to the Git branch **`staging`** (Preview environment). Then the staging frontend has exactly the origin the staging API allows (`FRONTEND_ORIGIN=https://cbva-staging.claraai.tech`).
- Any other Preview URL (`*-git-*.vercel.app`) builds and loads, but its API calls are **blocked by the backend's CORS on purpose**: only exact origins are allowed and `CORS_ORIGIN_REGEX` is empty. Add a specific preview origin to the staging server's `FRONTEND_ORIGIN` temporarily if you need one.

**Deployment Protection**: Settings → Deployment Protection → enable **Vercel Authentication (Standard Protection)** for **Preview** deployments, so only your Vercel team can open previews and the generated `*.vercel.app` URLs. Production stays public on `cbva.claraai.tech`.
Check in the dashboard whether the staging branch domain is covered by the setting you chose; if you want staging private, keep protection on for it (UNVERIFIED: I have no Vercel access, so the exact coverage is not confirmed).

## 3. VPS setup (one per environment)

```bash
# from your laptop (the three files stay together; refresh-cloudflare-ips.sh is only for cloudflare mode)
scp deploy/bootstrap-vps.sh deploy/docker-user-firewall.sh root@<vps-ip>:/root/
ssh root@<vps-ip> 'EDGE_MODE=direct SSH_ALLOW_IP=<your.public.ip> bash bootstrap-vps.sh deploy "<paste PUBLIC key text>"'
# open a SECOND terminal and confirm: ssh deploy@<vps-ip>   (before closing the first)
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub -E sha256   # run on the VPS: value for SSH_HOST_FINGERPRINT
```

`SSH_ALLOW_IP` is required (port 22 is then reachable only from that address). Also create the **Vultr Firewall Group** from `VULTR_FIREWALL.md`
(80/443 from anywhere, 22 from your IP). ufw does not filter Docker-published ports, so the bootstrap also installs the DOCKER-USER rules (`cbva-firewall.service`).

As `deploy` in `/opt/cbva` put `docker-compose.yml`, `Caddyfile` (CI also syncs these two) and `.env` (`chmod 600`, based on `backend/.env.example`):

```dotenv
ENV=prod
EDGE_MODE=direct
SITE_ADDRESS=cbva-api.claraai.tech          # staging: cbva-api-staging.claraai.tech
ACME_EMAIL=yogansh@claraai.tech
FRONTEND_ORIGIN=https://cbva.claraai.tech   # staging: https://cbva-staging.claraai.tech
MONGODB_URL=...  DATABASE_NAME=cbva         # staging: cbva_staging, its own user
SECRET_KEY=$(openssl rand -hex 32)          # different on each server
```

GitHub **environment** `production` (and one for staging if you add a staging job; the shipped workflow deploys `main` to `production` only) with secrets:

| Secret | Value |
|---|---|
| `SSH_HOST`, `SSH_USER` | VPS address, `deploy` |
| `SSH_KEY` | private key for `deploy` |
| `SSH_HOST_FINGERPRINT` | `SHA256:...` from the command above: pins the host key |
| `GHCR_PULL_USER`, `GHCR_PULL_TOKEN` | GitHub user + PAT with `read:packages` that the VPS uses to pull |

## 4. First-run order

```bash
cd /opt/cbva
export GHCR_OWNER=<github-owner> TAG=<image-tag>      # CI records the tag in .current_tag
docker login ghcr.io -u <user>                          # PAT with read:packages
docker compose pull

# (migrating existing data? do deploy/DATA_MIGRATION.md steps 1-2 now, before bootstrap)

# 1) Bootstrap: first admin + KRA seed + current FY (idempotent). Needs ADMIN_EMAIL / ADMIN_PASSWORD (>= 12 chars) in .env
docker compose run --rm --no-deps api python -m app.cli bootstrap

# 2) Leftover demo accounts (admin@cbva.com, mm@*, vc@*): read-only, exit 1 if any are found
docker compose run --rm --no-deps api python -m app.cli check-demo-users
docker compose run --rm --no-deps api python -m app.cli check-demo-users --deactivate   # once your real admin works

# 3) Start; Caddy now requests the Let's Encrypt certificate (DNS must already point here)
docker compose up -d
docker compose ps                                       # api -> healthy
docker compose logs caddy | grep -i "certificate obtained"
curl -fsS https://cbva-api.claraai.tech/health/ready    # {"status":"ok","db":"up",...}
curl -sI http://cbva-api.claraai.tech | head -3         # 308 -> https
docker compose run --rm --no-deps api python -m app.cli verify-indexes
docker stats --no-stream                                # api RSS well under 700 MiB
```

Remove `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env` after step 1. Bootstrap does **not** create leaders (it needs real names/practices).
`GET /api/consolidated-summary` returns **503** until a `consolidated_summaries` document exists for the FY. See `DATA_MIGRATION.md` §5.

**Do not `docker compose down -v`**: the `caddy_data` volume holds the issued certificate and ACME account; recreating it re-requests
certificates and can hit Let's Encrypt's rate limits.

## 5. How the client IP is handled (why rate limits are per real client)

Caddy removes any `CF-Connecting-IP` and `X-Forwarded-For` the client sent and sets `X-Real-IP` to the TCP peer address.
The API reads `X-Real-IP` (`EDGE_MODE=direct`; override with `CLIENT_IP_HEADER`) **only** when the connection comes from `TRUSTED_PROXY_CIDRS`
(the Caddy container's private network) and ignores every other header. uvicorn runs `--no-proxy-headers`. The API port is never published.
Tested: `test/edge-test.sh` (real Caddyfile + echo upstream) and `backend/tests/test_rate_limit_proxy.py`.

## 6. Rollback

1. The deploy job records `/opt/cbva/.current_tag` and `.previous_tag`. If pull, start or the health check fails it
   **automatically** re-deploys the previous tag (an ERR trap, simulated against a stub docker for four scenarios).
2. Manual: `cd /opt/cbva && export GHCR_OWNER=<owner> TAG=$(cat .previous_tag) && docker compose up -d api && curl -fsS https://cbva-api.claraai.tech/health/ready && echo $TAG > .current_tag`.
3. No schema migrations in code (index creation is additive), so no DB rollback step. For data problems restore the Atlas
   snapshot into a **new** database and switch `DATABASE_NAME`.
4. Frontend: Vercel → Deployments → promote/redeploy the previous production deployment (Instant Rollback).
5. Keep the last 3 image tags in GHCR.

## 7. Operating notes

- One uvicorn worker, `mem_limit: 700m`, 2 GB swap. Do not raise workers on 1 vCPU / 1 GB.
- Login limiter (5/min per client IP) and per-email throttle (10 per 15 min, in-process) reset on container restart; fine for one
  instance. The per-email throttle also lets someone lock a known email out for 15 minutes; accepted trade-off.
- `/health` is liveness (no DB); `/health/ready` pings Mongo (2 s timeout, 503 if down) and is used by Docker, Caddy and CI.
- `ENV=prod` disables `/docs`, `/redoc`, `/openapi.json`.
- Tokens live in browser `localStorage` (access 15 min, refresh 7 days, rotated with a unique `jti`, revoked on password change /
  deactivation / logout). The CSP is the main XSS mitigation.
- Reads can write: `GET /api/appraisals/*`, collections, blue-sky and EL summary create rows on first read, and `GET /api/consolidated-summary` can import.
- MongoDB must allow each VPS IP (Atlas Network Access: only `<vps-ip>/32`), one DB user per environment with `readWrite` on its own database.

## 8. Cloudflare mode (kept for later, not used now)

To put Cloudflare in front later: DNS records proxied, SSL mode Full (strict), a Cloudflare Origin CA certificate in `/opt/cbva/certs/origin.pem|key`
(Let's Encrypt cannot validate through a Cloudflare-only firewall). Then on the VPS: `.env` gets `EDGE_MODE=cloudflare` and `CADDYFILE=./Caddyfile.cloudflare`;
re-run the bootstrap with `EDGE_MODE=cloudflare` (also copy `refresh-cloudflare-ips.sh` next to it); start with
`docker compose -f docker-compose.yml -f docker-compose.cloudflare.yml up -d`. In that mode ports 80/443 are restricted to Cloudflare's ranges by the
DOCKER-USER rules (refreshed daily) and the API trusts `CF-Connecting-IP`. To return to direct mode, run `refresh-cloudflare-ips.sh --remove` and the direct bootstrap.
The Cloudflare Pages header files live in `frontend/cloudflare-pages/`.
