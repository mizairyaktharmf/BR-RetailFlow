"""
Gemini Vision Service
Extracts structured sales data from receipt photos using Google Gemini Vision API
"""

from google import genai
from PIL import Image
import asyncio
import io
import json
import logging
import re

from utils.config import settings

logger = logging.getLogger(__name__)

# Max retries on failure
MAX_RETRIES = 3
RETRY_DELAY = 2  # seconds

# ============== PROMPTS ==============

POS_SALES_PROMPT = """Analyze this POS sales receipt image carefully. Extract the Sales Summary section.
Return ONLY a valid JSON object:

{
  "branch_code": "string - branch code/name shown at top",
  "date": "string - date shown on receipt (YYYY-MM-DD format)",
  "gross_sales": 0.00,
  "returns": 0.00,
  "total_sales": 0.00,
  "discount": 0.00,
  "net_sales": 0.00,
  "tax": 0.00,
  "total_sales_with_tax": 0.00,
  "guest_count": 0,
  "atv": 0.00,
  "cancelled": 0.00,
  "cash_sales": 0.00,
  "cash_gc": 0
}

Rules:
- Extract numbers exactly as shown, do not calculate
- If a field is not visible, use 0
- guest_count is the GC number from the Sales Summary section (NOT from Cash Sales)
- atv is the ATV from the Sales Summary section
- cash_sales is the "Cash Sales" or "Grs CashSls" amount
- cash_gc is the GC number from the Cash Sales section
- Return ONLY the JSON object, no other text"""

CATEGORY_ITEMS_PROMPT = """Analyze this POS sales receipt image. Extract ALL category totals and ALL individual items.

The receipt shows categories like "T>Cups & Cones", "T>Sundaes", "T>Beverages", "T>Take Home" etc.
Under each category are individual items with code, name, quantity, sales, and percentage.

Return ONLY a valid JSON object:

{
  "categories": [
    {
      "name": "Cups & Cones",
      "quantity": 66,
      "sales": 1096.11,
      "contribution_pct": 34.8
    }
  ],
  "items": [
    {
      "code": "1142",
      "name": "Chc Pnt Bliss S",
      "category": "Cups & Cones",
      "quantity": 2,
      "sales": 36.20,
      "contribution_pct": 1.1
    }
  ]
}

Rules:
- Category names: strip the "T>" prefix (e.g. "T>Cups & Cones" → "Cups & Cones")
- List EVERY category total row visible (the rows starting with T>)
- List EVERY individual item under each category
- Extract item code (4-digit number), name, quantity, sales amount, contribution %
- contribution_pct is the percentage shown in the last column
- Return ONLY the JSON object, no other text"""

