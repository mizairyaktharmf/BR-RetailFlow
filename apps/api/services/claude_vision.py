"""
Claude Vision Service
Fast extraction using Anthropic Claude API for POS receipts, deliveries, budgets, and timesheets
"""

import anthropic
import asyncio
import base64
import json
import logging
import re

from utils.config import settings

logger = logging.getLogger(__name__)

# ============== POS PROMPTS ==============

POS_COMBINED_PROMPT = """You are an EXPERT OCR SYSTEM for Baskin Robbins POS receipts. Analyze these POS sales receipt images with EXTREME PRECISION and PERFECT ACCURACY. You may receive 1-5 images showing different parts of the SAME receipt. Extract ALL data from ALL images combined.

The POS receipt has these sections IN EXACT ORDER:

1. **Sales Summary** — at the very top of the receipt: Gross Sales, Returns, Net Sales, Discount, Tax, GC (Guest Count), ATV
2. **Cash Sales** — below sales summary section: Grs CashSls, Net CashSls, GC
3. **Category Sales Summary** — a summary table showing category totals with columns: NAME, QTY, SALES, %CONT
   Each row has a category name, quantity sold, total sales amount, and contribution percentage.
   The last row is TOTAL SALES showing the grand total quantity and total sales.

4. **Item Sales Summary** — ALL individual items listed sequentially with T> category headers (CRITICAL!):
   Items listed ABOVE a T> line belong to that category.
   Categories in order:
   - First items up to "T>Cups & Cones" = Cups & Cones items
   - Items after T>Cups & Cones up to "T>Sundaes" = Sundaes items
   - Items after T>Sundaes up to "T>Beverages" = Beverages items (Thick Shakes, etc.)
   - Items after T>Beverages up to "T>Take Home" = Take Home items (Fun Pack, Value Pack, etc.)
   - Items after T>Take Home up to "T>Desserts" = Desserts items (CPU cakes, ATC cakes, INV cakes, etc.)
   - Items after T>Desserts up to "T>Toppings" = Toppings items
   - Items after T>Toppings up to "T>Others" = Others items
   - Items after T>Others up to "T>Soft Drink" = Soft Drink items

5. **TOTAL SALES** — final total row (sum of all items)
6. **Non Sales Item Summary** — ignore these items
7. **Discount / Promo Summary** — ignore these

⚠️ CRITICAL ACCURACY RULES (READ CAREFULLY):
- READ EACH LINE CHARACTER BY CHARACTER. Do NOT guess or estimate numbers.
- Each item row has EXACTLY this format: CODE  NAME  QUANTITY  SALES  PCT (5 columns)
- The QUANTITY column is a WHOLE NUMBER (integer). Read it VERY carefully for each item.
- The SALES column is a decimal number (e.g., 579.60 or 36.20). Do NOT confuse it with quantity.
- DOUBLE CHECK: For each item, verify the quantity makes sense (usually 1-50 range for individual items).
- If an item shows quantity like 32, verify it's really 32 and not misread from the sales column.
- The sum of all item QUANTITIES within a category MUST EQUAL the T> category total QUANTITY.
- Extract EVERY SINGLE item visible across ALL images. Do NOT skip any item. Do NOT truncate.
- Each item has: 4-digit code, name, quantity (integer), sales amount (decimal), contribution %
- Items belong to the category whose T> header appears BELOW them in the list.
- If multiple images show the same section, do NOT duplicate items.
- If images show different sections, COMBINE all data into one result.
- Extract numbers exactly as shown — do not round or calculate.
- guest_count = GC from Sales Summary (NOT from Cash Sales section)
- cash_sales = "Net CashSls" amount
- cash_gc = GC from the Cash Sales section
- categories: from Category Sales Summary table OR from T> total lines
- If a section is not visible in any image, use empty array [] or 0

⚠️ VALIDATION STEP (MANDATORY — do this before returning):
1. For EACH category, sum up ALL item quantities → must equal category total quantity
2. If they don't match, RE-READ the items more carefully. Don't return mismatches.
3. Check that no single item has a suspiciously high quantity compared to others
4. Verify quantity > 0 for all items (0 quantity items should not be extracted)

Return ONLY valid JSON object, no markdown, no code fences, no extra text:

{
  "sales_summary": {
    "branch_code": "string",
    "date": "string (YYYY-MM-DD format)",
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
}"""

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
- Rows 29/30/31 may show "-" if month doesn't have those days

FOOTER KPIs TABLE:
- ATV (Average Ticket Value): 2025 value | 2026 value | Diff vs PY
- AUV (Average Unit Value): 2025 value | 2026 value | Diff vs PY
- Cake QTY: 2025 value | 2026 value | Diff vs PY
- HP QTY (Hand Packed QTY): 2025 value | 2026 value | Diff vs PY

EXTRACTION RULES:
1. Extract EVERY row even if 2026 columns are empty
2. The "2025" column = Last Year actual sales (this is the LY data)
3. The "Budget" column = This year's daily budget target
4. Numbers must be EXACT — do not round or estimate
5. If a cell shows "-" or is empty, use null
6. Extract KPIs from the footer table

