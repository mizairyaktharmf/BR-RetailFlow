"""
BR-RetailFlow API
Main application entry point
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from routers import auth, users, territories, areas, branches, flavors, inventory, analytics, cake, sales, budget, notification, expiry, visits, daily_brief, feedback, kpi, whatsapp
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

            # Add manager_id to branches if missing
            if 'manager_id' not in columns:
                logger.info("Migration: Adding manager_id to branches table")
                conn.execute(text("ALTER TABLE branches ADD COLUMN manager_id INTEGER REFERENCES users(id)"))
                conn.commit()
                logger.info("Migration: manager_id added successfully")

            # Add login_id and hashed_password to branches if missing
            if 'login_id' not in columns:
                logger.info("Migration: Adding login_id to branches table")
                conn.execute(text("ALTER TABLE branches ADD COLUMN login_id VARCHAR(100) UNIQUE"))
                conn.commit()
                logger.info("Migration: login_id added successfully")
            if 'hashed_password' not in columns:
                logger.info("Migration: Adding hashed_password to branches table")
                conn.execute(text("ALTER TABLE branches ADD COLUMN hashed_password VARCHAR(255)"))
                conn.commit()
                logger.info("Migration: hashed_password added successfully")

        # Add new columns to daily_sales if table exists
        if 'daily_sales' in inspector.get_table_names():
            ds_columns = [c['name'] for c in inspector.get_columns('daily_sales')]
            if 'gross_sales' not in ds_columns:
                logger.info("Migration: Adding gross_sales to daily_sales table")
                conn.execute(text("ALTER TABLE daily_sales ADD COLUMN gross_sales FLOAT DEFAULT 0"))
                conn.commit()
                logger.info("Migration: gross_sales added successfully")
            if 'cash_sales' not in ds_columns:
                logger.info("Migration: Adding cash_sales to daily_sales table")
                conn.execute(text("ALTER TABLE daily_sales ADD COLUMN cash_sales FLOAT DEFAULT 0"))
                conn.commit()
                logger.info("Migration: cash_sales added successfully")
            if 'category_data' not in ds_columns:
                logger.info("Migration: Adding category_data to daily_sales table")
                conn.execute(text("ALTER TABLE daily_sales ADD COLUMN category_data TEXT"))
                conn.commit()
                logger.info("Migration: category_data added successfully")

            # Home Delivery columns
            if 'hd_gross_sales' not in ds_columns:
                logger.info("Migration: Adding HD columns to daily_sales table")
                conn.execute(text("ALTER TABLE daily_sales ADD COLUMN hd_gross_sales FLOAT DEFAULT 0"))
                conn.execute(text("ALTER TABLE daily_sales ADD COLUMN hd_net_sales FLOAT DEFAULT 0"))
                conn.execute(text("ALTER TABLE daily_sales ADD COLUMN hd_orders INTEGER DEFAULT 0"))
                conn.execute(text("ALTER TABLE daily_sales ADD COLUMN hd_photo_url VARCHAR(500)"))
                conn.commit()
                logger.info("Migration: HD columns added successfully")

            # Manual POS entry columns
            if 'ly_sale' not in ds_columns:
                logger.info("Migration: Adding manual POS columns to daily_sales table")
                conn.execute(text("ALTER TABLE daily_sales ADD COLUMN ly_sale FLOAT DEFAULT 0"))
                conn.execute(text("ALTER TABLE daily_sales ADD COLUMN cake_units INTEGER DEFAULT 0"))
                conn.execute(text("ALTER TABLE daily_sales ADD COLUMN hand_pack_units INTEGER DEFAULT 0"))
                conn.execute(text("ALTER TABLE daily_sales ADD COLUMN sundae_pct FLOAT DEFAULT 0"))
                conn.execute(text("ALTER TABLE daily_sales ADD COLUMN cups_cones_pct FLOAT DEFAULT 0"))
                conn.commit()
                logger.info("Migration: Manual POS columns added successfully")

            # Deliveroo columns
            if 'deliveroo_photo_url' not in ds_columns:
                logger.info("Migration: Adding deliveroo_photo_url to daily_sales table")
                conn.execute(text("ALTER TABLE daily_sales ADD COLUMN deliveroo_photo_url VARCHAR(500)"))
                conn.commit()
                logger.info("Migration: deliveroo_photo_url added successfully")

            if 'deliveroo_gross_sales' not in ds_columns:
                logger.info("Migration: Adding Deliveroo numeric columns to daily_sales table")
                conn.execute(text("ALTER TABLE daily_sales ADD COLUMN deliveroo_gross_sales FLOAT DEFAULT 0"))
                conn.execute(text("ALTER TABLE daily_sales ADD COLUMN deliveroo_net_sales FLOAT DEFAULT 0"))
                conn.execute(text("ALTER TABLE daily_sales ADD COLUMN deliveroo_orders INTEGER DEFAULT 0"))
                conn.commit()
                logger.info("Migration: Deliveroo numeric columns added successfully")

            if 'items_data' not in ds_columns:
                logger.info("Migration: Adding items_data to daily_sales table")
                conn.execute(text("ALTER TABLE daily_sales ADD COLUMN items_data TEXT"))
                conn.commit()
                logger.info("Migration: items_data added successfully")

            if 'cash_gc' not in ds_columns:
                logger.info("Migration: Adding cash_gc and atv to daily_sales table")
                conn.execute(text("ALTER TABLE daily_sales ADD COLUMN cash_gc INTEGER DEFAULT 0"))
                conn.execute(text("ALTER TABLE daily_sales ADD COLUMN atv FLOAT DEFAULT 0"))
                conn.commit()
                logger.info("Migration: cash_gc and atv added successfully")

            # Cool Mood columns
            if 'cm_gross_sales' not in ds_columns:
                logger.info("Migration: Adding Cool Mood columns to daily_sales table")
                conn.execute(text("ALTER TABLE daily_sales ADD COLUMN cm_gross_sales FLOAT DEFAULT 0"))
                conn.execute(text("ALTER TABLE daily_sales ADD COLUMN cm_net_sales FLOAT DEFAULT 0"))
                conn.execute(text("ALTER TABLE daily_sales ADD COLUMN cm_orders INTEGER DEFAULT 0"))
                conn.commit()
                logger.info("Migration: Cool Mood columns added successfully")

        # Migrate daily_budgets table
        if 'daily_budgets' in inspector.get_table_names():
            db_columns = [c['name'] for c in inspector.get_columns('daily_budgets')]
            if 'day_name' not in db_columns:
                logger.info("Migration: Adding new columns to daily_budgets table")
                conn.execute(text("ALTER TABLE daily_budgets ADD COLUMN day_name VARCHAR(3)"))
                conn.execute(text("ALTER TABLE daily_budgets ADD COLUMN mtd_ly_sales FLOAT DEFAULT 0"))
                conn.execute(text("ALTER TABLE daily_budgets ADD COLUMN mtd_budget FLOAT DEFAULT 0"))
                conn.execute(text("ALTER TABLE daily_budgets ADD COLUMN ly_atv FLOAT DEFAULT 0"))
                conn.commit()
                logger.info("Migration: daily_budgets new columns added")

        # Migrate budget_uploads table
        if 'budget_uploads' in inspector.get_table_names():
            bu_columns = [c['name'] for c in inspector.get_columns('budget_uploads')]
            if 'parlor_name' not in bu_columns:
                logger.info("Migration: Adding new columns to budget_uploads table")
                conn.execute(text("ALTER TABLE budget_uploads ADD COLUMN parlor_name VARCHAR(100)"))
                conn.execute(text("ALTER TABLE budget_uploads ADD COLUMN area_manager VARCHAR(100)"))
                conn.execute(text("ALTER TABLE budget_uploads ADD COLUMN total_ly_sales FLOAT"))
                conn.execute(text("ALTER TABLE budget_uploads ADD COLUMN total_ly_gc INTEGER"))
                conn.execute(text("ALTER TABLE budget_uploads ADD COLUMN ly_atv FLOAT"))
                conn.execute(text("ALTER TABLE budget_uploads ADD COLUMN ly_auv FLOAT"))
                conn.execute(text("ALTER TABLE budget_uploads ADD COLUMN ly_cake_qty FLOAT"))
                conn.execute(text("ALTER TABLE budget_uploads ADD COLUMN ly_hp_qty FLOAT"))
                conn.execute(text("ALTER TABLE budget_uploads ADD COLUMN status VARCHAR(20) DEFAULT 'confirmed'"))
                conn.commit()
                logger.info("Migration: budget_uploads new columns added")

        # Migrate expiry_requests: add template file columns
        if 'expiry_requests' in inspector.get_table_names():
            er_cols = [c['name'] for c in inspector.get_columns('expiry_requests')]
            if 'template_file_data' not in er_cols:
                logger.info("Migration: Adding template_file_data to expiry_requests")
                conn.execute(text("ALTER TABLE expiry_requests ADD COLUMN template_file_data TEXT"))
                conn.commit()
            if 'template_filename' not in er_cols:
                logger.info("Migration: Adding template_filename to expiry_requests")
                conn.execute(text("ALTER TABLE expiry_requests ADD COLUMN template_filename VARCHAR(255)"))
                conn.commit()

        # Customer feedback table migration
        if 'branches' in inspector.get_table_names() and 'customer_feedback' not in inspector.get_table_names():
            # Table will be created by create_all, just log
            logger.info("customer_feedback table will be created by create_all")

        # Add customer_email and customer_phone to customer_feedback if missing
        if 'customer_feedback' in inspector.get_table_names():
            cf_cols = [c['name'] for c in inspector.get_columns('customer_feedback')]
            if 'customer_email' not in cf_cols:
                logger.info("Migration: Adding customer_email to customer_feedback")
                conn.execute(text("ALTER TABLE customer_feedback ADD COLUMN customer_email VARCHAR(200)"))
                conn.commit()
                logger.info("Migration: customer_email added successfully")
            if 'customer_phone' not in cf_cols:
                logger.info("Migration: Adding customer_phone to customer_feedback")
                conn.execute(text("ALTER TABLE customer_feedback ADD COLUMN customer_phone VARCHAR(30)"))
                conn.commit()
                logger.info("Migration: customer_phone added successfully")
            if 'served_by_user_id' not in cf_cols:
                logger.info("Migration: Adding served_by_user_id to customer_feedback")
                conn.execute(text("ALTER TABLE customer_feedback ADD COLUMN served_by_user_id INTEGER REFERENCES users(id)"))
                conn.commit()
                logger.info("Migration: served_by_user_id added successfully")
            if 'served_by_name' not in cf_cols:
                logger.info("Migration: Adding served_by_name to customer_feedback")
                conn.execute(text("ALTER TABLE customer_feedback ADD COLUMN served_by_name VARCHAR(100)"))
                conn.commit()
                logger.info("Migration: served_by_name added successfully")

        # Make push_subscriptions.branch_id nullable so admin/managers can subscribe
        if 'push_subscriptions' in inspector.get_table_names():
            try:
                conn.execute(text("ALTER TABLE push_subscriptions ALTER COLUMN branch_id DROP NOT NULL"))
                conn.commit()
                logger.info("Migration: push_subscriptions.branch_id is now nullable")
            except Exception:
                conn.rollback()  # Already nullable

        # Create custom_sales_windows table if it doesn't exist
        if 'custom_sales_windows' not in inspector.get_table_names() and 'branches' in inspector.get_table_names():
            logger.info("Migration: Creating custom_sales_windows table")
            conn.execute(text("""
                CREATE TABLE custom_sales_windows (
                    id SERIAL PRIMARY KEY,
                    branch_id INTEGER NOT NULL REFERENCES branches(id),
                    window_name VARCHAR(50) NOT NULL,
                    window_time TIME,
                    is_active BOOLEAN DEFAULT true,
                    created_by_id INTEGER NOT NULL REFERENCES users(id),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.execute(text("CREATE INDEX idx_custom_windows_branch ON custom_sales_windows(branch_id)"))
            conn.commit()
            logger.info("Migration: custom_sales_windows table created successfully")

        # Migrate expiry_responses quantity from INTEGER to FLOAT (support decimal like 1.25)
        if 'expiry_responses' in inspector.get_table_names():
            er_columns = {c['name']: c for c in inspector.get_columns('expiry_responses')}
            if 'quantity' in er_columns:
                col_type = str(er_columns['quantity']['type'])
                if 'INT' in col_type.upper() and 'FLOAT' not in col_type.upper():
                    logger.info("Migration: Changing expiry_responses.quantity from INTEGER to FLOAT")
                    conn.execute(text("ALTER TABLE expiry_responses ALTER COLUMN quantity TYPE DOUBLE PRECISION USING quantity::double precision"))
                    conn.commit()
                    logger.info("Migration: expiry_responses.quantity is now FLOAT")


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
    lifespan=lifespan,
    redirect_slashes=False
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
app.include_router(sales.router, prefix="/api/v1/sales", tags=["Sales"])
app.include_router(budget.router, prefix="/api/v1/budget", tags=["Budget"])
app.include_router(notification.router, prefix="/api/v1/notifications", tags=["Push Notifications"])
app.include_router(expiry.router, prefix="/api/v1/expiry", tags=["Expiry Tracking"])
app.include_router(visits.router, prefix="/api/v1/visits", tags=["Branch Visits"])
app.include_router(daily_brief.router, prefix="/api/v1/reports", tags=["Daily Brief"])
app.include_router(feedback.router, prefix="/api/v1/feedback", tags=["Feedback"])
app.include_router(kpi.router, prefix="/api/v1/reports", tags=["KPI"])
app.include_router(whatsapp.router, prefix="/api/v1/whatsapp", tags=["WhatsApp"])


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
