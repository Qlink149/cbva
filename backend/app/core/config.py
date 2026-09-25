from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "cbva"
    SECRET_KEY: str = "dev-secret-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    # Comma-separated. Include both localhost and 127.0.0.1 for local Vite.
    FRONTEND_ORIGIN: str = "http://localhost:5173,http://127.0.0.1:5173"
    # Optional regex for Vercel preview URLs (e.g. https://*.vercel.app)
    CORS_ORIGIN_REGEX: str | None = r"https://.*\.vercel\.app"
    # Migration dry-run only — read-only prod + separate write DB (see scripts/meetings_migration_dryrun.py)
    MONGODB_URL_PROD_READ: str | None = None
    PROD_DATABASE_NAME: str | None = None
    MIGRATION_WRITE_DATABASE_NAME: str = "cbva_db_local"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.FRONTEND_ORIGIN.split(",") if o.strip()]


settings = Settings()
