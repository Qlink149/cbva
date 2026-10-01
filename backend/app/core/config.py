from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings

_KNOWN_INSECURE_SECRETS = {
    "dev-secret-change-in-production",
    "change-me-in-production",
    "change-me-to-a-long-random-string",
    "secret",
    "changeme",
}


class Settings(BaseSettings):
    ENV: Literal["dev", "prod"] = "dev"
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "cbva"
    # No default: the app refuses to start without a strong key (see validator).
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    # Comma-separated exact origins. Include both localhost and 127.0.0.1 for local Vite.
    FRONTEND_ORIGIN: str = "http://localhost:5173,http://127.0.0.1:5173"
    # Optional regex for preview URLs. Leave unset in production.
    CORS_ORIGIN_REGEX: str | None = None
    # Peers allowed to vouch for the client IP via CF-Connecting-IP (the Caddy container on the compose
    # network). Anything else connecting directly cannot influence rate-limit buckets.
    TRUSTED_PROXY_CIDRS: str = "127.0.0.0/8,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"
    # First-admin bootstrap (python -m app.cli bootstrap). Not read by the API itself.
    ADMIN_EMAIL: str | None = None
    ADMIN_PASSWORD: str | None = None
    # Migration dry-run only — read-only prod + separate write DB (see scripts/meetings_migration_dryrun.py)
    MONGODB_URL_PROD_READ: str | None = None
    PROD_DATABASE_NAME: str | None = None
    MIGRATION_WRITE_DATABASE_NAME: str = "cbva_db_local"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @field_validator("SECRET_KEY")
    @classmethod
    def _validate_secret_key(cls, v: str) -> str:
        v = (v or "").strip()
        if v.lower() in _KNOWN_INSECURE_SECRETS or v.lower().startswith("change-me"):
            raise ValueError("SECRET_KEY is a known placeholder value; set a random secret")
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters (try: openssl rand -hex 32)")
        return v

    @field_validator("CORS_ORIGIN_REGEX", "ADMIN_EMAIL", "ADMIN_PASSWORD", "MONGODB_URL_PROD_READ",
                     "PROD_DATABASE_NAME", mode="before")
    @classmethod
    def _empty_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.FRONTEND_ORIGIN.split(",") if o.strip()]

    @property
    def trusted_proxy_networks(self) -> list:
        import ipaddress
        return [ipaddress.ip_network(c.strip(), strict=False) for c in self.TRUSTED_PROXY_CIDRS.split(",") if c.strip()]

    @property
    def is_prod(self) -> bool:
        return self.ENV == "prod"


settings = Settings()
