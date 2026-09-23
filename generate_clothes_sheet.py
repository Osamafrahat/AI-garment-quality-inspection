import openpyxl
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, numbers
from openpyxl.chart import BarChart, PieChart, LineChart, Reference
from openpyxl.chart.series import SeriesLabel
from openpyxl.chart.label import DataLabelList
from openpyxl.utils import get_column_letter
from copy import copy

wb = Workbook()

# ── Color / style constants ──────────────────────────────────────────
DARK_BLUE   = "1F4E79"
MED_BLUE    = "2E75B6"
LIGHT_BLUE  = "D6E4F0"
WHITE       = "FFFFFF"
BLACK       = "000000"
GREEN       = "C6EFCE"
GREEN_DARK  = "27AE60"
RED         = "FFC7CE"
RED_DARK    = "E74C3C"
YELLOW      = "FFEB9C"
ORANGE      = "F39C12"
GRAY_LIGHT  = "F2F2F2"
GRAY_MED    = "D9D9D9"

hdr_font   = Font(name="Calibri", bold=True, color=WHITE, size=11)
hdr_fill   = PatternFill("solid", fgColor=DARK_BLUE)
sub_font   = Font(name="Calibri", bold=True, color=DARK_BLUE, size=11)
sub_fill   = PatternFill("solid", fgColor=LIGHT_BLUE)
data_font  = Font(name="Calibri", size=10)
title_font = Font(name="Calibri", bold=True, size=14, color=DARK_BLUE)
title2_font= Font(name="Calibri", bold=True, size=12, color=MED_BLUE)
thin_border= Border(
    left=Side(style="thin"), right=Side(style="thin"),
    top=Side(style="thin"), bottom=Side(style="thin"))
center      = Alignment(horizontal="center", vertical="center")
left_align  = Alignment(horizontal="left", vertical="center")
wrap        = Alignment(horizontal="center", vertical="center", wrap_text=True)

def style_header_row(ws, row, cols, font=hdr_font, fill=hdr_fill):
    for c in range(1, cols + 1):
        cell = ws.cell(row=row, column=c)
        cell.font = font
        cell.fill = fill
        cell.alignment = center
        cell.border = thin_border

def style_data_cell(ws, row, col, fmt=None):
    cell = ws.cell(row=row, column=col)
    cell.font = data_font
    cell.alignment = center
    cell.border = thin_border
    if fmt:
        cell.number_format = fmt
    return cell

def style_range(ws, start_row, end_row, start_col, end_col, fmt=None):
    for r in range(start_row, end_row + 1):
        for c in range(start_col, end_col + 1):
            style_data_cell(ws, r, c, fmt)

# ════════════════════════════════════════════════════════════════════
#  SHEET 1 — CUTS INPUT
# ════════════════════════════════════════════════════════════════════
ws1 = wb.active
ws1.title = "Cuts Input"
ws1.sheet_properties.tabColor = DARK_BLUE

# Title
ws1.merge_cells("A1:L1")
ws1["A1"].value = "CLOTHES INDUSTRY — CUTS INPUT SHEET"
ws1["A1"].font = title_font
ws1["A1"].alignment = Alignment(horizontal="center", vertical="center")
ws1.row_dimensions[1].height = 30

ws1.merge_cells("A2:L2")
ws1["A2"].value = "Enter cut data below  |  2 Product Lines  |  6 Sizes (S M L XL XXL XXXL)"
ws1["A2"].font = Font(name="Calibri", italic=True, size=10, color=MED_BLUE)
ws1["A2"].alignment = Alignment(horizontal="center")

# Headers row 4
headers = [
    "Cut #", "Product Line", "Cut Date", "No. of Sheets\n(Layers)",
    "Pieces per\nMarker/Sheet",
    "S %", "M %", "L %", "XL %", "XXL %", "XXXL %",
    "Total Pieces"
]
for i, h in enumerate(headers, 1):
    ws1.cell(row=4, column=i, value=h)
style_header_row(ws1, 4, len(headers))
ws1.row_dimensions[4].height = 35

