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
    """Extract branch name from BR POS receipt header.
    OCR often misreads IBQ as 1BQ, 1B, lBQ etc. Handle all variants.
    """
    lines = text.split('\n')

    # Strategy 1: Look for IBQ/1BQ/1B pattern followed by branch name
    for line in lines[:25]:
        cleaned = re.sub(r'[^\x20-\x7E]', '', line).strip()
        if not cleaned or len(cleaned) < 3:
            continue

        # Match IBQ/1BQ/1B/lBQ followed by branch name
        # OCR reads "IBQ" as "1BQ", "1B", "lBQ", "IBQ" etc.
        ibq_match = re.search(r'(?:IBQ|1BQ|1B|lBQ|iB[Q0O])\s+(.+)', cleaned, re.IGNORECASE)
        if ibq_match:
            # Return the full match including prefix for branch matching
            branch = ibq_match.group(0).strip()
            # Clean trailing OCR noise (random chars after branch name)
            branch = re.sub(r'\s+[a-z]{1,3}\s*$', '', branch)  # remove trailing short lowercase words
            logger.info(f"Branch name extracted (IBQ pattern): {branch}")
            return branch

    # Strategy 2: Search all lines for known location keywords
    # Common BR UAE branch location names
    location_keywords = [
        'lamcy', 'lancy', 'residence', 'karama', 'deira', 'marina',
        'mall', 'plaza', 'center', 'centre', 'city', 'tower',
        'trade', 'jumeirah', 'barsha', 'nahda', 'sharjah', 'ajman',
        'fujairah', 'khalifa', 'reem', 'musaffah', 'corniche',
        'mirdif', 'silicon', 'springs', 'meadows', 'jlt', 'jbr',
        'motor', 'festival', 'ibn battuta', 'battuta', 'outlet',
    ]
    for line in lines[:20]:
        cleaned = re.sub(r'[^\x20-\x7E]', '', line).strip()
        if not cleaned or len(cleaned) < 5:
            continue
        lower = cleaned.lower()
        # Skip header/data lines
        if any(skip in lower for skip in [
            'baskin', 'robbins', 'date:', 'tm:', 'spot sales',
            '====', '****', '----', 'cash', 'gross', 'net ',
            'sales summary', 'returns', 'discount', 'total',
        ]):
            continue
        # Check if line contains a location keyword
        for kw in location_keywords:
            if kw in lower and len(cleaned) > 5:
                # Extract just the meaningful uppercase part
                # Remove leading noise characters
                name = re.sub(r'^[^A-Z]*', '', cleaned).strip()
                if name and len(name) > 4:
                    name = re.sub(r'\s+[a-z]{1,3}\s*$', '', name)  # clean trailing noise
                    logger.info(f"Branch name extracted (location keyword '{kw}'): {name}")
                    return name

    # Strategy 3: Look for clean uppercase lines that aren't headers
    for line in lines[:15]:
        cleaned = re.sub(r'[^\x20-\x7E]', '', line).strip()
        if not cleaned or len(cleaned) < 6:
            continue
        lower = cleaned.lower()
        if any(skip in lower for skip in [
            'baskin', 'robbins', 'date:', 'tm:', 'spot sales',
            '====', '****', '----', 'cash', 'gross', 'net ',
        ]):
            continue
        if re.match(r'^[A-Z][A-Z\s/&\-\.]{4,}$', cleaned) and ' ' in cleaned:
            logger.info(f"Branch name extracted (uppercase pattern): {cleaned}")
            return cleaned

    logger.warning(f"Could not extract branch name. First 15 lines: {lines[:15]}")
    return None


def check_branch_match(receipt_name: str, db_branch_name: str) -> bool:
    """Fuzzy match branch name from receipt against database branch name.
    Handles OCR typos like LANCY vs LAMCY using character similarity.
    """
    if not receipt_name or not db_branch_name:
        return False

    receipt_clean = receipt_name.lower().strip()
    db_clean = db_branch_name.lower().strip()

    # Remove common prefixes (including OCR variants of IBQ)
    for prefix in ['ibq ', '1bq ', '1b ', 'lbq ', 'br ', 'baskin robbins ']:
        receipt_clean = receipt_clean.replace(prefix, '')
        db_clean = db_clean.replace(prefix, '')

    # Remove extra whitespace and non-alpha noise
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

    # Fuzzy character match: handle OCR typos (LANCY vs LAMCY)
    # Check if any word pair is very similar (1-2 char difference)
    for rw in receipt_words:
        for dw in db_words:
            if len(rw) >= 4 and len(dw) >= 4:
                # Simple edit distance check: count matching chars
                if len(rw) == len(dw):
                    diff = sum(1 for a, b in zip(rw, dw) if a != b)
                    if diff <= 2:
                        return True
                # Check if one is substring of other (off by 1-2 chars)
                shorter, longer = (rw, dw) if len(rw) <= len(dw) else (dw, rw)
                if len(longer) - len(shorter) <= 2 and shorter[:3] == longer[:3]:
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
                # OCR misreads: GC→6C, G→6, :→; or . etc.
                gc_match = re.search(r'(?:gc|6c|g\.c)[:\s;.,]+(\d+)', lower)
                if gc_match:
                    result["guest_count"] = gc_match.group(1)
                    logger.info(f"GC found on gross sales line: {gc_match.group(1)}")
                else:
                    logger.info(f"GC not found on gross sales line: '{stripped}'")

            # Net Sales..: 1,314.46
            elif 'net sale' in lower:
                numbers = re.findall(r'[\d,]+\.?\d*', stripped)
                if numbers:
                    result["net_sales"] = numbers[0].replace(',', '')

            # GC on its own line or after other values
            if result["guest_count"] is None:
                gc_match = re.search(r'(?:gc|6c|g\.c)[:\s;.,]+(\d+)', lower)
                if gc_match:
                    result["guest_count"] = gc_match.group(1)
                    logger.info(f"GC found on separate summary line: {gc_match.group(1)}")

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

    # Fallback: scan ALL lines for GC if not found in sections
    # OCR may put GC on any line, or section detection may have missed it
    # Receipt has GC in summary (total=32) and in cash section (cash=2)
    # We want the LARGEST one (that's the total guest count)
    if result["guest_count"] is None:
        best_gc = 0
        for line in lines:
            lower_line = line.strip().lower()
            # Match GC/6C followed by colon/space/dots and a number
            # But NOT "RGC:" (returns guest count)
            gc_match = re.search(r'(?<![r])(?:gc|6c|g\.c)[:\s;.,]+(\d+)', lower_line)
            if gc_match:
                val = int(gc_match.group(1))
                if val > best_gc:
                    best_gc = val
        if best_gc > 0:
            result["guest_count"] = str(best_gc)
            logger.info(f"GC extracted from fallback scan: {best_gc}")

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
            logger.info(f"OCR extracted text (first 500 chars): {all_text[:500]}")

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
