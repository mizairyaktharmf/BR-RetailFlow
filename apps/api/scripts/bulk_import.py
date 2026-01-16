"""
Bulk Import Script for BR-RetailFlow
=====================================
Import territories, areas, branches, and users from Excel/CSV files.

Usage:
    python bulk_import.py --file branches.xlsx
    python bulk_import.py --file branches.csv
    python bulk_import.py --sample  # Generate sample Excel template

Excel Format:
    Territory | Area | Branch Name | Branch Code | Address | Phone | Steward Name | Steward Email
    Dubai     | Karama | Karama Center | KRM-01 | Shop 12, Mall | +971-4-123-4567 | Ahmed Hassan | ahmed@email.com
"""

import os
import sys
import argparse
import random
import string
from datetime import datetime

# For Excel support
try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False
    print("Warning: pandas not installed. Run: pip install pandas openpyxl")

# Database connection (when running with real DB)
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/br_retailflow")


def generate_password(length=8):
    """Generate a random password"""
    chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    return ''.join(random.choice(chars) for _ in range(length))


def generate_branch_id(existing_ids, prefix="BR"):
    """Generate unique branch ID"""
    max_num = 0
    for bid in existing_ids:
        if bid.startswith(prefix):
            try:
                num = int(bid[len(prefix):])
                if num > max_num:
                    max_num = num
            except ValueError:
                pass
    return f"{prefix}{str(max_num + 1).zfill(3)}"


def create_sample_template(output_file="sample_branches.xlsx"):
    """Create a sample Excel template"""
    if not PANDAS_AVAILABLE:
        print("Error: pandas required. Run: pip install pandas openpyxl")
        return

    sample_data = {
        'Territory': ['Dubai', 'Dubai', 'Dubai', 'Abu Dhabi', 'Abu Dhabi', 'Sharjah'],
        'Area': ['Karama', 'Karama', 'Deira', 'Khalidiya', 'Al Wahda', 'Al Majaz'],
        'Branch Name': ['Karama Center', 'Karama Mall', 'Deira City Centre', 'Khalidiya Mall', 'Al Wahda Mall', 'Al Majaz Waterfront'],
        'Branch Code': ['KRM-01', 'KRM-02', 'DRA-01', 'KHL-01', 'WHD-01', 'MJZ-01'],
        'Address': ['Shop 12, Karama Shopping Complex', 'Ground Floor, Karama Mall', 'Food Court, DCC', 'Level 1, Khalidiya Mall', 'Ground Floor, Al Wahda', 'Shop 5, Al Majaz'],
        'Phone': ['+971-4-123-4567', '+971-4-123-4568', '+971-4-234-5670', '+971-2-456-7890', '+971-2-456-7891', '+971-6-567-8901'],
        'Steward Name': ['Ahmed Hassan', 'Fatima Ali', 'Omar Khan', 'Sara Mohammed', 'Khalid Ibrahim', 'Layla Ahmed'],
        'Steward Email': ['ahmed@example.com', 'fatima@example.com', 'omar@example.com', 'sara@example.com', 'khalid@example.com', 'layla@example.com'],
    }

    df = pd.DataFrame(sample_data)
    df.to_excel(output_file, index=False)
    print(f"✓ Sample template created: {output_file}")
    print(f"  - Fill in your 1000 branches and run:")
    print(f"    python bulk_import.py --file {output_file}")


