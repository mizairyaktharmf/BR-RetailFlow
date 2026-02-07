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

    # Database
    DATABASE_URL: str = "postgresql://bruser:Mm99090401@br-retailflow-db.cp424kwuw8hu.eu-north-1.rds.amazonaws.com:5432/postgres?sslmode=require"

    # JWT Authentication
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "https://br-retailflow.vercel.app",
        "https://flavor-expert.br-retailflow.vercel.app",
        "https://admin.br-retailflow.vercel.app"
    ]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
