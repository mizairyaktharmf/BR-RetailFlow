"""
Application configuration
Loads settings from environment variables
"""

from pydantic_settings import BaseSettings
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Application
    APP_NAME: str = "BR-RetailFlow"
    DEBUG: bool = False

    # Database - Override via DATABASE_URL env variable
    DATABASE_URL: str = "postgresql://bruser:password@localhost:5432/brretailflow"

    # JWT Authentication
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Gemini Vision API
    GEMINI_API_KEY: str = ""

    # Web Push VAPID keys (generate with: vapid --gen)
    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY: str = ""
    VAPID_MAILTO: str = "mailto:admin@br-retailflow.com"

    # SMTP Email Settings
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    SMTP_FROM: str = "noreply@br-retailflow.com"
    REPORT_EMAIL_TO: str = ""  # comma-separated list of recipient emails

    # CORS - comma-separated origins string
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001,http://localhost:3002"

    @property
    def cors_origins_list(self) -> list:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(',') if origin.strip()]

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
