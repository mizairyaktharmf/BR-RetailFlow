"""
Budget Excel Parser
Reads DAILY SALES TRACKER .xlsx files and extracts structured budget data.
"""

import io
import logging
from datetime import datetime

import openpyxl

logger = logging.getLogger(__name__)


def _safe_float(val, default=0.0):
    """Convert cell value to float, returning default if None or invalid."""
    if val is None:
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


def _safe_int(val, default=0):
    """Convert cell value to int, returning default if None or invalid."""
    if val is None:
        return default
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return default


def _parse_date(val):
    """Convert date cell to string. Handles datetime objects and strings."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.strftime("%-m/%-d/%Y")
    return str(val)


def parse_budget_excel(file_bytes: bytes) -> dict:
    """
    Parse a DAILY SALES TRACKER Excel file and return structured budget data.

    Returns the same dict structure as extract_budget_sheet() in gemini_vision.py
    so the frontend confirm flow works unchanged.

    Excel layout (confirmed from actual file):
      Row 1: Headers
      Rows 2-32: Daily data (C1=SL, C2=2025 date, C3=2026 date, C4=DAY,
                  C5=LY sales, C8=Budget, C10=LY GC, C13=MTD LY, C16=MTD Budget)
      Row with C1="TOTAL": Totals row
      Below totals: KPIs (ATV, AUV, Cake QTY, HP QTY)
    """
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    ws = wb.active

    daily_data = []
    totals_row = None
    kpi_rows = {}

    # Parse all rows
    for row in range(2, ws.max_row + 1):
        c1 = ws.cell(row=row, column=1).value

        # Check for TOTAL row
        if c1 is not None and str(c1).strip().upper() == "TOTAL":
            totals_row = row
            continue

        # After TOTAL row, look for KPIs
        if totals_row is not None:
            c2 = ws.cell(row=row, column=2).value
            if c2 is not None:
                label = str(c2).strip().upper()
                c3 = ws.cell(row=row, column=3).value
                if "ATV" in label:
                    kpi_rows["atv"] = _safe_float(c3)
                elif "AUV" in label:
                    kpi_rows["auv"] = _safe_float(c3)
                elif "CAKE" in label:
                    kpi_rows["cake_qty"] = _safe_float(c3)
                elif "HP" in label:
                    kpi_rows["hp_qty"] = _safe_float(c3)
            continue

        # Parse daily data rows — C1 should be a number (serial)
        try:
            sl = int(float(c1))
        except (ValueError, TypeError):
            continue

        ly_sales = _safe_float(ws.cell(row=row, column=5).value)
        budget = _safe_float(ws.cell(row=row, column=8).value)
        # If budget is 0, try C6 (some sheets use C6 for budget)
        if budget == 0:
            budget = _safe_float(ws.cell(row=row, column=6).value)

        ly_gc = _safe_int(ws.cell(row=row, column=10).value)
        mtd_ly = _safe_float(ws.cell(row=row, column=13).value)
        mtd_budget = _safe_float(ws.cell(row=row, column=16).value)

        day_entry = {
            "sl": sl,
            "date_2025": _parse_date(ws.cell(row=row, column=2).value),
            "date_2026": _parse_date(ws.cell(row=row, column=3).value),
            "day": str(ws.cell(row=row, column=4).value or ""),
            "days_sales": {
                "ly_2025": ly_sales if ly_sales else None,
                "current_2026": _safe_float(ws.cell(row=row, column=6).value) or None,
                "growth_pct": _safe_float(ws.cell(row=row, column=7).value) or None,
                "budget": budget if budget else None,
                "achievement_pct": _safe_float(ws.cell(row=row, column=9).value) or None,
            },
            "days_guest_count": {
                "ly_2025": ly_gc if ly_gc else None,
                "current_2026": _safe_int(ws.cell(row=row, column=11).value) or None,
                "growth_pct": _safe_float(ws.cell(row=row, column=12).value) or None,
            },
            "mtd_sales": {
                "ly_2025": mtd_ly if mtd_ly else None,
                "current_2026": _safe_float(ws.cell(row=row, column=14).value) or None,
                "growth_pct": _safe_float(ws.cell(row=row, column=15).value) or None,
                "budget": mtd_budget if mtd_budget else None,
                "achievement_pct": _safe_float(ws.cell(row=row, column=17).value) or None,
            },
        }

        daily_data.append(day_entry)

    wb.close()

    # Build KPIs structure
    kpis = {
        "atv": {"ly_2025": kpi_rows.get("atv"), "current_2026": None, "diff_vs_py": None},
        "auv": {"ly_2025": kpi_rows.get("auv"), "current_2026": None, "diff_vs_py": None},
        "cake_qty": {"ly_2025": kpi_rows.get("cake_qty"), "current_2026": None, "diff_vs_py": None},
        "hp_qty": {"ly_2025": kpi_rows.get("hp_qty"), "current_2026": None, "diff_vs_py": None},
    }

    # Build totals from TOTAL row
    totals = {
        "ly_sales_total": _safe_float(ws.cell(row=totals_row, column=2).value) if totals_row else 0,
        "budget_total": _safe_float(ws.cell(row=totals_row, column=5).value) if totals_row else 0,
        "ly_gc_total": _safe_int(ws.cell(row=totals_row, column=10).value) if totals_row else 0,
        "current_sales_total": None,
        "current_gc_total": None,
    }

    # Calculate _budget_gc and _ly_atv for each day (same logic as gemini_vision.py)
    ly_atv_overall = kpi_rows.get("atv", 0) or 0

    for day in daily_data:
        ly_gc = (day.get("days_guest_count") or {}).get("ly_2025") or 0
        ly_sales_val = (day.get("days_sales") or {}).get("ly_2025") or 0
        budget_val = (day.get("days_sales") or {}).get("budget") or 0

        day_ly_atv = (ly_sales_val / ly_gc) if ly_gc > 0 else ly_atv_overall
        day["_ly_atv"] = round(day_ly_atv, 2)

        if budget_val > 0 and day_ly_atv > 0:
            day["_budget_gc"] = round(budget_val / day_ly_atv)
        else:
            day["_budget_gc"] = 0

        day["_budget_atv"] = round(budget_val / day["_budget_gc"], 2) if day["_budget_gc"] > 0 else 0

    return {
        "header": {
            "title": "DAILY SALES TRACKER",
            "parlor_name": None,
            "month": None,
            "month_code": None,
            "area_manager": None,
        },
        "daily_data": daily_data,
        "totals": totals,
        "kpis": kpis,
    }
