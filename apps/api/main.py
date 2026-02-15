"""
BR-RetailFlow API
Main application entry point
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from routers import auth, users, territories, areas, branches, flavors, inventory, analytics, cake
from utils.database import engine, Base
from utils.config import settings

logger = logging.getLogger(__name__)


def run_migrations():
    """Run schema migrations that create_all cannot handle (ALTER TABLE)"""
    from sqlalchemy import text, inspect
    with engine.connect() as conn:
        inspector = inspect(engine)
        # Only run if branches table already exists
        if 'branches' in inspector.get_table_names():
            columns = [c['name'] for c in inspector.get_columns('branches')]

            # Add territory_id to branches if missing
            if 'territory_id' not in columns:
                logger.info("Migration: Adding territory_id to branches table")
                conn.execute(text("ALTER TABLE branches ADD COLUMN territory_id INTEGER REFERENCES territories(id)"))
                conn.execute(text("UPDATE branches SET territory_id = (SELECT territory_id FROM areas WHERE areas.id = branches.area_id)"))
                conn.execute(text("ALTER TABLE branches ALTER COLUMN territory_id SET NOT NULL"))
                conn.commit()
                logger.info("Migration: territory_id added successfully")

            # Make area_id nullable in branches
            try:
                conn.execute(text("ALTER TABLE branches ALTER COLUMN area_id DROP NOT NULL"))
                conn.commit()
                logger.info("Migration: area_id is now nullable")
            except Exception:
                conn.rollback()  # Already nullable, ignore


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup: Create database tables
    # Use checkfirst=True and catch errors for ENUM types that may already exist
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        logger.warning(f"create_all partial failure (schema may already exist): {e}")

    # Run ALTER TABLE migrations
    try:
        run_migrations()
    except Exception as e:
        logger.warning(f"Migration warning: {e}")

    yield
    # Shutdown: Cleanup if needed


app = FastAPI(
    title="BR-RetailFlow API",
    description="Ice Cream Inventory & Analytics Solution for Baskin Robbins UAE",
    version="1.0.1",
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
app.include_router(territories.router, prefix="/api/v1/territories", tags=["Territories"])
app.include_router(areas.router, prefix="/api/v1/areas", tags=["Areas"])
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
