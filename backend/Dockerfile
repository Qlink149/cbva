# syntax=docker/dockerfile:1
# Base image pinned by digest (update deliberately; see deploy/README.md).
ARG PYTHON_IMAGE=python:3.11-slim

FROM ${PYTHON_IMAGE} AS build
WORKDIR /w
COPY requirements.txt .
RUN python -m venv /venv \
 && /venv/bin/pip install --no-cache-dir --upgrade pip \
 && /venv/bin/pip install --no-cache-dir -r requirements.txt

FROM ${PYTHON_IMAGE}
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    MALLOC_ARENA_MAX=2 \
    TZ=Asia/Kolkata \
    PATH=/venv/bin:$PATH
RUN useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin app
WORKDIR /app
COPY --from=build /venv /venv
COPY app ./app
USER 10001:10001
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["python", "-c", "import sys,urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health/ready', timeout=4).status == 200 else 1)"]

# One worker: 1 vCPU / 1 GB. --no-proxy-headers is deliberate: uvicorn must NOT rewrite request.client from
# X-Forwarded-For (even if FORWARDED_ALLOW_IPS is set in the environment), otherwise the app could no longer
# tell Caddy (the one trusted peer allowed to vouch for CF-Connecting-IP, see TRUSTED_PROXY_CIDRS) from an
# arbitrary client. Port 8000 is never published.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-proxy-headers", "--no-access-log"]
