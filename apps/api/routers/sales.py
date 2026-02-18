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

def _build_sales_response(s) -> DailySalesResponse:
    """Build DailySalesResponse from a DailySales model instance."""
    return DailySalesResponse(
        id=s.id,
        branch_id=s.branch_id,
        date=s.date,
        sales_window=s.sales_window.value,
        gross_sales=getattr(s, 'gross_sales', None),
        total_sales=s.total_sales,
        transaction_count=s.transaction_count,
        cash_sales=getattr(s, 'cash_sales', None),
        ly_sale=getattr(s, 'ly_sale', None),
        cake_units=getattr(s, 'cake_units', None),
        hand_pack_units=getattr(s, 'hand_pack_units', None),
        sundae_pct=getattr(s, 'sundae_pct', None),
        cups_cones_pct=getattr(s, 'cups_cones_pct', None),
        category_data=getattr(s, 'category_data', None),
        photo_url=s.photo_url,
        notes=s.notes,
        hd_gross_sales=getattr(s, 'hd_gross_sales', None),
        hd_net_sales=getattr(s, 'hd_net_sales', None),
        hd_orders=getattr(s, 'hd_orders', None),
        hd_photo_url=getattr(s, 'hd_photo_url', None),
        submitted_by_id=s.submitted_by_id,
        created_at=s.created_at,
    )


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

    # Helper to safely set a field if column exists
    def _set(obj, field, value):
        if hasattr(obj, field):
            setattr(obj, field, value)

    if existing:
        existing.total_sales = data.total_sales
        existing.transaction_count = data.transaction_count
        _set(existing, 'gross_sales', data.gross_sales or 0)
        _set(existing, 'cash_sales', data.cash_sales or 0)
        _set(existing, 'ly_sale', data.ly_sale or 0)
        _set(existing, 'cake_units', data.cake_units or 0)
        _set(existing, 'hand_pack_units', data.hand_pack_units or 0)
        _set(existing, 'sundae_pct', data.sundae_pct or 0)
        _set(existing, 'cups_cones_pct', data.cups_cones_pct or 0)
        _set(existing, 'category_data', data.category_data)
        if data.photo_url:
            existing.photo_url = data.photo_url
        if data.notes:
            existing.notes = data.notes
        # Home Delivery fields
        _set(existing, 'hd_gross_sales', data.hd_gross_sales or 0)
        _set(existing, 'hd_net_sales', data.hd_net_sales or 0)
        _set(existing, 'hd_orders', data.hd_orders or 0)
        if data.hd_photo_url:
            _set(existing, 'hd_photo_url', data.hd_photo_url)
        db.commit()
        db.refresh(existing)

        return _build_sales_response(existing)

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

    _set(sales_entry, 'gross_sales', data.gross_sales or 0)
    _set(sales_entry, 'cash_sales', data.cash_sales or 0)
    _set(sales_entry, 'ly_sale', data.ly_sale or 0)
    _set(sales_entry, 'cake_units', data.cake_units or 0)
    _set(sales_entry, 'hand_pack_units', data.hand_pack_units or 0)
    _set(sales_entry, 'sundae_pct', data.sundae_pct or 0)
    _set(sales_entry, 'cups_cones_pct', data.cups_cones_pct or 0)
    _set(sales_entry, 'category_data', data.category_data)
    _set(sales_entry, 'hd_gross_sales', data.hd_gross_sales or 0)
    _set(sales_entry, 'hd_net_sales', data.hd_net_sales or 0)
    _set(sales_entry, 'hd_orders', data.hd_orders or 0)
    _set(sales_entry, 'hd_photo_url', data.hd_photo_url)

    db.add(sales_entry)
    db.commit()
    db.refresh(sales_entry)

    return _build_sales_response(sales_entry)


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

    return [_build_sales_response(s) for s in sales]


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