POS_COMBINED_PROMPT = """You are an expert OCR system for Baskin Robbins POS receipts. Analyze these POS sales receipt images with EXTREME PRECISION. You may receive 1-5 images showing different parts of the SAME receipt. Extract ALL data from ALL images combined.

The POS receipt has these sections IN ORDER:

1. **Sales Summary** — at the very top: Gross Sales, Returns, Net Sales, Discount, Tax, GC (Guest Count), ATV
2. **Cash Sales** — below sales summary: Grs CashSls, Net CashSls, GC
3. **Category Sales Summary** — a summary table showing category totals:
   Cups & Cones  250  4,222.76  17.0
   Sundaes       687  13,095.85 52.6
   Beverages      53  1,388.52   5.6
   Take Home      39  2,154.28   8.7
   Desserts       31  3,052.41  12.3
   Toppings      344    420.84   1.7
   Others         65    537.99   2.2
   Soft Drink      1     14.29   0.1
   TOTAL SALES  1470 24,886.94 100.0

4. **Item Sales Summary** — ALL individual items listed sequentially with T> category headers:
   Items listed ABOVE a T> line belong to that category:
   - First items up to "T>Cups & Cones" = Cups & Cones items
   - Items after T>Cups & Cones up to "T>Sundaes" = Sundaes items
   - Items after T>Sundaes up to "T>Beverages" = Beverages items (Thick Shakes, etc.)
   - Items after T>Beverages up to "T>Take Home" = Take Home items (Fun Pack, Value Pack, etc.)
   - Items after T>Take Home up to "T>Desserts" = Desserts items (CPU cakes, ATC cakes, INV cakes, etc.)
   - Items after T>Desserts up to "T>Toppings" = Toppings items
   - Items after T>Toppings up to "T>Others" = Others items
   - Items after T>Others up to "T>Soft Drink" = Soft Drink items

5. **TOTAL SALES** — final total row
6. **Non Sales Item Summary** — non-sales items (ignore these)
7. **Discount / Promo Summary** — discount info (ignore these)

CRITICAL ACCURACY RULES:
- READ EACH LINE CHARACTER BY CHARACTER. Do not guess or estimate numbers.
- Each item row has EXACTLY this format: CODE  NAME  QUANTITY  SALES  PCT
- The QUANTITY column is a whole number (integer). Read it VERY carefully for each item.
- The SALES column is a decimal number (e.g., 579.60). Do NOT confuse it with quantity.
- DOUBLE CHECK: For each item, verify the quantity makes sense (usually 1-50 range for individual items).
- If an item shows quantity like 32, verify it's really 32 and not misread from the sales column.
- The sum of all item quantities within a category MUST equal the T> category total quantity.
- Extract EVERY SINGLE item visible across ALL images. Do NOT skip any item. Do NOT truncate.
- Each item has: 4-digit code, name, quantity, sales amount, contribution %
- Items belong to the category whose T> header appears BELOW them in the list.
- If multiple images show the same section, do NOT duplicate items.
- If images show different sections, COMBINE all data into one result.
- Extract numbers exactly as shown — do not round or calculate.
- sales_summary: if visible, extract from the Sales Summary section
- guest_count = GC from Sales Summary (NOT from Cash Sales section)
- cash_sales = "Net CashSls" amount
- cash_gc = GC from the Cash Sales section
- categories: from Category Sales Summary OR from T> total lines
- If a section is not visible in any image, use empty array [] or 0

VALIDATION STEP (do this before returning):
1. For each category, sum up item quantities → must equal category total quantity
2. If they don't match, re-read the items more carefully
3. Check that no single item has a suspiciously high quantity compared to others

Return ONLY a valid JSON object:

{
  "sales_summary": {
    "branch_code": "string",
    "date": "string (YYYY-MM-DD)",
    "gross_sales": 0.00,
    "returns": 0.00,
    "net_sales": 0.00,
    "discount": 0.00,
    "tax": 0.00,
    "guest_count": 0,
    "atv": 0.00,
    "cancelled": 0.00,
    "cash_sales": 0.00,
    "cash_gc": 0
  },
  "categories": [
    {"name": "Cups & Cones", "quantity": 66, "sales": 1096.11, "contribution_pct": 34.8}
  ],
  "items": [
    {"code": "1142", "name": "Chc Pnt Bliss S", "category": "Cups & Cones", "quantity": 2, "sales": 36.20, "contribution_pct": 1.1}
  ]
}

Return ONLY the JSON object, no other text."""

HOME_DELIVERY_PROMPT = """Analyze this Home Delivery sales report image. Extract the following information and return ONLY a valid JSON object:

{
  "branch_name": "string",
  "date": "string - date or date range shown (YYYY-MM-DD format)",
  "gross_sales": 0.00,
  "discount": 0.00,
  "net_sales": 0.00,
  "delivery_charges": 0.00,
  "vat": 0.00,
  "total": 0.00,
  "orders": 0,
  "avg_sales_per_order": 0.00
}

Rules:
- Extract numbers exactly as shown
- If a field is not visible, use 0
- orders = total number of delivery orders
- Return ONLY the JSON object, no other text"""

DELIVEROO_PROMPT = """Analyze this Deliveroo sales dashboard image. Extract the following information and return ONLY a valid JSON object:

{
  "aggregator": "Deliveroo",
  "date": "string - date or date range shown",
  "stores": [
    {
      "store_name": "string",
      "total_subtotal": 0.00,
      "discount": 0.00,
      "total_net": 0.00,
      "total_tax": 0.00,
      "total_orders": 0,
      "total_amount": 0.00
    }
  ],
  "totals": {
    "gross_sales": 0.00,
    "discount": 0.00,
    "net_sales": 0.00,
    "total_orders": 0,
    "total_amount": 0.00
  }
}

Rules:
- If multiple stores are shown, list each one
- If only one store/total is shown, put it in both stores array and totals
- Extract numbers exactly as shown
- Return ONLY the JSON object, no other text"""


