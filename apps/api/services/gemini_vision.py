"""
Gemini Vision Service
Extracts structured sales data from receipt photos using Google Gemini Vision API
"""

import google.generativeai as genai
from PIL import Image
import io
import json
import logging
import re

from utils.config import settings

logger = logging.getLogger(__name__)

# ============== PROMPTS ==============

POS_SALES_PROMPT = """Analyze this POS sales receipt image carefully. Extract the following information and return ONLY a valid JSON object:

{
  "branch_code": "string - branch code/name shown",
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
  "cash_sales": 0.00
}

Rules:
- Extract numbers exactly as shown, do not calculate
- If a field is not visible, use 0
- guest_count is the number of transactions/guests/bills
- atv = Average Transaction Value
- Return ONLY the JSON object, no other text"""

CATEGORY_ITEMS_PROMPT = """Analyze this POS sales receipt image. Extract the category breakdown and item details. Return ONLY a valid JSON object:

{
  "categories": [
    {
      "name": "string - category name (e.g. Cups & Cones, Sundaes, Beverages, Cakes, etc.)",
      "quantity": 0,
      "sales": 0.00,
      "contribution_pct": 0.0
    }
  ],
  "items": [
    {
      "code": "string - item code if shown",
      "name": "string - item name",
      "category": "string - which category it belongs to",
      "quantity": 0,
      "sales": 0.00,
      "contribution_pct": 0.0
    }
  ]
}

Rules:
- List ALL categories visible in the image
- List ALL individual items if visible
- contribution_pct is the percentage contribution to total sales
- If items are not visible (only categories), return empty items array
- Return ONLY the JSON object, no other text"""

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


def _configure_gemini():
    """Configure Gemini API with key from settings."""
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise ValueError("GEMINI_API_KEY not configured")
    genai.configure(api_key=api_key)


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


async def extract_pos_sales(image_bytes: bytes) -> dict:
    """Extract POS sales summary from receipt photo."""
    _configure_gemini()
    model = genai.GenerativeModel("gemini-2.0-flash")
    img = _image_from_bytes(image_bytes)

    # First prompt: sales summary
    response = model.generate_content([POS_SALES_PROMPT, img])
    sales_data = _parse_json_response(response.text)

    return sales_data


async def extract_pos_categories(image_bytes: bytes) -> dict:
    """Extract category and item breakdown from POS receipt photo."""
    _configure_gemini()
    model = genai.GenerativeModel("gemini-2.0-flash")
    img = _image_from_bytes(image_bytes)

    response = model.generate_content([CATEGORY_ITEMS_PROMPT, img])
    category_data = _parse_json_response(response.text)

    return category_data


async def extract_hd_sales(image_bytes: bytes) -> dict:
    """Extract Home Delivery data from report photo."""
    _configure_gemini()
    model = genai.GenerativeModel("gemini-2.0-flash")
    img = _image_from_bytes(image_bytes)

    response = model.generate_content([HOME_DELIVERY_PROMPT, img])
    hd_data = _parse_json_response(response.text)

    return hd_data


async def extract_deliveroo_sales(image_bytes: bytes) -> dict:
    """Extract Deliveroo data from dashboard photo."""
    _configure_gemini()
    model = genai.GenerativeModel("gemini-2.0-flash")
    img = _image_from_bytes(image_bytes)

    response = model.generate_content([DELIVEROO_PROMPT, img])
    deliveroo_data = _parse_json_response(response.text)

    return deliveroo_data


async def extract_budget_sheet(image_bytes: bytes) -> dict:
    """Extract monthly budget sheet data from photo (DAILY SALES TRACKER format)."""
    _configure_gemini()
    model = genai.GenerativeModel("gemini-2.0-flash")
    img = _image_from_bytes(image_bytes)

    response = model.generate_content(
        [BUDGET_SHEET_PROMPT, img],
        generation_config={"temperature": 0.1, "max_output_tokens": 8192},
    )
    budget_data = _parse_json_response(response.text)

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