# ── Sample data ──────────────────────────────────────────────────────
sample_cuts = [
    # (cut_no, product_line, date, sheets, pcs_per_marker, s%, m%, l%, xl%, xxl%, xxxl%)
    (1,  "Line A — T-Shirt",   "2026-08-01", 25, 16, 15, 20, 25, 20, 12,  8),
    (2,  "Line A — T-Shirt",   "2026-08-02", 30, 16, 15, 20, 25, 20, 12,  8),
    (3,  "Line B — Polo Shirt", "2026-08-03", 20, 18, 12, 18, 25, 22, 15,  8),
    (4,  "Line A — T-Shirt",   "2026-08-04", 28, 16, 15, 20, 25, 20, 12,  8),
    (5,  "Line B — Polo Shirt", "2026-08-05", 22, 18, 12, 18, 25, 22, 15,  8),
    (6,  "Line A — T-Shirt",   "2026-08-06", 35, 16, 15, 20, 25, 20, 12,  8),
    (7,  "Line B — Polo Shirt", "2026-08-07", 18, 18, 12, 18, 25, 22, 15,  8),
    (8,  "Line A — T-Shirt",   "2026-08-08", 32, 16, 15, 20, 25, 20, 12,  8),
    (9,  "Line B — Polo Shirt", "2026-08-09", 24, 18, 12, 18, 25, 22, 15,  8),
    (10, "Line A — T-Shirt",   "2026-08-10", 27, 16, 15, 20, 25, 20, 12,  8),
    (11, "Line B — Polo Shirt", "2026-08-11", 26, 18, 12, 18, 25, 22, 15,  8),
    (12, "Line A — T-Shirt",   "2026-08-12", 30, 16, 15, 20, 25, 20, 12,  8),
    (13, "Line B — Polo Shirt", "2026-08-13", 20, 18, 12, 18, 25, 22, 15,  8),
    (14, "Line A — T-Shirt",   "2026-08-14", 34, 16, 15, 20, 25, 20, 12,  8),
]

for idx, row_data in enumerate(sample_cuts):
    r = 5 + idx
    for c, val in enumerate(row_data, 1):
        cell = ws1.cell(row=r, column=c, value=val)
        cell.font = data_font
        cell.alignment = center
        cell.border = thin_border
    # Date formatting
    ws1.cell(row=r, column=3).number_format = "YYYY-MM-DD"
    # Percentage formatting for size ratios
    for pc in range(6, 12):
        ws1.cell(row=r, column=pc).number_format = "0%"
    # Total Pieces formula
    total_cell = ws1.cell(row=r, column=12)
    total_cell.value = f"=D{r}*E{r}"
    total_cell.number_format = "#,##0"
    total_cell.font = Font(name="Calibri", bold=True, size=10)
    total_cell.alignment = center
    total_cell.border = thin_border

# Totals row
total_row = 5 + len(sample_cuts)
ws1.cell(row=total_row, column=1, value="TOTAL").font = Font(name="Calibri", bold=True, size=11, color=WHITE)
ws1.cell(row=total_row, column=1).fill = PatternFill("solid", fgColor=MED_BLUE)
ws1.cell(row=total_row, column=1).alignment = center
ws1.cell(row=total_row, column=1).border = thin_border
for c in range(2, 12):
    style_data_cell(ws1, total_row, c)
    ws1.cell(row=total_row, column=c).fill = PatternFill("solid", fgColor=GRAY_MED)
    ws1.cell(row=total_row, column=c).font = Font(name="Calibri", bold=True, size=10)
ws1.cell(row=total_row, column=12, value=f"=SUM(L5:L{total_row-1})")
ws1.cell(row=total_row, column=12).number_format = "#,##0"
ws1.cell(row=total_row, column=12).font = Font(name="Calibri", bold=True, size=11, color=WHITE)
ws1.cell(row=total_row, column=12).fill = PatternFill("solid", fgColor=MED_BLUE)
ws1.cell(row=total_row, column=12).alignment = center
ws1.cell(row=total_row, column=12).border = thin_border

# Column widths
col_widths_1 = [8, 22, 14, 16, 16, 8, 8, 8, 8, 8, 8, 14]
for i, w in enumerate(col_widths_1, 1):
    ws1.column_dimensions[get_column_letter(i)].width = w

# ════════════════════════════════════════════════════════════════════
#  SHEET 2 — OUTPUT BY SIZE
# ════════════════════════════════════════════════════════════════════
ws2 = wb.create_sheet("Output by Size")
ws2.sheet_properties.tabColor = GREEN_DARK

ws2.merge_cells("A1:I1")
ws2["A1"].value = "OUTPUT PIECES BY SIZE"
ws2["A1"].font = title_font
ws2["A1"].alignment = Alignment(horizontal="center", vertical="center")
ws2.row_dimensions[1].height = 28

ws2.merge_cells("A2:I2")
ws2["A2"].value = "Calculated from Cuts Input  |  Pieces = Sheets × Marker × Size %"
ws2["A2"].font = Font(name="Calibri", italic=True, size=10, color=MED_BLUE)
ws2["A2"].alignment = Alignment(horizontal="center")

out_headers = ["Cut #", "Product Line", "Cut Date", "S", "M", "L", "XL", "XXL", "XXXL"]
for i, h in enumerate(out_headers, 1):
    ws2.cell(row=4, column=i, value=h)
style_header_row(ws2, 4, len(out_headers))
ws2.row_dimensions[4].height = 28

