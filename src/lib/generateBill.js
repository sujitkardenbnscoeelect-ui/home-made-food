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

  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = pdf.internal.pageSize.getWidth()
  const margin = 40

  // header bar
  pdf.setFillColor(0, 0, 0)
  pdf.rect(0, 0, W, 70, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(22)
  pdf.setFont('helvetica', 'bold')
  pdf.text('HMF', margin, 30)
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  pdf.text('Home Made Food', margin, 46)
  pdf.text(`Invoice: ${invoiceNum}`, W - margin, 30, { align: 'right' })
  pdf.text(`${monthName} ${year}`, W - margin, 46, { align: 'right' })

  // customer info
  pdf.setTextColor(0, 0, 0)
  let y = 100
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Bill To', margin, y)
  y += 18
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'normal')
  pdf.text(customer.name ?? '', margin, y); y += 15
  if (customer.phone) { pdf.text(`Phone: ${customer.phone}`, margin, y); y += 15 }
  if (customer.email) { pdf.text(`Email: ${customer.email}`, margin, y); y += 15 }

  // rate info
  y += 6
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(100, 100, 100)
  pdf.text(`Lunch Rate: ₹${customer.lunchRate}  ·  Dinner Rate: ₹${customer.dinnerRate}`, margin, y)
  y += 20

  // divider
  pdf.setDrawColor(220, 220, 220)
  pdf.line(margin, y, W - margin, y)
  y += 14

  // table header
  pdf.setFillColor(240, 240, 240)
  pdf.rect(margin, y - 10, W - margin * 2, 20, 'F')
  pdf.setTextColor(0, 0, 0)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  const col = { date: margin + 4, meals: margin + 110, extra: margin + 210, amount: W - margin - 4 }
  pdf.text('Date', col.date, y + 4)
  pdf.text('Meals', col.meals, y + 4)
  pdf.text('Extra', col.extra, y + 4)
  pdf.text('Amount', col.amount, y + 4, { align: 'right' })
  y += 20

  // rows
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  let rowBg = false
  for (const row of attendanceRows) {
    if (y > 750) { pdf.addPage(); y = 40 }
    if (rowBg) {
      pdf.setFillColor(250, 250, 250)
      pdf.rect(margin, y - 8, W - margin * 2, 16, 'F')
    }
    rowBg = !rowBg
    const mealsStr = [row.lunch ? 'Lunch' : '', row.dinner ? 'Dinner' : ''].filter(Boolean).join(' + ') || '—'
    const extraStr = (row.extraAmount ?? 0) > 0 ? `₹${row.extraAmount}` : '—'
    const rowAmt = (row.lunch ? customer.lunchRate : 0)
      + (row.dinner ? customer.dinnerRate : 0)
      + (row.extraAmount ?? 0)
    pdf.setTextColor(80, 80, 80)
    pdf.text(row.date, col.date, y + 2)
    pdf.setTextColor(0, 0, 0)
    pdf.text(mealsStr, col.meals, y + 2)
    pdf.text(extraStr, col.extra, y + 2)
    pdf.text(`₹${rowAmt}`, col.amount, y + 2, { align: 'right' })
    y += 16
  }

  // totals
  y += 10
  pdf.setDrawColor(220, 220, 220)
  pdf.line(margin, y, W - margin, y)
  y += 16
  const totalsX = W - margin - 160

  function totalRow(label, value, bold = false) {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal')
    pdf.setFontSize(bold ? 11 : 10)
    pdf.setTextColor(bold ? 0 : 80, bold ? 0 : 80, bold ? 0 : 80)
    pdf.text(label, totalsX, y)
    pdf.text(`₹${value}`, W - margin, y, { align: 'right' })
    y += 18
  }

  totalRow(`Lunch (${lunchDays} days × ₹${customer.lunchRate})`, lunchDays * customer.lunchRate)
  totalRow(`Dinner (${dinnerDays} days × ₹${customer.dinnerRate})`, dinnerDays * customer.dinnerRate)
  if (extraAmount > 0) totalRow('Extra Charges', extraAmount)

  y += 4
  pdf.setFillColor(0, 0, 0)
  pdf.rect(totalsX - 8, y - 14, W - margin - totalsX + 8 + margin, 26, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.text('Grand Total', totalsX, y + 4)
  pdf.text(`₹${total}`, W - margin, y + 4, { align: 'right' })
  y += 36

  // footer
  pdf.setTextColor(150, 150, 150)
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.text('Thank you! — Home Made Food', W / 2, y, { align: 'center' })

  const fileName = `HMF-${customer.name?.replace(/\s+/g, '-')}-${monthShort}-${year}.pdf`
  pdf.save(fileName)
}