Return ONLY valid JSON:

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
  }
}"""

VISIT_TIME_PROMPT = """Analyze this POS terminal or clock-in/clock-out photo.
Extract the swipe in and swipe out times shown.

Look for:
- Clock in / Clock out times
- Login / Logout times
- Start / End times
- Any timestamp pairs that indicate arrival and departure

Return ONLY valid JSON:
{
  "swipe_in": "HH:MM" (24-hour format, e.g. "09:30"),
  "swipe_out": "HH:MM" (24-hour format, e.g. "17:45"),
  "date": "YYYY-MM-DD" (if visible, otherwise null),
  "branch_name": "string" (if visible, otherwise null)
}

If only one time is visible, set the other to null.
If no times found, return both as null."""


def _get_client() -> anthropic.Anthropic:
    api_key = settings.ANTHROPIC_API_KEY
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not configured")
    return anthropic.Anthropic(api_key=api_key)


def _parse_json_response(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```\s*$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Claude response: {e}\nResponse: {text[:500]}")
        raise ValueError(f"Could not parse extraction result: {e}")


def _validate_pos_combined(data: dict) -> dict:
    """Validate and fix extracted POS combined data."""
    items = data.get("items", [])
    categories = data.get("categories", [])

    cat_totals = {}
    for cat in categories:
        cat_totals[cat["name"].lower()] = cat.get("quantity", 0)

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


async def _call_claude_with_image(content: list, max_tokens: int = 4096) -> str:
    """Call Claude API with images and text."""
    client = _get_client()
    response = await asyncio.get_event_loop().run_in_executor(
        None,
        lambda: client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": content}],
        )
    )
    return response.content[0].text


async def extract_pos_combined(image_bytes_list) -> dict:
    """Extract ALL POS data (sales + categories + items) — Haiku fast."""
    if isinstance(image_bytes_list, bytes):
        image_bytes_list = [image_bytes_list]

    content = []
    for img_bytes in image_bytes_list:
        b64 = base64.standard_b64encode(img_bytes).decode("utf-8")
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/jpeg",
                "data": b64,
            },
        })
    content.append({"type": "text", "text": POS_COMBINED_PROMPT})

    text = await _call_claude_with_image(content, max_tokens=8096)
    data = _parse_json_response(text)
    data = _validate_pos_combined(data)

    logger.info(f"Claude POS: {len(data.get('categories', []))} categories, {len(data.get('items', []))} items")
    return data


async def extract_hd_sales(image_bytes: bytes) -> dict:
    """Extract Home Delivery data from report photo."""
    b64 = base64.standard_b64encode(image_bytes).decode("utf-8")
    content = [
        {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/jpeg",
                "data": b64,
            },
        },
        {"type": "text", "text": HOME_DELIVERY_PROMPT}
    ]
    text = await _call_claude_with_image(content)
    return _parse_json_response(text)


async def extract_deliveroo_sales(image_bytes: bytes) -> dict:
    """Extract Deliveroo/aggregator data from dashboard photo."""
    b64 = base64.standard_b64encode(image_bytes).decode("utf-8")
    content = [
        {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/jpeg",
                "data": b64,
            },
        },
        {"type": "text", "text": DELIVEROO_PROMPT}
    ]
    text = await _call_claude_with_image(content)
    return _parse_json_response(text)


async def extract_budget_sheet(image_bytes: bytes) -> dict:
    """Extract monthly budget sheet data from photo (DAILY SALES TRACKER format)."""
    b64 = base64.standard_b64encode(image_bytes).decode("utf-8")
    content = [
        {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/jpeg",
                "data": b64,
            },
        },
        {"type": "text", "text": BUDGET_SHEET_PROMPT}
    ]
    text = await _call_claude_with_image(content, max_tokens=8096)
    budget_data = _parse_json_response(text)

    # Calculate budget_gc and ly_atv for each day
    kpis = budget_data.get("kpis", {})
    ly_atv_overall = 0
    if kpis.get("atv") and kpis["atv"].get("ly_2025"):
        ly_atv_overall = float(kpis["atv"]["ly_2025"])

    for day in budget_data.get("daily_data", []):
        ly_gc = (day.get("days_guest_count") or {}).get("ly_2025") or 0
        ly_sales = (day.get("days_sales") or {}).get("ly_2025") or 0
        budget = (day.get("days_sales") or {}).get("budget") or 0

        day_ly_atv = (ly_sales / ly_gc) if ly_gc > 0 else ly_atv_overall
        day["_ly_atv"] = round(day_ly_atv, 2)

        if budget > 0 and day_ly_atv > 0:
            day["_budget_gc"] = round(budget / day_ly_atv)
        else:
            day["_budget_gc"] = 0

        day["_budget_atv"] = round(budget / day["_budget_gc"], 2) if day["_budget_gc"] > 0 else 0

    return budget_data


async def extract_visit_times(image_bytes: bytes) -> dict:
    """Extract swipe in/out times from a POS or clock photo."""
    b64 = base64.standard_b64encode(image_bytes).decode("utf-8")
    content = [
        {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/jpeg",
                "data": b64,
            },
        },
        {"type": "text", "text": VISIT_TIME_PROMPT}
    ]
    text = await _call_claude_with_image(content)
    return _parse_json_response(text)
