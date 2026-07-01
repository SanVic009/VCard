from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    supabase_url: str
    supabase_service_role_key: str
    jwt_secret: str
    access_token_expire_minutes: int = 60
    environment: str = "development"
    gemini_api_key: str | None = None
    app_version: str = "0.0.1"
    allowed_origins: str = "*"
    log_level: str = "INFO"
    rate_limit_enabled: bool = True

    @model_validator(mode="after")
    def validate_origins(self) -> 'Settings':
        if self.environment == "production":
            origins_str = (self.allowed_origins or "").strip()
            if not origins_str:
                raise ValueError("ALLOWED_ORIGINS must be explicitly configured in production environment (cannot be empty)")
        return self

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
