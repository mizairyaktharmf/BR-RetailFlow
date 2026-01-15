"""
Database seeding script
Creates initial data for testing and development
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.database import SessionLocal, engine, Base
from utils.security import get_password_hash
from models.user import User, UserRole
from models.location import Territory, Area, Branch
from models.inventory import Flavor


def seed_database():
    """Seed the database with initial data"""

    # Create tables
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        # Check if data already exists
        if db.query(User).first():
            print("Database already seeded. Skipping...")
            return

        print("Seeding database...")

        # ============== TERRITORIES ==============
        print("Creating territories...")
        dubai = Territory(name="Dubai", code="DUBAI", description="Dubai Emirate")
        abudhabi = Territory(name="Abu Dhabi", code="ABU-DHABI", description="Abu Dhabi Emirate")
        sharjah = Territory(name="Sharjah", code="SHARJAH", description="Sharjah Emirate")

        db.add_all([dubai, abudhabi, sharjah])
        db.flush()

        # ============== AREAS ==============
        print("Creating areas...")
        # Dubai areas
        karama = Area(name="Karama", code="DXB-KARAMA", territory_id=dubai.id)
        deira = Area(name="Deira", code="DXB-DEIRA", territory_id=dubai.id)
        marina = Area(name="Dubai Marina", code="DXB-MARINA", territory_id=dubai.id)

        # Abu Dhabi areas
        khalifa = Area(name="Khalifa City", code="AUH-KHALIFA", territory_id=abudhabi.id)
        corniche = Area(name="Corniche", code="AUH-CORNICHE", territory_id=abudhabi.id)

        db.add_all([karama, deira, marina, khalifa, corniche])
        db.flush()

        # ============== BRANCHES ==============
        print("Creating branches...")
        branches = [
            Branch(name="Karama Centre", code="BR-KRM-001", area_id=karama.id, address="Karama Centre, Dubai"),
            Branch(name="Karama Mall", code="BR-KRM-002", area_id=karama.id, address="Karama Mall, Dubai"),
            Branch(name="Deira City Centre", code="BR-DEI-001", area_id=deira.id, address="Deira City Centre, Dubai"),
            Branch(name="Marina Mall", code="BR-MAR-001", area_id=marina.id, address="Marina Mall, Dubai"),
            Branch(name="Khalifa Mall", code="BR-KHL-001", area_id=khalifa.id, address="Khalifa City Mall, Abu Dhabi"),
            Branch(name="Corniche Tower", code="BR-COR-001", area_id=corniche.id, address="Corniche Road, Abu Dhabi"),
        ]
        db.add_all(branches)
        db.flush()

        # ============== USERS ==============
        print("Creating users...")

        # Supreme Admin (Office)
        supreme_admin = User(
            email="admin@br-retailflow.com",
            username="supreme_admin",
            hashed_password=get_password_hash("admin123"),
            full_name="System Administrator",
            role=UserRole.SUPREME_ADMIN,
            is_verified=True
        )

        # Super Admin (Territory Manager - Dubai)
        super_admin_dubai = User(
            email="tm.dubai@br-retailflow.com",
            username="tm_dubai",
            hashed_password=get_password_hash("admin123"),
            full_name="Dubai Territory Manager",
            role=UserRole.SUPER_ADMIN,
            territory_id=dubai.id,
            is_verified=True
        )

        # Admin (Area Manager - Karama)
        admin_karama = User(
            email="am.karama@br-retailflow.com",
            username="am_karama",
            hashed_password=get_password_hash("admin123"),
            full_name="Karama Area Manager",
            role=UserRole.ADMIN,
            area_id=karama.id,
            territory_id=dubai.id,
            is_verified=True
        )

        # Staff (Steward - Karama Centre)
        staff_karama = User(
            email="steward.karama@br-retailflow.com",
            username="steward_karama",
            hashed_password=get_password_hash("staff123"),
            full_name="Karama Centre Steward",
            role=UserRole.STAFF,
            branch_id=branches[0].id,
            area_id=karama.id,
            territory_id=dubai.id,
            is_verified=True
        )

        db.add_all([supreme_admin, super_admin_dubai, admin_karama, staff_karama])
        db.flush()

        # ============== FLAVORS ==============
        print("Creating flavors...")
        flavors = [
            # Classic Flavors
            Flavor(name="Vanilla", code="VANILLA", category="Classic"),
            Flavor(name="Chocolate", code="CHOCOLATE", category="Classic"),
            Flavor(name="Strawberry", code="STRAWBERRY", category="Classic"),
            Flavor(name="Mint Chocolate Chip", code="MINT-CHOC", category="Classic"),
            Flavor(name="Cookies and Cream", code="COOKIES-CREAM", category="Classic"),
            Flavor(name="Pralines and Cream", code="PRALINES", category="Classic"),
            Flavor(name="Jamoca Almond Fudge", code="JAMOCA", category="Classic"),
            Flavor(name="Rocky Road", code="ROCKY-ROAD", category="Classic"),
            Flavor(name="Butter Pecan", code="BUTTER-PECAN", category="Classic"),
            Flavor(name="Pistachio Almond", code="PISTACHIO", category="Classic"),

            # Premium Flavors
            Flavor(name="Gold Medal Ribbon", code="GOLD-MEDAL", category="Premium"),
            Flavor(name="World Class Chocolate", code="WORLD-CHOC", category="Premium"),
            Flavor(name="Peanut Butter and Chocolate", code="PB-CHOC", category="Premium"),
            Flavor(name="Cheesecake", code="CHEESECAKE", category="Premium"),
            Flavor(name="Cotton Candy", code="COTTON-CANDY", category="Premium"),

            # Fruit Flavors
            Flavor(name="Mango", code="MANGO", category="Fruit"),
            Flavor(name="Watermelon Splash", code="WATERMELON", category="Fruit"),
            Flavor(name="Lemon Custard", code="LEMON", category="Fruit"),
            Flavor(name="Orange Sherbet", code="ORANGE-SHERBET", category="Fruit"),
            Flavor(name="Rainbow Sherbet", code="RAINBOW-SHERBET", category="Fruit"),

            # Specialty Flavors
            Flavor(name="Daiquiri Ice", code="DAIQUIRI", category="Specialty"),
            Flavor(name="Very Berry Strawberry", code="BERRY-STRAW", category="Specialty"),
            Flavor(name="Chocolate Chip Cookie Dough", code="COOKIE-DOUGH", category="Specialty"),
            Flavor(name="Reese's Peanut Butter Cup", code="REESES", category="Specialty"),
            Flavor(name="Oreo Cookies and Cream", code="OREO", category="Specialty"),

            # Seasonal/Limited
            Flavor(name="Pumpkin Cheesecake", code="PUMPKIN", category="Seasonal"),
            Flavor(name="Peppermint", code="PEPPERMINT", category="Seasonal"),
            Flavor(name="Eggnog", code="EGGNOG", category="Seasonal"),
            Flavor(name="Winter White Chocolate", code="WHITE-CHOC", category="Seasonal"),
            Flavor(name="Love Potion #31", code="LOVE-POTION", category="Seasonal"),

            # Regional Favorites
            Flavor(name="Saffron Pistachio", code="SAFFRON-PIST", category="Regional"),
            Flavor(name="Date Honey", code="DATE-HONEY", category="Regional"),
            Flavor(name="Arabic Coffee", code="ARABIC-COFFEE", category="Regional"),
            Flavor(name="Rose Kulfi", code="ROSE-KULFI", category="Regional"),
            Flavor(name="Cardamom", code="CARDAMOM", category="Regional"),
        ]

        db.add_all(flavors)
        db.commit()

        print("\n" + "="*50)
        print("Database seeded successfully!")
        print("="*50)
        print("\nTest Accounts:")
        print("-"*50)
        print("Supreme Admin: supreme_admin / admin123")
        print("Territory Manager (Dubai): tm_dubai / admin123")
        print("Area Manager (Karama): am_karama / admin123")
        print("Steward (Karama Centre): steward_karama / staff123")
        print("-"*50)
        print(f"\nCreated:")
        print(f"  - 3 Territories")
        print(f"  - 5 Areas")
        print(f"  - 6 Branches")
        print(f"  - 4 Users")
        print(f"  - {len(flavors)} Flavors")

    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
