"""
Sales router
Handles daily sales submissions, photo uploads, and OCR extraction
Parses Baskin Robbins POS receipt format
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from datetime import date, datetime
import os
import uuid
import re
import io
import json
import logging

from utils.database import get_db
from utils.security import get_current_user
from models.user import User
from models.location import Branch
from models.sales import DailySales, SalesWindowType
from schemas.sales import (
    DailySalesCreate,
    DailySalesResponse,
    SalesExtractionResponse,
    PhotoUploadResponse,
    CategorySales,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# Upload directory for sales photos
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "sales")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ============== DAILY SALES ==============

@router.post("/daily", response_model=DailySalesResponse)
async def submit_daily_sales(
    data: DailySalesCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit a daily sales report for a specific window"""
    branch = db.query(Branch).filter(Branch.id == data.branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    window_map = {
        "3pm": SalesWindowType.WINDOW_3PM,
        "7pm": SalesWindowType.WINDOW_7PM,
        "9pm": SalesWindowType.WINDOW_9PM,
        "closing": SalesWindowType.CLOSING,
    }
    window_enum = window_map.get(data.sales_window)
    if not window_enum:
        raise HTTPException(status_code=400, detail=f"Invalid sales window: {data.sales_window}")

    existing = db.query(DailySales).filter(
        and_(
            DailySales.branch_id == data.branch_id,
            DailySales.date == data.date,
            DailySales.sales_window == window_enum,
        )
    ).first()

    if existing:
        existing.total_sales = data.total_sales
        existing.transaction_count = data.transaction_count
        if data.gross_sales:
            existing.gross_sales = data.gross_sales
        if hasattr(existing, 'cash_sales') and data.cash_sales:
            existing.cash_sales = data.cash_sales
        if hasattr(existing, 'category_data') and data.category_data:
            existing.category_data = data.category_data
        if data.photo_url:
            existing.photo_url = data.photo_url
        if data.notes:
            existing.notes = data.notes
        db.commit()
        db.refresh(existing)

        return DailySalesResponse(
            id=existing.id,
            branch_id=existing.branch_id,
            date=existing.date,
            sales_window=existing.sales_window.value,
            gross_sales=existing.gross_sales,
            total_sales=existing.total_sales,
            transaction_count=existing.transaction_count,
            cash_sales=getattr(existing, 'cash_sales', None),
            category_data=getattr(existing, 'category_data', None),
            photo_url=existing.photo_url,
            notes=existing.notes,
            submitted_by_id=existing.submitted_by_id,
            created_at=existing.created_at,
        )

    sales_entry = DailySales(
        branch_id=data.branch_id,
        date=data.date,
        sales_window=window_enum,
        total_sales=data.total_sales,
        transaction_count=data.transaction_count,
        photo_url=data.photo_url,
        notes=data.notes,
        submitted_by_id=current_user.id,
    )

    if hasattr(sales_entry, 'gross_sales') and data.gross_sales:
        sales_entry.gross_sales = data.gross_sales
    if hasattr(sales_entry, 'cash_sales') and data.cash_sales:
        sales_entry.cash_sales = data.cash_sales
    if hasattr(sales_entry, 'category_data') and data.category_data:
        sales_entry.category_data = data.category_data

    db.add(sales_entry)
    db.commit()
    db.refresh(sales_entry)

    return DailySalesResponse(
        id=sales_entry.id,
        branch_id=sales_entry.branch_id,
        date=sales_entry.date,
        sales_window=sales_entry.sales_window.value,
        gross_sales=getattr(sales_entry, 'gross_sales', None),
        total_sales=sales_entry.total_sales,
        transaction_count=sales_entry.transaction_count,
        cash_sales=getattr(sales_entry, 'cash_sales', None),
        category_data=getattr(sales_entry, 'category_data', None),
        photo_url=sales_entry.photo_url,
        notes=sales_entry.notes,
        submitted_by_id=sales_entry.submitted_by_id,
        created_at=sales_entry.created_at,
    )


@router.get("/daily", response_model=List[DailySalesResponse])
async def get_daily_sales(
    branch_id: int,
    date: date,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get daily sales for a branch on a specific date"""
    sales = db.query(DailySales).filter(
        and_(
            DailySales.branch_id == branch_id,
            DailySales.date == date,
        )
    ).order_by(DailySales.created_at).all()

    return [
        DailySalesResponse(
            id=s.id,
            branch_id=s.branch_id,
            date=s.date,
            sales_window=s.sales_window.value,
            gross_sales=getattr(s, 'gross_sales', None),
            total_sales=s.total_sales,
            transaction_count=s.transaction_count,
            cash_sales=getattr(s, 'cash_sales', None),
            category_data=getattr(s, 'category_data', None),
            photo_url=s.photo_url,
            notes=s.notes,
            submitted_by_id=s.submitted_by_id,
            created_at=s.created_at,
        )
        for s in sales
    ]


# ============== PHOTO UPLOAD ==============

@router.post("/upload-photo", response_model=PhotoUploadResponse)
async def upload_sales_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload a sales photo"""
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/heic"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Use JPEG, PNG, or WebP.")

    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    return PhotoUploadResponse(
        url=f"/uploads/sales/{filename}",
        filename=filename,
    )


# ============== OCR EXTRACTION ==============

def extract_branch_name(text: str) -> Optional[str]:
    """Extract branch name from BR POS receipt header"""
    lines = text.split('\n')

    for line in lines[:15]:
        line = line.strip()
        if not line or len(line) < 3:
            continue
        # Skip BR logo, separators, date lines, report type lines
        lower = line.lower()
        if any(skip in lower for skip in [
            'baskin', 'robbins', 'date:', 'tm:', 'spot sales',
            '====', '****', '----',
        ]):
            continue
        # Branch name often starts with IBQ or is a location name
        # It's usually the first meaningful non-logo line
        if re.match(r'^[A-Z\s/&\-\.]+$', line) and len(line) > 3:
            return line.strip()
        if lower.startswith('ibq') or lower.startswith('br '):
            return line.strip()

    return None


def check_branch_match(receipt_name: str, db_branch_name: str) -> bool:
    """Fuzzy match branch name from receipt against database branch name"""
    if not receipt_name or not db_branch_name:
        return False

    receipt_clean = receipt_name.lower().strip()
    db_clean = db_branch_name.lower().strip()

    # Remove common prefixes
    for prefix in ['ibq ', 'br ', 'baskin robbins ']:
        receipt_clean = receipt_clean.replace(prefix, '')
        db_clean = db_clean.replace(prefix, '')

    # Remove extra whitespace
    receipt_clean = ' '.join(receipt_clean.split())
    db_clean = ' '.join(db_clean.split())

    # Exact match
    if receipt_clean == db_clean:
        return True

    # One contains the other
    if receipt_clean in db_clean or db_clean in receipt_clean:
        return True

    # Check if key words match (e.g. "lamcy" in both)
    receipt_words = set(receipt_clean.split())
    db_words = set(db_clean.split())
    # Remove small words
    receipt_words = {w for w in receipt_words if len(w) > 2}
    db_words = {w for w in db_words if len(w) > 2}

    if receipt_words and db_words:
        overlap = receipt_words & db_words
        if len(overlap) >= 1:
            return True

    return False


def parse_br_pos_receipt(text: str) -> dict:
    """
    Parse Baskin Robbins POS receipt text.
    Extracts: gross sales, net sales, guest count (GC), cash sales,
    and category sales breakdown (Cups & Cones, Sundaes, etc.)
    """
    result = {
        "gross_sales": None,
        "net_sales": None,
        "guest_count": None,
        "cash_sales": None,
        "categories": [],
    }

    lines = text.split('\n')
    section = "header"  # header, summary, cash, credit, telabat, ewallet, category

    for line in lines:
        stripped = line.strip()
        lower = stripped.lower()

        if not stripped:
            continue

        # Detect section changes
        if 'sales summary' in lower and 'category' not in lower and 'item' not in lower:
            section = "summary"
            continue
        elif re.match(r'^cash\s+sales?\s*$', lower) or lower == 'cash sales':
            section = "cash"
            continue
        elif lower.startswith('cr. sales') or lower.startswith('cr.sales'):
            section = "credit"
            continue
        elif 'telabat' in lower and 'cr' in lower:
            section = "telabat"
            continue
        elif lower.startswith('ew. sales') or lower.startswith('ewallet'):
            section = "ewallet"
            continue
        elif 'category sales summary' in lower:
            section = "category"
            continue
        elif 'item sales summary' in lower:
            section = "item"
            continue

        # ---- SALES SUMMARY SECTION ----
        if section == "summary":
            # Gross Sales: 1,333.31  GC: 32
            if lower.startswith('gross sale'):
                numbers = re.findall(r'[\d,]+\.?\d*', stripped)
                if numbers:
                    result["gross_sales"] = numbers[0].replace(',', '')
                # Check for GC on same line
                gc_match = re.search(r'gc[:\s]+(\d+)', lower)
                if gc_match:
                    result["guest_count"] = gc_match.group(1)

            # Net Sales..: 1,314.46
            elif 'net sale' in lower:
                numbers = re.findall(r'[\d,]+\.?\d*', stripped)
                if numbers:
                    result["net_sales"] = numbers[0].replace(',', '')

            # GC on its own line or after other values
            if result["guest_count"] is None:
                gc_match = re.search(r'gc[:\s]+(\d+)', lower)
                if gc_match:
                    result["guest_count"] = gc_match.group(1)

        # ---- CASH SECTION ----
        elif section == "cash":
            # Cash Sales : 40.96 or Cash Sale: 40.96
            if lower.startswith('cash sale'):
                numbers = re.findall(r'[\d,]+\.?\d*', stripped)
                if numbers:
                    val = numbers[0].replace(',', '')
                    if float(val) > 0:
                        result["cash_sales"] = val

        # ---- CATEGORY SALES SUMMARY ----
        elif section == "category":
            # Skip header line "DESCRIPTION QTY SALES %CONT"
            if 'description' in lower or stripped.startswith('=') or stripped.startswith('-'):
                continue

            # Parse: "Cups & Cones    31   468.54  35.1"
            # or "TOTAL SALES     82 1,333.31  100"
            numbers = re.findall(r'[\d,]+\.?\d*', stripped)
            if len(numbers) >= 2:
                # Extract the name part (everything before the first number)
                first_num_pos = re.search(r'\d', stripped)
                if first_num_pos:
                    name = stripped[:first_num_pos.start()].strip()
                    if name and name.lower() != 'total sales':
                        try:
                            qty = int(numbers[0].replace(',', ''))
                            sales_val = float(numbers[1].replace(',', ''))
                            pct = float(numbers[2].replace(',', '')) if len(numbers) >= 3 else 0
                            result["categories"].append({
                                "name": name,
                                "qty": qty,
                                "sales": sales_val,
                                "pct": pct,
                            })
                        except (ValueError, IndexError):
                            pass

    return result


@router.post("/extract-from-photos", response_model=SalesExtractionResponse)
async def extract_sales_from_photos(
    files: List[UploadFile] = File(...),
    branch_name: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
):
    """
    Extract sales data from BR POS receipt photos.
    Verifies branch name matches the logged-in branch.
    """
    all_text = ""
    confidence = "low"

    try:
        import pytesseract
        from PIL import Image

        for file in files:
            content = await file.read()
            image = Image.open(io.BytesIO(content))

            if image.mode != 'RGB':
                image = image.convert('RGB')

            text = pytesseract.image_to_string(image)
            all_text += text + "\n"

        if all_text.strip():
            confidence = "medium"

    except ImportError:
        logger.warning("pytesseract not installed. OCR extraction unavailable.")
        return SalesExtractionResponse(
            branch_name=None,
            branch_match=True,
            confidence="none",
        )
    except Exception as e:
        logger.error(f"OCR extraction error: {e}")
        return SalesExtractionResponse(
            branch_name=None,
            branch_match=True,
            confidence="none",
        )

    # Extract branch name from receipt
    receipt_branch = extract_branch_name(all_text)

    # Check branch match
    branch_matched = False
    if receipt_branch and branch_name:
        branch_matched = check_branch_match(receipt_branch, branch_name)

    # Parse the receipt data
    parsed = parse_br_pos_receipt(all_text)

    # Build categories list
    categories = [
        CategorySales(
            name=cat["name"],
            qty=cat["qty"],
            sales=cat["sales"],
            pct=cat["pct"],
        )
        for cat in parsed["categories"]
    ]

    # Determine confidence
    found_count = sum(1 for k in ["gross_sales", "net_sales", "guest_count"] if parsed[k] is not None)
    if found_count >= 3 and len(categories) > 0:
        confidence = "high"
    elif found_count >= 2:
        confidence = "medium"

    return SalesExtractionResponse(
        branch_name=receipt_branch,
        branch_match=branch_matched,
        gross_sales=parsed["gross_sales"],
        net_sales=parsed["net_sales"],
        guest_count=parsed["guest_count"],
        cash_sales=parsed["cash_sales"],
        categories=categories,
        confidence=confidence,
    )