sizes = ["S", "M", "L", "XL", "XXL", "XXXL"]
for idx in range(len(sample_cuts)):
    r = 5 + idx
    cut_no = idx + 1
    ws2.cell(row=r, column=1, value=cut_no)
    ws2.cell(row=r, column=2, value=sample_cuts[idx][1])
    ws2.cell(row=r, column=3, value=sample_cuts[idx][2])
    for si, size in enumerate(sizes):
        col = 4 + si
        src_col_letter = get_column_letter(6 + si)   # F..K on Cuts Input
        formula = f"='Cuts Input'!D{r}*'Cuts Input'!E{r}*'{src_col_letter}{r}"
        cell = ws2.cell(row=r, column=col, value=formula)
        cell.number_format = "#,##0"
        cell.font = data_font
        cell.alignment = center
        cell.border = thin_border
    ws2.cell(row=r, column=1).font = data_font
    ws2.cell(row=r, column=1).alignment = center
    ws2.cell(row=r, column=1).border = thin_border
    ws2.cell(row=r, column=2).font = data_font
    ws2.cell(row=r, column=2).alignment = center
    ws2.cell(row=r, column=2).border = thin_border
    ws2.cell(row=r, column=3).font = data_font
    ws2.cell(row=r, column=3).alignment = center
    ws2.cell(row=r, column=3).border = thin_border

# Totals row
out_total_row = 5 + len(sample_cuts)
ws2.cell(row=out_total_row, column=1, value="TOTAL")
ws2.cell(row=out_total_row, column=1).font = Font(name="Calibri", bold=True, color=WHITE)
ws2.cell(row=out_total_row, column=1).fill = PatternFill("solid", fgColor=MED_BLUE)
ws2.cell(row=out_total_row, column=1).alignment = center
ws2.cell(row=out_total_row, column=1).border = thin_border
for c in range(2, 4):
    style_data_cell(ws2, out_total_row, c)
    ws2.cell(row=out_total_row, column=c).fill = PatternFill("solid", fgColor=GRAY_MED)
for c in range(4, 10):
    col_ltr = get_column_letter(c)
    cell = ws2.cell(row=out_total_row, column=c,
                    value=f"=SUM({col_ltr}5:{col_ltr}{out_total_row-1})")
    cell.number_format = "#,##0"
    cell.font = Font(name="Calibri", bold=True, size=11, color=WHITE)
    cell.fill = PatternFill("solid", fgColor=MED_BLUE)
    cell.alignment = center
    cell.border = thin_border

col_widths_2 = [8, 22, 14, 10, 10, 10, 10, 10, 10]
for i, w in enumerate(col_widths_2, 1):
    ws2.column_dimensions[get_column_letter(i)].width = w

# ── Per-Line Summary on right side ───────────────────────────────────
summary_col = 11
ws2.cell(row=4, column=summary_col, value="SUMMARY BY LINE")
ws2.cell(row=4, column=summary_col).font = title2_font
ws2.cell(row=4, column=summary_col).alignment = center
ws2.merge_cells(start_row=4, start_column=summary_col, end_row=4, end_column=summary_col+7)

for i, h in enumerate(["Product Line"] + sizes + ["Total"]):
    ws2.cell(row=5, column=summary_col+i, value=h)
    cell = ws2.cell(row=5, column=summary_col+i)
    cell.font = hdr_font
    cell.fill = hdr_fill
    cell.alignment = center
    cell.border = thin_border

# Line A summary
ws2.cell(row=6, column=summary_col, value="Line A — T-Shirt")
ws2.cell(row=6, column=summary_col).font = data_font
ws2.cell(row=6, column=summary_col).border = thin_border
for si in range(6):
    col_ltr = get_column_letter(4 + si)
    formula_parts = "+".join([f"{col_ltr}{r}" for r in range(5, out_total_row) if sample_cuts[r-5][1] == "Line A — T-Shirt"])
    cell = ws2.cell(row=6, column=summary_col+1+si, value=formula_parts)
    cell.number_format = "#,##0"
    cell.font = data_font
    cell.alignment = center
    cell.border = thin_border
ws2.cell(row=6, column=summary_col+7, value=f"=SUM({get_column_letter(summary_col+1)}6:{get_column_letter(summary_col+6)}6)")
ws2.cell(row=6, column=summary_col+7).number_format = "#,##0"
ws2.cell(row=6, column=summary_col+7).font = Font(name="Calibri", bold=True, size=10)
ws2.cell(row=6, column=summary_col+7).border = thin_border
ws2.cell(row=6, column=summary_col+7).alignment = center

# Line B summary
ws2.cell(row=7, column=summary_col, value="Line B — Polo Shirt")
ws2.cell(row=7, column=summary_col).font = data_font
ws2.cell(row=7, column=summary_col).border = thin_border
for si in range(6):
    col_ltr = get_column_letter(4 + si)
    formula_parts = "+".join([f"{col_ltr}{r}" for r in range(5, out_total_row) if sample_cuts[r-5][1] == "Line B — Polo Shirt"])
    cell = ws2.cell(row=7, column=summary_col+1+si, value=formula_parts)
    cell.number_format = "#,##0"
    cell.font = data_font
    cell.alignment = center
    cell.border = thin_border