BUDGET_SHEET_PROMPT = """You are extracting data from a Baskin Robbins "DAILY SALES TRACKER" spreadsheet photo.
This is the official monthly budget/tracking sheet used by BR under Galadari Holdings.

THE SHEET HAS THIS EXACT STRUCTURE:

HEADER ROW:
- Title: "DAILY SALES TRACKER - 2026" (or similar year)
- PARLOR NAME: [branch name, e.g., "Al Ain Centre, Dxb"]
- MONTH: [month name, e.g., "FEBRUARY"]
- AREA MANAGER: [manager name, e.g., "Bibek"]

COLUMN HEADERS (3 groups):
Group 1 - "Days Sales":
  SL | 2025 (date) | 2026 (date) | DAY | 2025 (sales) | 2026 (sales) | Grth % | Budget | Ach %

Group 2 - "Days Guest Count":
  2025 (GC) | 2026 (GC) | Grth %

Group 3 - "MTD Sales" (Month-To-Date cumulative):
  2025 (cumulative) | 2026 (cumulative) | Grth % | Budget (cumulative) | Ach %

DATA ROWS:
- Row 1-28/29/30/31: One row per day of the month
- Some cells may be empty (especially 2026 columns — those are to be filled during the month)
- Rows 29/30/31 may show "-" if month doesn't have those days

TOTAL ROW:
- Last data row shows TOTAL for columns

FOOTER KPIs TABLE:
- ATV (Average Ticket Value): 2025 value | 2026 value | Diff vs PY
- AUV (Average Unit Value): 2025 value | 2026 value | Diff vs PY
- Cake QTY: 2025 value | 2026 value | Diff vs PY
- HP QTY (Hand Packed QTY): 2025 value | 2026 value | Diff vs PY

WEEKLY TABLE:
- Week 01 | Week 02 | Week 03 | Week 04

EXTRACTION RULES:
1. Extract EVERY row even if 2026 columns are empty
2. The "2025" column = Last Year actual sales (this is the LY data)
3. The "Budget" column = This year's daily budget target
4. The "2025" under Guest Count = Last Year Guest Count
5. MTD columns are cumulative — extract them too
6. Numbers must be EXACT — do not round or estimate
7. If a cell shows "-" or is empty, use null
8. Extract KPIs from the footer table
9. Grth% and Ach% may be empty — extract if visible

Return ONLY valid JSON, no markdown code blocks:

{
  "header": {
    "title": "DAILY SALES TRACKER - 2026",
    "parlor_name": "Al Ain Centre, Dxb",
    "month": "FEBRUARY",
    "month_code": "2026-02",
    "area_manager": "Bibek",
    "year_current": 2026,
    "year_previous": 2025
  },

  "daily_data": [
    {
      "sl": 1,
      "date_2025": "2/2/2025",
      "date_2026": "2/1/2026",
      "day": "Sun",

      "days_sales": {
        "ly_2025": 2338,
        "current_2026": null,
        "growth_pct": null,
        "budget": 2743,
        "achievement_pct": null
      },

      "days_guest_count": {
        "ly_2025": 84,
        "current_2026": null,
        "growth_pct": null
      },

      "mtd_sales": {
        "ly_2025": 2338,
        "current_2026": null,
        "growth_pct": null,
        "budget": 2743,
        "achievement_pct": null
      }
    }
  ],

  "totals": {
    "ly_sales_total": 53938,
    "budget_total": 53000,
    "ly_gc_total": 1712,
    "current_sales_total": null,
    "current_gc_total": null
  },

  "kpis": {
    "atv": { "ly_2025": 31.51, "current_2026": null, "diff_vs_py": null },
    "auv": { "ly_2025": 19.28, "current_2026": null, "diff_vs_py": null },
    "cake_qty": { "ly_2025": 102.00, "current_2026": null, "diff_vs_py": null },
    "hp_qty": { "ly_2025": 60.00, "current_2026": null, "diff_vs_py": null }
  },

  "weekly": {
    "week_01": null,
    "week_02": null,
    "week_03": null,
    "week_04": null
  }
}"""


def _get_client() -> genai.Client:
    """Return a configured Gemini client."""
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise ValueError("GEMINI_API_KEY not configured")
    return genai.Client(api_key=api_key)


