"""
Seed script for Baskin Robbins cake products
Run: python scripts/seed_cakes.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.database import SessionLocal, engine, Base
from models.cake import CakeProduct

CAKE_PRODUCTS = [
    {"name": "Chocolate Fudge Cake", "code": "CHOC-FUDGE", "category": "Classic", "default_alert_threshold": 2},
    {"name": "Vanilla Ice Cream Cake", "code": "VAN-IC-CAKE", "category": "Classic", "default_alert_threshold": 2},
    {"name": "Strawberry Shortcake", "code": "STRAW-SHORT", "category": "Classic", "default_alert_threshold": 2},
    {"name": "Cookies & Cream Cake", "code": "COOK-CREAM", "category": "Classic", "default_alert_threshold": 2},
    {"name": "Pralines & Cream Cake", "code": "PRAL-CREAM", "category": "Premium", "default_alert_threshold": 2},
    {"name": "Mint Chocolate Chip Cake", "code": "MINT-CHOC", "category": "Classic", "default_alert_threshold": 2},
    {"name": "Rainbow Sherbet Cake", "code": "RAIN-SHER", "category": "Seasonal", "default_alert_threshold": 1},
    {"name": "Oreo Cookies Cake", "code": "OREO-CAKE", "category": "Premium", "default_alert_threshold": 2},
    {"name": "Caramel Ribbon Cake", "code": "CARM-RIBB", "category": "Premium", "default_alert_threshold": 2},
    {"name": "Mango Tango Cake", "code": "MANGO-TANG", "category": "Seasonal", "default_alert_threshold": 1},
    {"name": "Red Velvet Cake", "code": "RED-VELVET", "category": "Premium", "default_alert_threshold": 2},
    {"name": "Tiramisu Cake", "code": "TIRAMISU", "category": "Premium", "default_alert_threshold": 1},
    {"name": "Birthday Cake", "code": "BDAY-CAKE", "category": "Classic", "default_alert_threshold": 3},
    {"name": "Brownie Sundae Cake", "code": "BROWN-SUND", "category": "Premium", "default_alert_threshold": 2},
    {"name": "Cotton Candy Cake", "code": "COTT-CANDY", "category": "Seasonal", "default_alert_threshold": 1},
    {"name": "Peanut Butter Cake", "code": "PB-CAKE", "category": "Classic", "default_alert_threshold": 2},
    {"name": "Jamoca Almond Fudge Cake", "code": "JAM-ALM", "category": "Premium", "default_alert_threshold": 1},
    {"name": "World Class Chocolate Cake", "code": "WC-CHOC", "category": "Premium", "default_alert_threshold": 2},
    {"name": "Very Berry Strawberry Cake", "code": "VB-STRAW", "category": "Classic", "default_alert_threshold": 2},
    {"name": "Gold Medal Ribbon Cake", "code": "GOLD-MED", "category": "Classic", "default_alert_threshold": 2},
]


def seed_cakes():
    db = SessionLocal()
    try:
        created = 0
        skipped = 0
        for cake_data in CAKE_PRODUCTS:
            existing = db.query(CakeProduct).filter(CakeProduct.code == cake_data["code"]).first()
            if existing:
                skipped += 1
                continue
            cake = CakeProduct(**cake_data)
            db.add(cake)
            created += 1

        db.commit()
        print(f"Cake products seeded: {created} created, {skipped} skipped (already exist)")
    except Exception as e:
        db.rollback()
        print(f"Error seeding cakes: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_cakes()