ws2.cell(row=7, column=summary_col+7, value=f"=SUM({get_column_letter(summary_col+1)}7:{get_column_letter(summary_col+6)}7)")
ws2.cell(row=7, column=summary_col+7).number_format = "#,##0"
ws2.cell(row=7, column=summary_col+7).font = Font(name="Calibri", bold=True, size=10)
ws2.cell(row=7, column=summary_col+7).border = thin_border
ws2.cell(row=7, column=summary_col+7).alignment = center

# ════════════════════════════════════════════════════════════════════
#  SHEET 3 — PRODUCTION TIMELINE (DIAGONAL)
# ════════════════════════════════════════════════════════════════════
ws3 = wb.create_sheet("Timeline Diagonal")
ws3.sheet_properties.tabColor = ORANGE

ws3.merge_cells("A1:P1")
ws3["A1"].value = "PRODUCTION TIMELINE — ON-TIME DIAGONAL"
ws3["A1"].font = title_font
ws3["A1"].alignment = Alignment(horizontal="center", vertical="center")
ws3.row_dimensions[1].height = 30

ws3.merge_cells("A2:P2")
ws3["A2"].value = "Diagonal = On-Time  |  Below Diagonal = Late  |  Above Diagonal = Early"
ws3["A2"].font = Font(name="Calibri", italic=True, size=10, color=MED_BLUE)
ws3["A2"].alignment = Alignment(horizontal="center")

# ── Part A: Cut → Ship Plan ──────────────────────────────────────────
ws3.cell(row=4, column=1, value="CUT-TO-SHIP PLAN")
ws3.cell(row=4, column=1).font = title2_font
ws3.merge_cells("A4:L4")

plan_headers = ["Cut #", "Product Line", "Cut Day", "Planned Ship Day",
                "Actual Ship Day", "Status", "S", "M", "L", "XL", "XXL", "XXXL"]
for i, h in enumerate(plan_headers, 1):
    ws3.cell(row=5, column=i, value=h)
style_header_row(ws3, 5, len(plan_headers))

# Schedule data: cut_day (1-14), planned ship = cut_day + 2, actual ship (varies)
schedule = [
    (1,  "Line A — T-Shirt",    1,  3,  3),
    (2,  "Line A — T-Shirt",    2,  4,  4),
    (3,  "Line B — Polo Shirt", 3,  5,  5),
    (4,  "Line A — T-Shirt",    4,  6,  7),   # late
    (5,  "Line B — Polo Shirt", 5,  7,  7),
    (6,  "Line A — T-Shirt",    6,  8,  6),   # early
    (7,  "Line B — Polo Shirt", 7,  9,  9),
    (8,  "Line A — T-Shirt",    8, 10, 10),
    (9,  "Line B — Polo Shirt", 9, 11, 12),   # late
    (10, "Line A — T-Shirt",   10, 12, 12),
    (11, "Line B — Polo Shirt",11, 13, 11),   # early
    (12, "Line A — T-Shirt",   12, 14, 14),
    (13, "Line B — Polo Shirt",13, 15, 15),
    (14, "Line A — T-Shirt",   14, 16, 17),   # late
]

on_time_count = 0
early_count   = 0
late_count    = 0

for idx, sched in enumerate(schedule):
    r = 6 + idx
    cut_no, line, cut_day, plan_day, act_day = sched

    if act_day < plan_day:
        status = "EARLY"
        status_fill = PatternFill("solid", fgColor=YELLOW)
    elif act_day == plan_day:
        status = "ON TIME"
        status_fill = PatternFill("solid", fgColor=GREEN)
    else:
        status = "LATE"
        status_fill = PatternFill("solid", fgColor=RED)

    if status == "ON TIME":   on_time_count += 1
    if status == "EARLY":     early_count += 1
    if status == "LATE":      late_count += 1

    vals = [cut_no, line, cut_day, plan_day, act_day, status]
    for c, v in enumerate(vals, 1):
        cell = ws3.cell(row=r, column=c, value=v)
        cell.font = data_font
        cell.alignment = center
        cell.border = thin_border
    ws3.cell(row=r, column=6).fill = status_fill
    ws3.cell(row=r, column=6).font = Font(name="Calibri", bold=True, size=10)

    # Size output from Cuts Input
    src_r = 5 + idx
    for si in range(6):
        col_ltr = get_column_letter(6 + si)
        formula = f"='Cuts Input'!D{src_r}*'Cuts Input'!E{src_r}*'{col_ltr}{src_r}'"
        cell = ws3.cell(row=r, column=7+si, value=formula)
        cell.number_format = "#,##0"
        cell.font = data_font
        cell.alignment = center
        cell.border = thin_border