def extract_branch_name(text: str, receipt_type: str = "pos") -> Optional[str]:
    """Extract branch name from BR POS or Home Delivery receipt header.
    POS receipts use IBQ/1BQ prefix. HD receipts use 1H/IH prefix.
    OCR often misreads characters. Handle all variants.
    """
    lines = text.split('\n')

    # Strategy 1a: Look for IBQ/1BQ/1B pattern (POS receipts)
    for line in lines[:25]:
        cleaned = re.sub(r'[^\x20-\x7E]', '', line).strip()
        if not cleaned or len(cleaned) < 3:
            continue

        # Match IBQ/1BQ/1B/lBQ followed by branch name
        ibq_match = re.search(r'(?:IBQ|1BQ|1B|lBQ|iB[Q0O])\s+(.+)', cleaned, re.IGNORECASE)
        if ibq_match:
            branch = ibq_match.group(0).strip()
            branch = re.sub(r'\s+[a-z]{1,3}\s*$', '', branch)
            logger.info(f"Branch name extracted (IBQ pattern): {branch}")
            return branch

    # Strategy 1b: Look for 1H/IH pattern (Home Delivery receipts)
    # Format: "1H : T. C. Road" or "IH : Karama 3" etc.
    for line in lines[:25]:
        cleaned = re.sub(r'[^\x20-\x7E]', '', line).strip()
        if not cleaned or len(cleaned) < 3:
            continue

        # Match 1H/IH/lH followed by separator and branch name
        hd_match = re.search(r'(?:1H|IH|lH|1h|ih)\s*[:\-]\s*(.+)', cleaned, re.IGNORECASE)
        if hd_match:
            branch = hd_match.group(1).strip()
            branch = re.sub(r'\s+[a-z]{1,3}\s*$', '', branch)
            logger.info(f"Branch name extracted (HD 1H pattern): {branch}")
            return branch

    # Strategy 2: Search all lines for known location keywords
    location_keywords = [
        'lamcy', 'lancy', 'residence', 'karama', 'deira', 'marina',
        'mall', 'plaza', 'center', 'centre', 'city', 'tower',
        'trade', 'jumeirah', 'barsha', 'nahda', 'sharjah', 'ajman',
        'fujairah', 'khalifa', 'reem', 'musaffah', 'corniche',
        'mirdif', 'silicon', 'springs', 'meadows', 'jlt', 'jbr',
        'motor', 'festival', 'ibn battuta', 'battuta', 'outlet',
        'road', 'street', 'al ain', 'ras al',
    ]
    for line in lines[:20]:
        cleaned = re.sub(r'[^\x20-\x7E]', '', line).strip()
        if not cleaned or len(cleaned) < 5:
            continue
        lower = cleaned.lower()
        if any(skip in lower for skip in [
            'baskin', 'robbins', 'date:', 'tm:', 'spot sales',
            '====', '****', '----', 'cash', 'gross', 'net ',
            'sales summary', 'returns', 'discount', 'total',
            'day end report', 'home delivery',
        ]):
            continue
        for kw in location_keywords:
            if kw in lower and len(cleaned) > 5:
                name = re.sub(r'^[^A-Z]*', '', cleaned).strip()
                if name and len(name) > 4:
                    name = re.sub(r'\s+[a-z]{1,3}\s*$', '', name)
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
            'day end report', 'home delivery',
        ]):
            continue
        if re.match(r'^[A-Z][A-Z\s/&\-\.]{4,}$', cleaned) and ' ' in cleaned:
            logger.info(f"Branch name extracted (uppercase pattern): {cleaned}")
            return cleaned

    logger.warning(f"Could not extract branch name. First 15 lines: {lines[:15]}")
    return None


def normalize_branch_name(name: str) -> str:
    """Normalize a branch name for comparison.
    Removes prefixes, punctuation, expands/collapses abbreviations.
    """
    clean = name.lower().strip()

    # Remove common prefixes (IBQ, 1BQ, 1H, etc.)
    for prefix in ['ibq ', '1bq ', '1b ', 'lbq ', '1h ', 'ih ', 'lh ',
                    'br ', 'baskin robbins ']:
        clean = clean.replace(prefix, '')

    # Remove separator chars that OCR adds: ":" "-"
    clean = re.sub(r'^[\s:\-]+', '', clean)

    # Remove dots from abbreviations: "T. C." → "T C" → "TC"
    clean = clean.replace('.', ' ')

    # Collapse whitespace
    clean = ' '.join(clean.split())

    return clean


# Common abbreviation mappings for UAE branch names
BRANCH_ABBREVIATIONS = {
    'tc': 'trade centre',
    't c': 'trade centre',
    'tc road': 'trade centre road',
    't c road': 'trade centre road',
    'jlt': 'jumeirah lake towers',
    'jbr': 'jumeirah beach residence',
    'dcc': 'deira city centre',
    'moe': 'mall of the emirates',
    'mcc': 'mirdif city centre',
    'ibc': 'ibn battuta',
}

