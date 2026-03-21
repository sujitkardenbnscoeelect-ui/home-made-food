import { jsPDF } from 'jspdf'

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const MONTH_SHORT = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
]

export function getMonthBounds(year, month) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

export function calcBill(customer, attendanceDocs) {
  let lunchDays = 0, dinnerDays = 0, extraAmount = 0
  const attendanceRows = []

  for (const a of attendanceDocs) {
    const hasActivity = a.lunch || a.dinner || a.extraAmount
    if (!hasActivity) continue
    if (a.lunch) lunchDays++
    if (a.dinner) dinnerDays++
    extraAmount += a.extraAmount ?? 0
    attendanceRows.push(a)
  }

  attendanceRows.sort((a, b) => a.date.localeCompare(b.date))

  const total =
    lunchDays * (customer.lunchRate ?? 0) +
    dinnerDays * (customer.dinnerRate ?? 0) +
    extraAmount

  return { lunchDays, dinnerDays, extraAmount, total, attendanceRows }
}

export function generateBillPDF(customer, billData, year, month) {
  const { lunchDays, dinnerDays, extraAmount, total, attendanceRows } = billData
  const monthName = MONTH_NAMES[month - 1]
  const monthShort = MONTH_SHORT[month - 1]
  const invoiceNum = `HMF-${monthShort}-${year}-${String(customer.invoiceIndex ?? 1).padStart(3, '0')}`
  const totalDays = new Date(year, month, 0).getDate()

  // Build attendance lookup from rows (only active days are stored)
  const aMap = {}
  for (const row of attendanceRows) { aMap[row.date] = row }

  // All calendar days for this month
  const allDays = []
  for (let d = 1; d <= totalDays; d++) {
    allDays.push(
      `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    )
  }

  // ── Page constants (mm, A4 = 210 x 297) ────────────────────────────────────
  const PW  = 210   // page width
  const PH  = 297   // page height
  const ML  = 14    // left margin
  const MR  = 14    // right margin  (right edge = PW - MR = 196)
  const MB  = 16    // bottom margin
  const RX  = PW - MR          // right edge for right-aligned text
  const TW  = PW - ML - MR     // table width = 182mm

  // Fixed column X positions (left edge of each column's text area)
  // Date: 38mm | Meals: 60mm | Extra: 30mm | Amount: right-aligned
  const CX = {
    date:   ML + 2,          // 16mm
    meals:  ML + 40,         // 54mm
    extra:  ML + 100,        // 114mm
    amount: RX - 2,          // 194mm (right-aligned)
  }

  const ROW_H = 7    // row height mm
  const HDR_H = 9    // table header height mm
  // Reserve enough mm at bottom for totals before forcing a new page
  const TOTALS_RESERVE = 46

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })

  // ── Shorthand helpers ────────────────────────────────────────────────────────
  const fill  = (r, g, b) => pdf.setFillColor(r, g, b)
  const color = (r, g, b) => pdf.setTextColor(r, g, b)
  const draw  = (r, g, b) => pdf.setDrawColor(r, g, b)
  const font  = (style, size) => { pdf.setFont('helvetica', style); pdf.setFontSize(size) }

  // ── Draw table header row (reused on continuation pages) ────────────────────
  function drawTableHeader(yPos) {
    fill(25, 25, 25)
    pdf.rect(ML, yPos, TW, HDR_H, 'F')
    color(255, 255, 255)
    font('bold', 8)
    const ty = yPos + 6
    pdf.text('Date',   CX.date,   ty)
    pdf.text('Meals',  CX.meals,  ty)
    pdf.text('Extra',  CX.extra,  ty)
    pdf.text('Amount', CX.amount, ty, { align: 'right' })
    return yPos + HDR_H
  }

  let y = 0

  // ── Header bar ──────────────────────────────────────────────────────────────
  fill(0, 0, 0)
  pdf.rect(0, 0, PW, 18, 'F')
  color(255, 255, 255)
  font('bold', 13)
  pdf.text('HMF', ML, 8)
  font('normal', 7.5)
  pdf.text('Home Made Food', ML, 14)
  font('bold', 7.5)
  pdf.text(`Invoice: ${invoiceNum}`, RX, 8, { align: 'right' })
  font('normal', 7.5)
  pdf.text(`${monthName} ${year}`, RX, 14, { align: 'right' })

  // ── Customer info (two-column layout) ────────────────────────────────────────
  y = 23
  color(0, 0, 0)
  font('bold', 9.5)
  pdf.text('Bill To', ML, y)
  y += 5
  font('normal', 8.5)
  pdf.text(customer.name ?? '-', ML, y); y += 5
  if (customer.phone) { pdf.text(`Phone: ${customer.phone}`, ML, y); y += 5 }
  if (customer.email) { pdf.text(`Email: ${customer.email}`, ML, y); y += 5 }

  // Rates block (right side, aligned with customer block)
  color(60, 60, 60)
  font('bold', 8)
  pdf.text('Rates', RX, 28, { align: 'right' })
  font('normal', 8)
  pdf.text(`Lunch:  Rs.${customer.lunchRate ?? 0} / day`,   RX, 34, { align: 'right' })
  pdf.text(`Dinner: Rs.${customer.dinnerRate ?? 0} / day`,  RX, 40, { align: 'right' })

  // ── Divider ─────────────────────────────────────────────────────────────────
  y = Math.max(y, 44) + 3
  draw(210, 210, 210)
  pdf.line(ML, y, RX, y)
  y += 4

  // ── Table header ─────────────────────────────────────────────────────────────
  y = drawTableHeader(y)

  // ── Table rows (all days of month) ──────────────────────────────────────────
  let rowIdx = 0
  for (const dateStr of allDays) {
    // Page break: leave room for totals
    if (y + ROW_H > PH - MB - TOTALS_RESERVE) {
      pdf.addPage()
      y = 12
      y = drawTableHeader(y)
      rowIdx = 0  // reset alternating bg on new page
    }

    const rec = aMap[dateStr]
    const isAbsent = !rec || (!rec.lunch && !rec.dinner && !rec.extraAmount)

    // Alternating row background
    if (rowIdx % 2 === 1) {
      fill(249, 249, 249)
      pdf.rect(ML, y, TW, ROW_H, 'F')
    }
    rowIdx++

    // Format date: "21 Mar (Sat)"
    const [, mm, dd] = dateStr.split('-').map(Number)
    const dow = new Date(year, mm - 1, dd).toLocaleDateString('en-GB', { weekday: 'short' })
    const dateLabel = `${String(dd).padStart(2, ' ')} ${MONTH_SHORT[mm - 1].charAt(0)}${MONTH_SHORT[mm - 1].slice(1).toLowerCase()} (${dow})`

    const rowAmt = isAbsent ? 0
      : (rec.lunch  ? (customer.lunchRate  ?? 0) : 0)
      + (rec.dinner ? (customer.dinnerRate ?? 0) : 0)
      + (rec.extraAmount ?? 0)

    const mealsStr = isAbsent
      ? 'Absent'
      : [rec.lunch ? 'Lunch' : '', rec.dinner ? 'Dinner' : ''].filter(Boolean).join(' + ') || 'Extra only'

    const extraStr = !isAbsent && (rec?.extraAmount ?? 0) > 0
      ? `Rs.${rec.extraAmount}`
      : '-'

    const ty = y + ROW_H - 2  // text baseline inside row

    font('normal', 8.5)

    // Date
    color(isAbsent ? 170 : 70, isAbsent ? 170 : 70, isAbsent ? 170 : 70)
    pdf.text(dateLabel, CX.date, ty)

    // Meals
    color(isAbsent ? 190 : 0, isAbsent ? 190 : 0, isAbsent ? 190 : 0)
    pdf.text(mealsStr, CX.meals, ty)

    // Extra
    color(100, 100, 100)
    pdf.text(extraStr, CX.extra, ty)

    // Amount
    if (isAbsent) {
      color(190, 190, 190)
      pdf.text('-', CX.amount, ty, { align: 'right' })
    } else {
      color(0, 0, 0)
      font('bold', 8.5)
      pdf.text(`Rs.${rowAmt}`, CX.amount, ty, { align: 'right' })
    }

    // Row separator
    draw(235, 235, 235)
    pdf.line(ML, y + ROW_H, RX, y + ROW_H)

    y += ROW_H
  }

  // ── Totals section ────────────────────────────────────────────────────────────
  if (y + TOTALS_RESERVE > PH - MB) {
    pdf.addPage()
    y = 14
  }

  y += 5
  draw(180, 180, 180)
  pdf.line(ML, y, RX, y)
  y += 6

  // Totals label column starts at 110mm from left
  const TX = ML + 96

  function totalRow(label, value) {
    color(80, 80, 80)
    font('normal', 8.5)
    pdf.text(label, TX, y)
    pdf.text(`Rs.${value}`, RX, y, { align: 'right' })
    y += 6
  }

  totalRow(
    `Lunch   ${lunchDays}d x Rs.${customer.lunchRate ?? 0}`,
    lunchDays * (customer.lunchRate ?? 0)
  )
  totalRow(
    `Dinner  ${dinnerDays}d x Rs.${customer.dinnerRate ?? 0}`,
    dinnerDays * (customer.dinnerRate ?? 0)
  )
  if (extraAmount > 0) totalRow('Extra Charges', extraAmount)

  y += 3

  // Grand total bar
  const barLeft = TX - 4
  const barWidth = RX - barLeft + MR
  fill(0, 0, 0)
  pdf.rect(barLeft, y - 3, barWidth, 11, 'F')
  color(255, 255, 255)
  font('bold', 11)
  pdf.text('Grand Total', TX, y + 5.5)
  pdf.text(`Rs.${total}`, RX, y + 5.5, { align: 'right' })

  // ── Footer (pinned to page bottom) ───────────────────────────────────────────
  color(160, 160, 160)
  font('normal', 7.5)
  pdf.text('Thank you! - Home Made Food', PW / 2, PH - 6, { align: 'center' })

  const safeName = (customer.name ?? 'bill').replace(/\s+/g, '-')
  pdf.save(`HMF-${safeName}-${monthShort}-${year}.pdf`)
}
