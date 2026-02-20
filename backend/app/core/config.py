from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "Acta AI"
    API_V1_STR: str = "/api/v1"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres@localhost:5432/acta_ai"

    # Auth
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # OpenAI
    OPENAI_API_KEY: str = ""

    # Unsplash (for stock photo featured images)
    UNSPLASH_ACCESS_KEY: str = ""

    # Encryption (for WordPress credentials)
    ENCRYPTION_KEY: str = ""

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_SCRIPTOR: str = ""
    STRIPE_PRICE_TRIBUNE: str = ""
    STRIPE_PRICE_IMPERATOR: str = ""

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    # Public URLs
    BACKEND_BASE_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:5173"

    # Shopify (public app)
    SHOPIFY_APP_CLIENT_ID: str = ""
    SHOPIFY_APP_CLIENT_SECRET: str = ""
    SHOPIFY_SCOPES: str = "read_content,write_content"
    SHOPIFY_API_VERSION: str = "2026-01"

    # Environment
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    DEBUG: bool = True

    # Rate limiting
    RATE_LIMIT_STORAGE_URI: str = "memory://"
    RATE_LIMIT_TRUST_PROXY_HEADERS: bool = False
    RATE_LIMIT_AUTH_REGISTER: str = "5/minute"
    RATE_LIMIT_AUTH_TOKEN: str = "5/minute"
    RATE_LIMIT_AUTH_REFRESH: str = "5/minute"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