# ── Part B: Diagonal Matrix ──────────────────────────────────────────
diag_start_row = 6 + len(schedule) + 2
ws3.cell(row=diag_start_row, column=1, value="DIAGONAL MATRIX — Cut Day vs Ship Day")
ws3.cell(row=diag_start_row, column=1).font = title2_font
ws3.merge_cells(f"A{diag_start_row}:J{diag_start_row}")

# Legend row
leg_row = diag_start_row + 1
ws3.cell(row=leg_row, column=1, value="Legend:")
ws3.cell(row=leg_row, column=1).font = Font(name="Calibri", bold=True, size=10)
ws3.cell(row=leg_row, column=2, value="On Time").fill = PatternFill("solid", fgColor=GREEN)
ws3.cell(row=leg_row, column=2).font = data_font
ws3.cell(row=leg_row, column=2).border = thin_border
ws3.cell(row=leg_row, column=3, value="Early").fill = PatternFill("solid", fgColor=YELLOW)
ws3.cell(row=leg_row, column=3).font = data_font
ws3.cell(row=leg_row, column=3).border = thin_border
ws3.cell(row=leg_row, column=4, value="Late").fill = PatternFill("solid", fgColor=RED)
ws3.cell(row=leg_row, column=4).font = data_font
ws3.cell(row=leg_row, column=4).border = thin_border

matrix_hdr_row = diag_start_row + 2
# Days 1..17 (max ship day)
max_day = 17
ws3.cell(row=matrix_hdr_row, column=1, value="Cut \\ Ship →")
ws3.cell(row=matrix_hdr_row, column=1).font = hdr_font
ws3.cell(row=matrix_hdr_row, column=1).fill = hdr_fill
ws3.cell(row=matrix_hdr_row, column=1).alignment = center
ws3.cell(row=matrix_hdr_row, column=1).border = thin_border

for d in range(1, max_day + 1):
    c = 1 + d
    cell = ws3.cell(row=matrix_hdr_row, column=c, value=f"Day {d}")
    cell.font = hdr_font
    cell.fill = hdr_fill
    cell.alignment = center
    cell.border = thin_border
    ws3.column_dimensions[get_column_letter(c)].width = 9

ws3.column_dimensions["A"].width = 14

# Build lookup: (cut_day, ship_day) -> cut_no
day_map = {}
for sched in schedule:
    cut_day = sched[2]
    act_day = sched[4]
    if cut_day not in day_map:
        day_map[cut_day] = {}
    day_map[cut_day][act_day] = sched[0]

# Fill matrix rows
for cut_day in range(1, max_day + 1):
    r = matrix_hdr_row + cut_day
    ws3.cell(row=r, column=1, value=f"Day {cut_day}")
    ws3.cell(row=r, column=1).font = Font(name="Calibri", bold=True, size=10, color=WHITE)
    ws3.cell(row=r, column=1).fill = PatternFill("solid", fgColor=DARK_BLUE)
    ws3.cell(row=r, column=1).alignment = center
    ws3.cell(row=r, column=1).border = thin_border

    for ship_day in range(1, max_day + 1):
        c = 1 + ship_day
        cell = ws3.cell(row=r, column=c)
        cell.border = thin_border
        cell.alignment = center
        cell.font = Font(name="Calibri", bold=True, size=10)

        if cut_day in day_map and ship_day in day_map[cut_day]:
            cell.value = f"C{day_map[cut_day][ship_day]}"
            planned = day_map[cut_day].get(ship_day)
            # Check if this was on time (planned = cut_day+2)
            sched_entry = [s for s in schedule if s[0] == day_map[cut_day][ship_day]][0]
            act = sched_entry[4]
            plan = sched_entry[3]
            if act == plan:
                cell.fill = PatternFill("solid", fgColor=GREEN)
            elif act < plan:
                cell.fill = PatternFill("solid", fgColor=YELLOW)
            else:
                cell.fill = PatternFill("solid", fgColor=RED)

# ── Part C: Status Summary ───────────────────────────────────────────
sum_row = matrix_hdr_row + max_day + 2
ws3.cell(row=sum_row, column=1, value="STATUS SUMMARY")
ws3.cell(row=sum_row, column=1).font = title2_font
ws3.merge_cells(f"A{sum_row}:D{sum_row}")

for i, h in enumerate(["Status", "Count", "% of Total"]):
    ws3.cell(row=sum_row+1, column=1+i, value=h)
    cell = ws3.cell(row=sum_row+1, column=1+i)
    cell.font = hdr_font
    cell.fill = hdr_fill
    cell.alignment = center
    cell.border = thin_border

