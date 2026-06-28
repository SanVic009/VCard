from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    supabase_url: str
    supabase_service_role_key: str
    jwt_secret: str
    access_token_expire_minutes: int = 60
    environment: str = "development"
    database_url: str
    use_local_auth: bool = False
    gemini_api_key: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