def import_from_file(file_path, dry_run=True):
    """Import data from Excel/CSV file"""
    if not PANDAS_AVAILABLE:
        print("Error: pandas required. Run: pip install pandas openpyxl")
        return

    # Read file
    if file_path.endswith('.xlsx') or file_path.endswith('.xls'):
        df = pd.read_excel(file_path)
    elif file_path.endswith('.csv'):
        df = pd.read_csv(file_path)
    else:
        print(f"Error: Unsupported file format. Use .xlsx, .xls, or .csv")
        return

    print(f"\n📂 Reading: {file_path}")
    print(f"   Found {len(df)} rows\n")

    # Process data
    territories = {}
    areas = {}
    branches = []
    users = []
    existing_branch_ids = set()

    for idx, row in df.iterrows():
        territory_name = str(row.get('Territory', '')).strip()
        area_name = str(row.get('Area', '')).strip()
        branch_name = str(row.get('Branch Name', '')).strip()
        branch_code = str(row.get('Branch Code', '')).strip()
        address = str(row.get('Address', '')).strip()
        phone = str(row.get('Phone', '')).strip()
        steward_name = str(row.get('Steward Name', '')).strip()
        steward_email = str(row.get('Steward Email', '')).strip()

        if not territory_name or not area_name or not branch_name:
            print(f"   ⚠️  Row {idx + 2}: Missing required fields (Territory, Area, Branch Name)")
            continue

        # Territory
        if territory_name not in territories:
            territory_code = ''.join(word[0] for word in territory_name.split()[:3]).upper()
            territories[territory_name] = {
                'name': territory_name,
                'code': territory_code[:5],
            }

        # Area
        area_key = f"{territory_name}|{area_name}"
        if area_key not in areas:
            area_code = ''.join(word[0] for word in area_name.split()[:3]).upper()
            areas[area_key] = {
                'name': area_name,
                'code': area_code[:5],
                'territory': territory_name,
            }

        # Branch
        branch_id = generate_branch_id(existing_branch_ids)
        existing_branch_ids.add(branch_id)

        password = generate_password()

        branches.append({
            'branch_id': branch_id,
            'name': branch_name,
            'code': branch_code or f"{areas[area_key]['code']}-{len([b for b in branches if b['area'] == area_name]) + 1:02d}",
            'territory': territory_name,
            'area': area_name,
            'address': address if address != 'nan' else '',
            'phone': phone if phone != 'nan' else '',
        })

        # Steward
        if steward_name and steward_name != 'nan':
            users.append({
                'username': branch_id,  # Branch ID is the login
                'password': password,
                'full_name': steward_name,
                'email': steward_email if steward_email != 'nan' else f"{branch_id.lower()}@br-retailflow.com",
                'role': 'staff',
                'branch_id': branch_id,
                'branch_name': branch_name,
                'territory': territory_name,
                'area': area_name,
            })

    # Summary
    print("=" * 60)
    print("📊 IMPORT SUMMARY")
    print("=" * 60)
    print(f"\n🌍 Territories: {len(territories)}")
    for t in territories.values():
        print(f"   - {t['name']} ({t['code']})")

    print(f"\n📍 Areas: {len(areas)}")
    for a in areas.values():
        print(f"   - {a['name']} ({a['code']}) → {a['territory']}")

    print(f"\n🏪 Branches: {len(branches)}")
    print(f"\n👤 Stewards: {len(users)}")

    if dry_run:
        print("\n" + "=" * 60)
        print("🔍 DRY RUN MODE - No changes made")
        print("   Run with --execute to apply changes")
        print("=" * 60)

        # Generate credentials file
        credentials_file = file_path.rsplit('.', 1)[0] + '_credentials.csv'
        creds_df = pd.DataFrame([{
            'Branch ID (Login)': u['username'],
            'Password': u['password'],
            'Steward Name': u['full_name'],
            'Branch Name': u['branch_name'],
            'Area': u['area'],
            'Territory': u['territory'],
        } for u in users])
        creds_df.to_csv(credentials_file, index=False)
        print(f"\n📄 Credentials saved to: {credentials_file}")
        print("   Share this file with branch managers to distribute logins")
    else:
        print("\n" + "=" * 60)
        print("🚀 EXECUTING IMPORT...")
        print("=" * 60)
        # Here you would insert into database
        # For now, just save to JSON for API import
        import json

        output_data = {
            'territories': list(territories.values()),
            'areas': list(areas.values()),
            'branches': branches,
            'users': users,
            'generated_at': datetime.now().isoformat(),
        }

        output_file = file_path.rsplit('.', 1)[0] + '_import_data.json'
        with open(output_file, 'w') as f:
            json.dump(output_data, f, indent=2)

        print(f"\n✓ Data exported to: {output_file}")
        print("   Upload this to your API endpoint: POST /api/v1/admin/bulk-import")

    return {
        'territories': territories,
        'areas': areas,
        'branches': branches,
        'users': users,
    }


def main():
    parser = argparse.ArgumentParser(description='Bulk import branches for BR-RetailFlow')
    parser.add_argument('--file', '-f', help='Excel or CSV file to import')
    parser.add_argument('--sample', '-s', action='store_true', help='Generate sample template')
    parser.add_argument('--execute', '-e', action='store_true', help='Execute import (default is dry-run)')
    parser.add_argument('--output', '-o', default='sample_branches.xlsx', help='Output file for sample')

    args = parser.parse_args()

    if args.sample:
        create_sample_template(args.output)
    elif args.file:
        if not os.path.exists(args.file):
            print(f"Error: File not found: {args.file}")
            sys.exit(1)
        import_from_file(args.file, dry_run=not args.execute)
    else:
        parser.print_help()
        print("\n📌 Quick Start:")
        print("   1. Generate template:  python bulk_import.py --sample")
        print("   2. Fill in branches in Excel")
        print("   3. Preview import:     python bulk_import.py --file branches.xlsx")
        print("   4. Execute import:     python bulk_import.py --file branches.xlsx --execute")


if __name__ == '__main__':
    main()
