"""
BR-RetailFlow API
Main application entry point
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from routers import auth, users, branches, flavors, inventory, analytics, cake
from utils.database import engine, Base
from utils.config import settings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup: Create database tables
    # Use checkfirst=True and catch errors for ENUM types that may already exist
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        logger.warning(f"create_all partial failure (schema may already exist): {e}")
    yield
    # Shutdown: Cleanup if needed


app = FastAPI(
    title="BR-RetailFlow API",
    description="Ice Cream Inventory & Analytics Solution for Baskin Robbins UAE",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(branches.router, prefix="/api/v1/branches", tags=["Branches"])
app.include_router(flavors.router, prefix="/api/v1/flavors", tags=["Flavors"])
app.include_router(inventory.router, prefix="/api/v1/inventory", tags=["Inventory"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["Analytics"])
app.include_router(cake.router, prefix="/api/v1/cake", tags=["Cake Inventory"])


@app.get("/")
async def root():
    """Root endpoint - API health check"""
    return {
        "message": "BR-RetailFlow API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {"status": "healthy"}
