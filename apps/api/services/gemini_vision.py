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