total_cuts = len(schedule)
for si, (label, count, color) in enumerate([
    ("ON TIME", on_time_count, GREEN),
    ("EARLY",   early_count,   YELLOW),
    ("LATE",    late_count,    RED),
]):
    r = sum_row + 2 + si
    ws3.cell(row=r, column=1, value=label).border = thin_border
    ws3.cell(row=r, column=1).fill = PatternFill("solid", fgColor=color)
    ws3.cell(row=r, column=1).font = Font(name="Calibri", bold=True, size=10)
    ws3.cell(row=r, column=1).alignment = center
    ws3.cell(row=r, column=2, value=count).border = thin_border
    ws3.cell(row=r, column=2).font = data_font
    ws3.cell(row=r, column=2).alignment = center
    pct_cell = ws3.cell(row=r, column=3, value=count/total_cuts)
    pct_cell.number_format = "0.0%"
    pct_cell.border = thin_border
    pct_cell.font = data_font
    pct_cell.alignment = center

ws3.cell(row=sum_row+5, column=1, value="TOTAL").border = thin_border
ws3.cell(row=sum_row+5, column=1).font = Font(name="Calibri", bold=True, size=10)
ws3.cell(row=sum_row+5, column=1).fill = PatternFill("solid", fgColor=GRAY_MED)
ws3.cell(row=sum_row+5, column=1).alignment = center
ws3.cell(row=sum_row+5, column=2, value=total_cuts).border = thin_border
ws3.cell(row=sum_row+5, column=2).font = Font(name="Calibri", bold=True, size=10)
ws3.cell(row=sum_row+5, column=2).fill = PatternFill("solid", fgColor=GRAY_MED)
ws3.cell(row=sum_row+5, column=2).alignment = center
ws3.cell(row=sum_row+5, column=3, value=1).number_format = "0.0%"
ws3.cell(row=sum_row+5, column=3).border = thin_border
ws3.cell(row=sum_row+5, column=3).fill = PatternFill("solid", fgColor=GRAY_MED)
ws3.cell(row=sum_row+5, column=3).font = Font(name="Calibri", bold=True, size=10)
ws3.cell(row=sum_row+5, column=3).alignment = center

# ════════════════════════════════════════════════════════════════════
#  SHEET 4 — DASHBOARD
# ════════════════════════════════════════════════════════════════════
ws4 = wb.create_sheet("Dashboard")
ws4.sheet_properties.tabColor = RED_DARK

ws4.merge_cells("A1:R1")
ws4["A1"].value = "DASHBOARD — CLOTHES PRODUCTION"
ws4["A1"].font = Font(name="Calibri", bold=True, size=18, color=DARK_BLUE)
ws4["A1"].alignment = Alignment(horizontal="center", vertical="center")
ws4.row_dimensions[1].height = 35

ws4.merge_cells("A2:R2")
ws4["A2"].value = "2 Product Lines  |  6 Sizes  |  14 Cuts  |  Plan vs Actual Tracking"
ws4["A2"].font = Font(name="Calibri", italic=True, size=11, color=MED_BLUE)
ws4["A2"].alignment = Alignment(horizontal="center")

# ── KPI Cards (top row) ──────────────────────────────────────────────
kpi_row = 4
kpi_labels = [
    ("Total Cuts", f"='Cuts Input'!L{total_row}"),
    ("Total Pieces", f"='Cuts Input'!L{total_row}"),
    ("On-Time %", f"='Timeline Diagonal'!C{sum_row+2}"),
    ("Early %", f"='Timeline Diagonal'!C{sum_row+3}"),
    ("Late %", f"='Timeline Diagonal'!C{sum_row+4}"),
    ("Product Lines", 2),
    ("Size Range", "S — XXXL"),
    ("Days Scheduled", 14),
]

for ki, (label, val) in enumerate(kpi_labels):
    c1 = 1 + ki * 2
    c2 = c1 + 1
    cell_label = ws4.cell(row=kpi_row, column=c1, value=label)
    cell_label.font = Font(name="Calibri", bold=True, size=9, color=WHITE)
    cell_label.fill = PatternFill("solid", fgColor=DARK_BLUE)
    cell_label.alignment = center
    cell_label.border = thin_border
    ws4.merge_cells(start_row=kpi_row, start_column=c1, end_row=kpi_row, end_column=c2)

    cell_val = ws4.cell(row=kpi_row+1, column=c1, value=val)
    cell_val.font = Font(name="Calibri", bold=True, size=14, color=DARK_BLUE)
    cell_val.alignment = center
    cell_val.border = thin_border
    ws4.merge_cells(start_row=kpi_row+1, start_column=c1, end_row=kpi_row+1, end_column=c2)
    if isinstance(val, str) and "%" in label:
        cell_val.number_format = "0.0%"

# ── Chart Data Areas (hidden reference data for charts) ──────────────
# We'll place small data tables that the charts reference

