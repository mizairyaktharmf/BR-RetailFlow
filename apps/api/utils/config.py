"""
Application configuration
Loads settings from environment variables
"""

from pydantic_settings import BaseSettings
from typing import List
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

    # CORS - Add your production domains here via CORS_ORIGINS env variable
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
    ]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
