"""
Claude Vision Service
Fast POS receipt extraction using Anthropic Claude API
"""

import anthropic
import asyncio
import base64
import json
import logging
import re

from utils.config import settings

logger = logging.getLogger(__name__)

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
   Items listed ABOVE a T> line belong to that category.

CRITICAL ACCURACY RULES:
- READ EACH LINE CHARACTER BY CHARACTER. Do not guess or estimate numbers.
- Each item row has EXACTLY this format: CODE  NAME  QUANTITY  SALES  PCT
- The QUANTITY column is a whole number (integer).
- The SALES column is a decimal number (e.g., 579.60).
- Extract EVERY SINGLE item visible across ALL images. Do NOT skip any.
- If multiple images show the same section, do NOT duplicate items.
- guest_count = GC from Sales Summary (NOT from Cash Sales section)
- cash_sales = "Net CashSls" amount
- cash_gc = GC from the Cash Sales section

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


async def extract_pos_combined(image_bytes_list) -> dict:
    """Extract ALL POS data using Claude claude-haiku-4-5 — fast and reliable."""
    if isinstance(image_bytes_list, bytes):
        image_bytes_list = [image_bytes_list]

    client = _get_client()

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

    # Run sync client in thread pool to not block event loop
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=8096,
            messages=[{"role": "user", "content": content}],
        )
    )

    text = response.content[0].text
    data = _parse_json_response(text)

    logger.info(f"Claude POS: {len(data.get('categories', []))} categories, {len(data.get('items', []))} items")
    return data