# Data Table 1: Output by Size (for bar chart)
dt1_row = 8
ws4.cell(row=dt1_row, column=1, value="Output by Size").font = Font(name="Calibri", bold=True, size=10, color=MED_BLUE)
ws4.cell(row=dt1_row+1, column=1, value="Size")
ws4.cell(row=dt1_row+1, column=2, value="Pieces")
for si, size in enumerate(sizes):
    ws4.cell(row=dt1_row+2+si, column=1, value=size).font = data_font
    ws4.cell(row=dt1_row+2+si, column=1).alignment = center
    ws4.cell(row=dt1_row+2+si, column=1).border = thin_border
    col_ltr = get_column_letter(4 + si)
    cell = ws4.cell(row=dt1_row+2+si, column=2,
                    value=f"='Output by Size'!{col_ltr}{out_total_row}")
    cell.number_format = "#,##0"
    cell.font = data_font
    cell.alignment = center
    cell.border = thin_border

# Data Table 2: Output by Line (for bar chart)
dt2_row = dt1_row + 10
ws4.cell(row=dt2_row, column=1, value="Output by Line").font = Font(name="Calibri", bold=True, size=10, color=MED_BLUE)
ws4.cell(row=dt2_row+1, column=1, value="Line")
ws4.cell(row=dt2_row+1, column=2, value="Pieces")
ws4.cell(row=dt2_row+2, column=1, value="Line A — T-Shirt").font = data_font
ws4.cell(row=dt2_row+2, column=1).border = thin_border
ws4.cell(row=dt2_row+2, column=2, value=f"='Output by Size'!K6").number_format = "#,##0"
ws4.cell(row=dt2_row+2, column=2).border = thin_border
ws4.cell(row=dt2_row+3, column=1, value="Line B — Polo Shirt").font = data_font
ws4.cell(row=dt2_row+3, column=1).border = thin_border
ws4.cell(row=dt2_row+3, column=2, value=f"='Output by Size'!K7").number_format = "#,##0"
ws4.cell(row=dt2_row+3, column=2).border = thin_border

# Data Table 3: Plan vs Actual daily (for line chart)
dt3_row = dt2_row + 6
ws4.cell(row=dt3_row, column=1, value="Plan vs Actual (Pieces/Day)").font = Font(name="Calibri", bold=True, size=10, color=MED_BLUE)
ws4.cell(row=dt3_row+1, column=1, value="Day")
ws4.cell(row=dt3_row+1, column=2, value="Planned")
ws4.cell(row=dt3_row+1, column=3, value="Actual")
# Daily planned = pieces due that day; daily actual = pieces shipped that day
# We'll compute from schedule
from collections import defaultdict
daily_planned = defaultdict(int)
daily_actual  = defaultdict(int)
for sched in schedule:
    cut_no, line, cut_day, plan_day, act_day = sched
    # Pieces for this cut
    src_idx = cut_no - 1
    sheets = sample_cuts[src_idx][3]
    marker = sample_cuts[src_idx][4]
    pcs = sheets * marker
    daily_planned[plan_day] += pcs
    daily_actual[act_day]  += pcs

for d in range(1, max_day + 1):
    r = dt3_row + 1 + d
    ws4.cell(row=r, column=1, value=f"Day {d}").font = data_font
    ws4.cell(row=r, column=1).alignment = center
    ws4.cell(row=r, column=1).border = thin_border
    ws4.cell(row=r, column=2, value=daily_planned.get(d, 0)).number_format = "#,##0"
    ws4.cell(row=r, column=2).border = thin_border
    ws4.cell(row=r, column=3, value=daily_actual.get(d, 0)).number_format = "#,##0"
    ws4.cell(row=r, column=3).border = thin_border

# Data Table 4: On-Time status (for pie chart)
dt4_row = dt3_row + max_day + 2
ws4.cell(row=dt4_row, column=1, value="On-Time Status").font = Font(name="Calibri", bold=True, size=10, color=MED_BLUE)
ws4.cell(row=dt4_row+1, column=1, value="Status")
ws4.cell(row=dt4_row+1, column=2, value="Count")
ws4.cell(row=dt4_row+2, column=1, value="On Time").border = thin_border
ws4.cell(row=dt4_row+2, column=2, value=on_time_count).border = thin_border
ws4.cell(row=dt4_row+3, column=1, value="Early").border = thin_border
ws4.cell(row=dt4_row+3, column=2, value=early_count).border = thin_border
ws4.cell(row=dt4_row+4, column=1, value="Late").border = thin_border
ws4.cell(row=dt4_row+4, column=2, value=late_count).border = thin_border

# ── CHARTS ────────────────────────────────────────────────────────────
chart_start_col = 7  # G column