# Common OCR typo corrections for branch names
BRANCH_TYPO_MAP = {
    'roade': 'road',
    'centre': 'center',
    'center': 'centre',
    'trad': 'trade',
}


def check_branch_match(receipt_name: str, db_branch_name: str) -> bool:
    """Fuzzy match branch name from receipt against database branch name.
    Handles OCR typos like LANCY vs LAMCY, abbreviations like T.C. → Trade Centre.
    DB names may have "/" separator like "TRADE CENTER ROADE / KARAMA 3".
    """
    if not receipt_name or not db_branch_name:
        return False

    receipt_clean = normalize_branch_name(receipt_name)
    db_clean = normalize_branch_name(db_branch_name)

    # DB branch may have multiple names separated by /
    # e.g. "TRADE CENTER ROADE / KARAMA 3" — try matching against each part
    db_parts = [db_clean]
    if '/' in db_clean:
        db_parts = [p.strip() for p in db_clean.split('/') if p.strip()]
        db_parts.append(db_clean.replace('/', ' '))  # also try the full name

    for db_part in db_parts:
        if _match_single(receipt_clean, db_part):
            return True

    return False


def _match_single(receipt_clean: str, db_clean: str) -> bool:
    """Match receipt name against a single DB branch name part."""

    # Exact match
    if receipt_clean == db_clean:
        return True

    # One contains the other
    if receipt_clean in db_clean or db_clean in receipt_clean:
        return True

    # Apply typo corrections to both
    receipt_fixed = receipt_clean
    db_fixed = db_clean
    for typo, correction in BRANCH_TYPO_MAP.items():
        receipt_fixed = receipt_fixed.replace(typo, correction)
        db_fixed = db_fixed.replace(typo, correction)

    if receipt_fixed == db_fixed:
        return True
    if receipt_fixed in db_fixed or db_fixed in receipt_fixed:
        return True

    # Expand abbreviations and check
    receipt_expanded = receipt_clean
    db_expanded = db_clean
    for abbr, full in BRANCH_ABBREVIATIONS.items():
        if abbr in receipt_expanded:
            receipt_expanded = receipt_expanded.replace(abbr, full)
        if abbr in db_expanded:
            db_expanded = db_expanded.replace(abbr, full)

    # Also apply typo fixes to expanded forms
    for typo, correction in BRANCH_TYPO_MAP.items():
        receipt_expanded = receipt_expanded.replace(typo, correction)
        db_expanded = db_expanded.replace(typo, correction)

    if receipt_expanded == db_expanded:
        return True
    if receipt_expanded in db_expanded or db_expanded in receipt_expanded:
        return True

    # Collect all word sets for overlap checks
    all_word_sets = [
        (set(receipt_clean.split()), set(db_clean.split())),
        (set(receipt_fixed.split()), set(db_fixed.split())),
        (set(receipt_expanded.split()), set(db_expanded.split())),
    ]

    for receipt_words, db_words in all_word_sets:
        receipt_words = {w for w in receipt_words if len(w) > 2}
        db_words = {w for w in db_words if len(w) > 2}
        if receipt_words and db_words:
            overlap = receipt_words & db_words
            if len(overlap) >= 1:
                return True

    # Fuzzy character match: handle OCR typos (LANCY vs LAMCY, ROADE vs ROAD)
    all_receipt_words = set()
    all_db_words = set()
    for rw_set, dw_set in all_word_sets:
        all_receipt_words |= {w for w in rw_set if len(w) > 2}
        all_db_words |= {w for w in dw_set if len(w) > 2}

    for rw in all_receipt_words:
        for dw in all_db_words:
            if len(rw) >= 3 and len(dw) >= 3:
                if len(rw) == len(dw):
                    diff = sum(1 for a, b in zip(rw, dw) if a != b)
                    if diff <= 2:
                        return True
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


