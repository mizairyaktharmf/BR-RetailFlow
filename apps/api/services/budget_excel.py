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


def _detect_columns(ws) -> dict:
    """
    Auto-detect column positions by scanning the header rows (rows 1-5).
    Looks for key labels to find SL, DAY, LY Sales, Budget, LY GC, MTD LY, MTD Budget.
    Falls back to known layout if detection fails.

    Actual format from screenshot:
      A=SL, B=Date(2026), C=DAY, D=2025(LY sales), E=2026, F=Grth%,
      G=Budget, H=Ach%, I=2025 GC, J=2026 GC, K=Grth%,
      L=MTD 2025, M=MTD 2026, N=MTD Grth%, O=MTD Budget, P=MTD Ach%
    """
    # Default column mapping (1-indexed) matching screenshot format
    cols = {
        "sl": 1,          # A - SL number
        "date": 2,        # B - Date 2026
        "day": 3,         # C - Day name (Mon/Tue etc)
        "ly_sales": 4,    # D - 2025 LY sales
        "cur_sales": 5,   # E - 2026 current sales
        "grth_sales": 6,  # F - Growth %
        "budget": 7,      # G - Budget
        "ach_sales": 8,   # H - Achievement %
        "ly_gc": 9,       # I - 2025 GC
        "cur_gc": 10,     # J - 2026 GC
        "grth_gc": 11,    # K - GC Growth %
        "mtd_ly": 12,     # L - MTD 2025
        "mtd_cur": 13,    # M - MTD 2026
        "mtd_grth": 14,   # N - MTD Growth %
        "mtd_budget": 15, # O - MTD Budget
        "mtd_ach": 16,    # P - MTD Achievement %
    }

    # Try to auto-detect by scanning first 5 rows for column headers
    for row in range(1, 6):
        for col in range(1, ws.max_column + 1):
            val = ws.cell(row=row, column=col).value
            if val is None:
                continue
            label = str(val).strip().upper()
            if label in ("SL",):
                cols["sl"] = col
            elif label in ("DAY",):
                cols["day"] = col
            elif "BUDGET" in label and col < 12:
                # Day budget (left side)
                cols["budget"] = col
            elif "BUDGET" in label and col >= 12:
                # MTD budget (right side)
                cols["mtd_budget"] = col

    return cols


def parse_budget_excel(file_bytes: bytes) -> dict:
    """
    Parse a DAILY SALES TRACKER Excel file and return structured budget data.

    Supports the actual format:
      A=SL, B=Date, C=DAY, D=LY 2025 sales, E=2026 sales, F=Grth%,
      G=Budget, H=Ach%, I=LY 2025 GC, J=2026 GC, K=Grth%,
      L=MTD LY 2025, M=MTD 2026, N=MTD Grth%, O=MTD Budget, P=MTD Ach%

    Below TOTAL row: KPI table with ATV, AUV, Cake QTY, HP QTY
    """
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    ws = wb.active

    cols = _detect_columns(ws)
    logger.info(f"Budget Excel column map: {cols}")

    daily_data = []
    totals_row = None
    kpi_rows = {}

    def cell(r, key):
        return ws.cell(row=r, column=cols[key]).value

    # Parse all rows
    for row in range(2, ws.max_row + 1):
        c_sl = ws.cell(row=row, column=cols["sl"]).value

        # Check for TOTAL row — can appear in col A or col B
        row_text = ""
        for c in range(1, min(4, ws.max_column + 1)):
            v = ws.cell(row=row, column=c).value
            if v:
                row_text += str(v).strip().upper()
        if "TOTAL" in row_text:
            totals_row = row
            continue

        # After TOTAL row: look for KPI rows
        if totals_row is not None:
            # KPIs are in a small table below; scan col B and C for label/value
            for kpi_col_label, kpi_col_val in [(2, 3), (1, 2), (2, 4)]:
                label_val = ws.cell(row=row, column=kpi_col_label).value
                if label_val is None:
                    continue
                label = str(label_val).strip().upper()
                val_cell = ws.cell(row=row, column=kpi_col_val).value
                if "ATV" in label:
                    kpi_rows["atv"] = _safe_float(val_cell)
                    break
                elif "AUV" in label:
                    kpi_rows["auv"] = _safe_float(val_cell)
                    break
                elif "CAKE" in label:
                    kpi_rows["cake_qty"] = _safe_float(val_cell)
                    break
                elif "HP" in label:
                    kpi_rows["hp_qty"] = _safe_float(val_cell)
                    break
            continue

        # Parse daily data rows — SL col should be a number
        try:
            sl = int(float(c_sl))
        except (ValueError, TypeError):
            continue

        ly_sales  = _safe_float(cell(row, "ly_sales"))
        budget    = _safe_float(cell(row, "budget"))
        ly_gc     = _safe_int(cell(row, "ly_gc"))
        mtd_ly    = _safe_float(cell(row, "mtd_ly"))
        mtd_budget = _safe_float(cell(row, "mtd_budget"))

        day_entry = {
            "sl": sl,
            "date_2026": _parse_date(cell(row, "date")),
            "date_2025": None,
            "day": str(cell(row, "day") or ""),
            "days_sales": {
                "ly_2025":        ly_sales if ly_sales else None,
                "current_2026":   _safe_float(cell(row, "cur_sales")) or None,
                "growth_pct":     _safe_float(cell(row, "grth_sales")) or None,
                "budget":         budget if budget else None,
                "achievement_pct":_safe_float(cell(row, "ach_sales")) or None,
            },
            "days_guest_count": {
                "ly_2025":      ly_gc if ly_gc else None,
                "current_2026": _safe_int(cell(row, "cur_gc")) or None,
                "growth_pct":   _safe_float(cell(row, "grth_gc")) or None,
            },
            "mtd_sales": {
                "ly_2025":        mtd_ly if mtd_ly else None,
                "current_2026":   _safe_float(cell(row, "mtd_cur")) or None,
                "growth_pct":     _safe_float(cell(row, "mtd_grth")) or None,
                "budget":         mtd_budget if mtd_budget else None,
                "achievement_pct":_safe_float(cell(row, "mtd_ach")) or None,
            },
        }

        daily_data.append(day_entry)

    wb.close()

    # Build KPIs structure
    kpis = {
        "atv":      {"ly_2025": kpi_rows.get("atv"),      "current_2026": None, "diff_vs_py": None},
        "auv":      {"ly_2025": kpi_rows.get("auv"),      "current_2026": None, "diff_vs_py": None},
        "cake_qty": {"ly_2025": kpi_rows.get("cake_qty"), "current_2026": None, "diff_vs_py": None},
        "hp_qty":   {"ly_2025": kpi_rows.get("hp_qty"),   "current_2026": None, "diff_vs_py": None},
    }

    # Build totals from TOTAL row
    totals = {
        "ly_sales_total":     _safe_float(ws.cell(row=totals_row, column=cols["ly_sales"]).value) if totals_row else 0,
        "budget_total":       _safe_float(ws.cell(row=totals_row, column=cols["budget"]).value)   if totals_row else 0,
        "ly_gc_total":        _safe_int(ws.cell(row=totals_row,   column=cols["ly_gc"]).value)    if totals_row else 0,
        "current_sales_total": None,
        "current_gc_total":    None,
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