def _parse_json_response(text: str) -> dict:
    """Parse JSON from Gemini response, handling markdown code fences."""
    cleaned = text.strip()
    # Remove markdown code fences
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```\s*$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Gemini response: {e}\nResponse: {text[:500]}")
        raise ValueError(f"Could not parse extraction result: {e}")


def _image_from_bytes(image_bytes: bytes) -> Image.Image:
    """Create PIL Image from bytes."""
    return Image.open(io.BytesIO(image_bytes))


def _validate_pos_combined(data: dict) -> dict:
    """Validate and fix extracted POS combined data."""
    items = data.get("items", [])
    categories = data.get("categories", [])

    # Build category totals map
    cat_totals = {}
    for cat in categories:
        cat_totals[cat["name"].lower()] = cat.get("quantity", 0)

    # Check each category: sum of item quantities vs category total
    cat_item_sums = {}
    for item in items:
        cat = (item.get("category") or "").lower()
        cat_item_sums[cat] = cat_item_sums.get(cat, 0) + (item.get("quantity") or 0)

    mismatches = []
    for cat_name, expected_qty in cat_totals.items():
        actual_qty = cat_item_sums.get(cat_name, 0)
        if expected_qty > 0 and actual_qty != expected_qty:
            mismatches.append(f"{cat_name}: expected {expected_qty}, got {actual_qty}")

    if mismatches:
        logger.warning(f"POS extraction quantity mismatches: {'; '.join(mismatches)}")

    return data


async def _call_gemini_with_retry(model: str, contents: list, config=None) -> str:
    """Call Gemini API with automatic retry on failure."""
    client = _get_client()
    last_error = None

    for attempt in range(MAX_RETRIES):
        try:
            kwargs = {"model": model, "contents": contents}
            if config:
                kwargs["config"] = config
            response = client.models.generate_content(**kwargs)
            if response.text:
                return response.text
            raise ValueError("Empty response from Gemini")
        except Exception as e:
            last_error = e
            logger.warning(f"Gemini attempt {attempt + 1}/{MAX_RETRIES} failed: {e}")
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(RETRY_DELAY * (attempt + 1))

    raise last_error


async def extract_pos_sales(image_bytes: bytes) -> dict:
    """Extract POS sales summary from receipt photo."""
    img = _image_from_bytes(image_bytes)
    text = await _call_gemini_with_retry("gemini-2.0-flash", [img, POS_SALES_PROMPT])
    return _parse_json_response(text)


async def extract_pos_categories(image_bytes: bytes) -> dict:
    """Extract category and item breakdown from POS receipt photo."""
    img = _image_from_bytes(image_bytes)
    text = await _call_gemini_with_retry("gemini-2.0-flash", [img, CATEGORY_ITEMS_PROMPT])
    return _parse_json_response(text)


async def extract_pos_combined(image_bytes_list) -> dict:
    """Extract ALL POS data (sales summary + categories + items) in one call.
    Accepts a single bytes object or a list of bytes (multi-image).
    """
    from google.genai import types

    # Support both single image and multiple images
    if isinstance(image_bytes_list, bytes):
        image_bytes_list = [image_bytes_list]

    contents = []
    for img_bytes in image_bytes_list:
        contents.append(_image_from_bytes(img_bytes))
    contents.append(POS_COMBINED_PROMPT)

    config = types.GenerateContentConfig(temperature=0, max_output_tokens=65536)
    text = await _call_gemini_with_retry("gemini-2.0-flash", contents, config)
    data = _parse_json_response(text)

    # Validate extraction
    data = _validate_pos_combined(data)

    logger.info(f"POS Combined: {len(data.get('categories', []))} categories, {len(data.get('items', []))} items")
    return data


async def extract_hd_sales(image_bytes: bytes) -> dict:
    """Extract Home Delivery data from report photo."""
    img = _image_from_bytes(image_bytes)
    text = await _call_gemini_with_retry("gemini-2.0-flash", [img, HOME_DELIVERY_PROMPT])
    return _parse_json_response(text)


async def extract_deliveroo_sales(image_bytes: bytes) -> dict:
    """Extract Deliveroo data from dashboard photo."""
    img = _image_from_bytes(image_bytes)
    text = await _call_gemini_with_retry("gemini-2.0-flash", [img, DELIVEROO_PROMPT])
    return _parse_json_response(text)


async def extract_budget_sheet(image_bytes: bytes) -> dict:
    """Extract monthly budget sheet data from photo (DAILY SALES TRACKER format)."""
    from google.genai import types
    img = _image_from_bytes(image_bytes)
    config = types.GenerateContentConfig(temperature=0, max_output_tokens=65536)
    text = await _call_gemini_with_retry("gemini-2.0-flash", [img, BUDGET_SHEET_PROMPT], config)
    budget_data = _parse_json_response(text)

    # Get overall LY ATV from KPIs footer
    kpis = budget_data.get("kpis", {})
    ly_atv_overall = 0
    if kpis.get("atv") and kpis["atv"].get("ly_2025"):
        ly_atv_overall = float(kpis["atv"]["ly_2025"])

    # Calculate budget_gc and ly_atv for each day
    for day in budget_data.get("daily_data", []):
        ly_gc = (day.get("days_guest_count") or {}).get("ly_2025") or 0
        ly_sales = (day.get("days_sales") or {}).get("ly_2025") or 0
        budget = (day.get("days_sales") or {}).get("budget") or 0

        # Calculate LY ATV per day
        day_ly_atv = (ly_sales / ly_gc) if ly_gc > 0 else ly_atv_overall
        day["_ly_atv"] = round(day_ly_atv, 2)

        # Calculate budget GC
        if budget > 0 and day_ly_atv > 0:
            day["_budget_gc"] = round(budget / day_ly_atv)
        else:
            day["_budget_gc"] = 0

        # Budget ATV
        day["_budget_atv"] = round(budget / day["_budget_gc"], 2) if day["_budget_gc"] > 0 else 0

    return budget_data