# ── Chart 1: Output by Size (Bar) ────────────────────────────────────
chart1 = BarChart()
chart1.type = "col"
chart1.title = "Output Pieces by Size"
chart1.y_axis.title = "Pieces"
chart1.x_axis.title = "Size"
chart1.style = 10
chart1.width = 22
chart1.height = 14
cats1 = Reference(ws4, min_col=1, min_row=dt1_row+2, max_row=dt1_row+7)
vals1 = Reference(ws4, min_col=2, min_row=dt1_row+1, max_row=dt1_row+7)
chart1.add_data(vals1, titles_from_data=True)
chart1.set_categories(cats1)
chart1.series[0].graphicalProperties.solidFill = MED_BLUE
ws4.add_chart(chart1, f"G{dt1_row}")

# ── Chart 2: Output by Line (Bar) ────────────────────────────────────
chart2 = BarChart()
chart2.type = "col"
chart2.title = "Output Pieces by Product Line"
chart2.y_axis.title = "Pieces"
chart2.style = 10
chart2.width = 22
chart2.height = 14
cats2 = Reference(ws4, min_col=1, min_row=dt2_row+2, max_row=dt2_row+3)
vals2 = Reference(ws4, min_col=2, min_row=dt2_row+1, max_row=dt2_row+3)
chart2.add_data(vals2, titles_from_data=True)
chart2.set_categories(cats2)
chart2.series[0].graphicalProperties.solidFill = GREEN_DARK
ws4.add_chart(chart2, f"G{dt2_row}")

# ── Chart 3: Plan vs Actual (Line) ───────────────────────────────────
chart3 = LineChart()
chart3.title = "Plan vs Actual Production Per Day"
chart3.y_axis.title = "Pieces"
chart3.x_axis.title = "Day"
chart3.style = 10
chart3.width = 22
chart3.height = 14
cats3 = Reference(ws4, min_col=1, min_row=dt3_row+2, max_row=dt3_row+1+max_day)
vals3a = Reference(ws4, min_col=2, min_row=dt3_row+1, max_row=dt3_row+1+max_day)
vals3b = Reference(ws4, min_col=3, min_row=dt3_row+1, max_row=dt3_row+1+max_day)
chart3.add_data(vals3a, titles_from_data=True)
chart3.add_data(vals3b, titles_from_data=True)
chart3.set_categories(cats3)
chart3.series[0].graphicalProperties.line.solidFill = MED_BLUE
chart3.series[1].graphicalProperties.line.solidFill = GREEN_DARK
chart3.series[0].graphicalProperties.line.width = 28000
chart3.series[1].graphicalProperties.line.width = 28000
ws4.add_chart(chart3, f"G{dt3_row}")

# ── Chart 4: On-Time Status (Pie) ────────────────────────────────────
chart4 = PieChart()
chart4.title = "On-Time Delivery Status"
chart4.style = 10
chart4.width = 18
chart4.height = 14
cats4 = Reference(ws4, min_col=1, min_row=dt4_row+2, max_row=dt4_row+4)
vals4 = Reference(ws4, min_col=2, min_row=dt4_row+1, max_row=dt4_row+4)
chart4.add_data(vals4, titles_from_data=True)
chart4.set_categories(cats4)
chart4.dataLabels = DataLabelList()
chart4.dataLabels.showPercent = True
chart4.dataLabels.showVal = True
# Color pie slices
from openpyxl.chart.series import DataPoint
from openpyxl.drawing.fill import PatternFillProperties, ColorChoice
from openpyxl.chart.shapes import GraphicalProperties

# Set colors for pie slices
slice_colors = [GREEN, YELLOW, RED]
for i, color in enumerate(slice_colors):
    pt = DataPoint(idx=i)
    pt.graphicalProperties = GraphicalProperties()
    pt.graphicalProperties.solidFill = color
    chart4.series[0].data_points.append(pt)

ws4.add_chart(chart4, f"G{dt4_row}")

# ── Column widths for Dashboard ──────────────────────────────────────
for c in range(1, 20):
    ws4.column_dimensions[get_column_letter(c)].width = 16

# ════════════════════════════════════════════════════════════════════
#  FREEZE PANES
# ════════════════════════════════════════════════════════════════════
ws1.freeze_panes = "A5"
ws2.freeze_panes = "A5"
ws3.freeze_panes = "A6"

# ════════════════════════════════════════════════════════════════════
#  SAVE
# ════════════════════════════════════════════════════════════════════
output_path = r"C:\Users\Mega Store\OneDrive\Documents\Default Project\Clothes_Industry_Production.xlsx"
wb.save(output_path)
print(f"Workbook saved to: {output_path}")
print(f"Sheets: {wb.sheetnames}")
print(f"Cuts: {len(sample_cuts)} | Sizes: {len(sizes)} | On-Time: {on_time_count} | Early: {early_count} | Late: {late_count}")