def parse_hd_receipt(text: str) -> dict:
    """
    Parse Home Delivery (HD) receipt text.
    HD receipts use "Orders:" instead of "GC:", and may have different format.
    Extracts: gross sales, net sales, orders count, cash sales.
    """
    result = {
        "gross_sales": None,
        "net_sales": None,
        "guest_count": None,  # will store "Orders" value here
        "cash_sales": None,
        "categories": [],
    }

    lines = text.split('\n')
    section = "header"

    for line in lines:
        stripped = line.strip()
        lower = stripped.lower()

        if not stripped:
            continue

        # Detect section changes (similar to POS but HD-specific)
        if 'sales summary' in lower and 'category' not in lower and 'item' not in lower:
            section = "summary"
            continue
        elif re.match(r'^cash\s+sales?\s*$', lower) or lower == 'cash sales':
            section = "cash"
            continue
        elif 'category sales summary' in lower:
            section = "category"
            continue
        elif 'item sales summary' in lower:
            section = "item"
            continue

        # ---- SALES SUMMARY SECTION ----
        if section == "summary":
            # Gross Sales
            if lower.startswith('gross sale'):
                numbers = re.findall(r'[\d,]+\.?\d*', stripped)
                if numbers:
                    result["gross_sales"] = numbers[0].replace(',', '')

            # Net Sales
            elif 'net sale' in lower:
                numbers = re.findall(r'[\d,]+\.?\d*', stripped)
                if numbers:
                    result["net_sales"] = numbers[0].replace(',', '')

            # Orders: 16 (HD equivalent of GC)
            orders_match = re.search(r'orders?\s*[:\s;.,]+\s*(\d+)', lower)
            if orders_match:
                result["guest_count"] = orders_match.group(1)
                logger.info(f"HD Orders found: {orders_match.group(1)}")

        # Also look for Orders on any line in summary-like context
        if result["guest_count"] is None:
            orders_match = re.search(r'orders?\s*[:\s;.,]+\s*(\d+)', lower)
            if orders_match:
                result["guest_count"] = orders_match.group(1)
                logger.info(f"HD Orders found (any line): {orders_match.group(1)}")

        # ---- CASH SECTION ----
        if section == "cash":
            if lower.startswith('cash sale'):
                numbers = re.findall(r'[\d,]+\.?\d*', stripped)
                if numbers:
                    val = numbers[0].replace(',', '')
                    if float(val) > 0:
                        result["cash_sales"] = val

        # ---- CATEGORY SALES SUMMARY ----
        if section == "category":
            if 'description' in lower or stripped.startswith('=') or stripped.startswith('-'):
                continue

            numbers = re.findall(r'[\d,]+\.?\d*', stripped)
            if len(numbers) >= 2:
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

    # Fallback: scan all lines for "Orders:" if not yet found
    if result["guest_count"] is None:
        for line in lines:
            lower_line = line.strip().lower()
            orders_match = re.search(r'orders?\s*[:\s;.,]+\s*(\d+)', lower_line)
            if orders_match:
                result["guest_count"] = orders_match.group(1)
                logger.info(f"HD Orders from fallback scan: {orders_match.group(1)}")
                break

    # Also try GC as fallback (some HD receipts may still use GC)
    if result["guest_count"] is None:
        best_gc = 0
        for line in lines:
            lower_line = line.strip().lower()
            gc_match = re.search(r'(?<![r])(?:gc|6c|g\.c)[:\s;.,]+(\d+)', lower_line)
            if gc_match:
                val = int(gc_match.group(1))
                if val > best_gc:
                    best_gc = val
        if best_gc > 0:
            result["guest_count"] = str(best_gc)
            logger.info(f"HD GC from fallback: {best_gc}")

    return result


@router.post("/extract-from-photos", response_model=SalesExtractionResponse)
async def extract_sales_from_photos(
    files: List[UploadFile] = File(...),
    branch_name: Optional[str] = Form(None),
    receipt_type: Optional[str] = Form("pos"),
    current_user: User = Depends(get_current_user),
):
    """
    Extract sales data from BR receipt photos.
    receipt_type: "pos" for POS receipts, "hd" for Home Delivery receipts.
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
            logger.info(f"OCR [{receipt_type}] extracted text (first 500 chars): {all_text[:500]}")

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
    receipt_branch = extract_branch_name(all_text, receipt_type=receipt_type or "pos")

    # Check branch match
    # If we couldn't extract branch name from receipt, don't block — let user proceed
    if not receipt_branch:
        branch_matched = True
    elif branch_name:
        branch_matched = check_branch_match(receipt_branch, branch_name)
    else:
        branch_matched = True

    # Parse the receipt data using the appropriate parser
    if receipt_type == "hd":
        parsed = parse_hd_receipt(all_text)
    else:
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
