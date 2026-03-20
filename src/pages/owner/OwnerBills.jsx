import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  getDoc,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import {
  MONTH_NAMES,
  MONTH_SHORT,
  getMonthBounds,
  calcBill,
  generateBillPDF,
} from '../../lib/generateBill'

function todayDayOfMonth() {
  return new Date().getDate()
}

// ─── icons ────────────────────────────────────────────────────────────────────

function HomeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}
function UsersIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
function ReceiptIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}
function CalendarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}
function WhatsAppIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.135.561 4.14 1.535 5.876L.057 23.852a.5.5 0 0 0 .614.614l5.976-1.478A11.954 11.954 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.693-.516-5.228-1.414l-.374-.22-3.882.96.977-3.768-.242-.388A9.956 9.956 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
    </svg>
  )
}
function PdfIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}
function ChevronLeftIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}
function ChevronRightIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

// ─── Month Picker Modal ───────────────────────────────────────────────────────

function MonthPicker({ year, month, onChange, onClose }) {
  const [y, setY] = useState(year)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-t-2xl px-5 pt-4 pb-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setY(v => v - 1)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-xl"><ChevronLeftIcon /></button>
          <span className="text-base font-bold text-gray-900">{y}</span>
          <button onClick={() => setY(v => v + 1)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-xl"><ChevronRightIcon /></button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MONTH_NAMES.map((name, i) => {
            const active = y === year && (i + 1) === month
            return (
              <button
                key={name}
                onClick={() => { onChange(y, i + 1); onClose() }}
                className={`py-2.5 rounded-xl text-sm font-semibold transition ${
                  active ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {name.slice(0, 3)}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Bill Card ────────────────────────────────────────────────────────────────

function BillCard({ customer, billData, paid, onPDF, onWhatsApp, onMarkPaid }) {
  const { lunchDays, dinnerDays, extraLunch, extraDinner, total } = billData
  const longPressTimer = useRef(null)

  const totalExtra = extraLunch + extraDinner
  const summaryParts = []
  if (lunchDays) summaryParts.push(`${lunchDays}L`)
  if (dinnerDays) summaryParts.push(`${dinnerDays}D`)
  if (totalExtra) summaryParts.push(`${totalExtra} extra`)

  function startLongPress() {
    longPressTimer.current = setTimeout(() => {
      if (!paid) onMarkPaid()
    }, 600)
  }
  function cancelLongPress() {
    clearTimeout(longPressTimer.current)
  }

  return (
    <div
      className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 select-none"
      onMouseDown={startLongPress}
      onMouseUp={cancelLongPress}
      onMouseLeave={cancelLongPress}
      onTouchStart={startLongPress}
      onTouchEnd={cancelLongPress}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-black flex-shrink-0 flex items-center justify-center">
          <span className="text-white text-sm font-bold uppercase">
            {customer.name?.charAt(0) ?? '?'}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900 truncate">{customer.name}</p>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 ${
              paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
            }`}>
              {paid ? 'PAID' : 'UNPAID'}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {summaryParts.length ? summaryParts.join(' · ') : 'No meals this month'}
          </p>
        </div>

        {/* Amount */}
        <div className="flex-shrink-0 text-right">
          <p className="text-base font-bold text-gray-900">₹{total}</p>
        </div>
      </div>

      {/* Action buttons */}
      {total > 0 && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
          {!paid ? (
            <>
              <button
                onClick={onWhatsApp}
                className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white rounded-xl py-2 text-xs font-semibold transition"
              >
                <WhatsAppIcon />
                WhatsApp
              </button>
              <button
                onClick={onMarkPaid}
                className="flex items-center justify-center gap-1.5 bg-gray-900 hover:bg-black text-white rounded-xl px-4 py-2 text-xs font-semibold transition"
              >
                Mark Paid
              </button>
              <button
                onClick={onPDF}
                className="flex items-center justify-center gap-1.5 border border-gray-200 text-gray-500 rounded-xl px-3 py-2 text-xs font-semibold hover:bg-gray-50 transition"
              >
                <PdfIcon />
              </button>
            </>
          ) : (
            <button
              onClick={onPDF}
              className="flex items-center justify-center gap-1.5 border border-gray-200 text-gray-500 rounded-xl px-4 py-2 text-xs font-semibold hover:bg-gray-50 transition"
            >
              <PdfIcon />
              Download PDF
            </button>
          )}
        </div>
      )}

      {!paid && total > 0 && (
        <p className="text-[10px] text-gray-300 text-center mt-2">Hold to mark as paid</p>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OwnerBills() {
  const navigate = useNavigate()
  const now = new Date()

  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [showPicker, setShowPicker] = useState(false)

  const [billRows, setBillRows] = useState([])   // [{ customer, billData, paid }]
  const [loading, setLoading] = useState(true)

  // ── fetch + calculate ──────────────────────────────────────────────────────
  const fetchBills = useCallback(async () => {
    setLoading(true)
    try {
      // customers
      const cSnap = await getDocs(
        query(collection(db, 'customers'), where('active', '==', true))
      )
      const customers = cSnap.docs.map((d, i) => ({ id: d.id, invoiceIndex: i + 1, ...d.data() }))

      // attendance for this month
      const { start, end } = getMonthBounds(year, month)
      const aSnap = await getDocs(
        query(
          collection(db, 'attendance'),
          where('date', '>=', start),
          where('date', '<=', end)
        )
      )
      // group by customerId
      const aMap = {}
      aSnap.docs.forEach(d => {
        const data = d.data()
        if (!aMap[data.customerId]) aMap[data.customerId] = []
        aMap[data.customerId].push(data)
      })

      // paid status from bills collection
      const billDocIds = customers.map(c => `${c.id}_${year}-${String(month).padStart(2, '0')}`)
      const paidSet = new Set()
      await Promise.all(
        billDocIds.map(async (docId, i) => {
          const snap = await getDoc(doc(db, 'bills', docId))
          if (snap.exists() && snap.data().paid) paidSet.add(customers[i].id)
        })
      )

      const rows = customers.map(customer => ({
        customer,
        billData: calcBill(customer, aMap[customer.id] ?? []),
        paid: paidSet.has(customer.id),
      }))

      // sort: unpaid first, then by total desc
      rows.sort((a, b) => {
        if (a.paid !== b.paid) return a.paid ? 1 : -1
        return b.billData.total - a.billData.total
      })

      setBillRows(rows)
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { fetchBills() }, [fetchBills])

  // ── totals ─────────────────────────────────────────────────────────────────
  const grandTotal = billRows.reduce((s, r) => s + r.billData.total, 0)
  const unpaidCount = billRows.filter(r => !r.paid && r.billData.total > 0).length
  const daysInMonth = new Date(year, month, 0).getDate()
  const daysDone = Math.min(todayDayOfMonth(), daysInMonth)

  // ── mark paid ──────────────────────────────────────────────────────────────
  async function handleMarkPaid(customer) {
    const docId = `${customer.id}_${year}-${String(month).padStart(2, '0')}`
    await setDoc(doc(db, 'bills', docId), {
      customerId: customer.id,
      year,
      month,
      paid: true,
      paidAt: new Date().toISOString(),
    })
    setBillRows(prev => prev.map(r =>
      r.customer.id === customer.id ? { ...r, paid: true } : r
    ))
  }

  // ── PDF ────────────────────────────────────────────────────────────────────
  function handlePDF(customer, billData) {
    generateBillPDF(customer, billData, year, month)
  }

  // ── WhatsApp ───────────────────────────────────────────────────────────────
  function handleWhatsApp(customer, billData) {
    generateBillPDF(customer, billData, year, month)
    const monthName = MONTH_NAMES[month - 1]
    const text = encodeURIComponent(
      `Dear ${customer.name},\nYour Home Made Food bill for ${monthName} ${year} is ₹${billData.total}.\nPlease find your bill attached. Thank you! 🙏`
    )
    const phone = (customer.phone ?? '').replace(/\D/g, '')
    window.open(`https://wa.me/91${phone}?text=${text}`, '_blank')
  }

  // ── nav helpers ─────────────────────────────────────────────────────────────
  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Header ── */}
      <header className="bg-black px-4 pt-12 pb-5 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center flex-shrink-0">
              <span className="text-black text-xs font-bold tracking-widest">HMF</span>
            </div>
            <div>
              <h1 className="text-white text-lg font-bold leading-tight m-0">Monthly Bills</h1>
              <p className="text-gray-400 text-xs mt-0.5">{monthLabel}</p>
            </div>
          </div>
          <button
            onClick={() => setShowPicker(true)}
            className="text-white p-2 -mr-1 rounded-xl active:bg-white/10 transition"
          >
            <CalendarIcon />
          </button>
        </div>
      </header>

      {/* ── Month summary card ── */}
      <div className="px-3 pt-3 flex-shrink-0">
        <div className="bg-black rounded-2xl px-5 py-4 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">{monthLabel}</p>
              <p className="text-3xl font-bold mt-1">₹{grandTotal.toLocaleString('en-IN')}</p>
              <p className="text-gray-400 text-xs mt-1">Total billing amount</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{billRows.length}</p>
              <p className="text-gray-400 text-xs">customers</p>
              <p className="text-gray-300 text-xs mt-2 font-semibold">{daysDone}/{daysInMonth} days</p>
            </div>
          </div>
          {unpaidCount > 0 && (
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
              <p className="text-xs text-gray-400">{unpaidCount} pending payment{unpaidCount > 1 ? 's' : ''}</p>
              <span className="text-xs font-bold text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">
                {unpaidCount} UNPAID
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Month nav ── */}
      <div className="px-3 pt-2 pb-1 flex items-center justify-between flex-shrink-0">
        <button onClick={prevMonth} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded-lg hover:bg-gray-200 transition">
          <ChevronLeftIcon /> Prev
        </button>
        <span className="text-xs font-semibold text-gray-500">{monthLabel}</span>
        <button onClick={nextMonth} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded-lg hover:bg-gray-200 transition">
          Next <ChevronRightIcon />
        </button>
      </div>

      {/* ── Bill list ── */}
      <main className="flex-1 overflow-y-auto px-3 pb-24 space-y-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <div className="w-7 h-7 border-[3px] border-black border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Calculating bills…</p>
          </div>
        ) : billRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-center px-6">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-1">
              <ReceiptIcon />
            </div>
            <p className="text-sm font-semibold text-gray-700">No customers yet</p>
            <p className="text-xs text-gray-400">Add customers to start tracking bills</p>
          </div>
        ) : (
          billRows.map(({ customer, billData, paid }) => (
            <BillCard
              key={customer.id}
              customer={customer}
              billData={billData}
              paid={paid}
              onPDF={() => handlePDF(customer, billData)}
              onWhatsApp={() => handleWhatsApp(customer, billData)}
              onMarkPaid={() => handleMarkPaid(customer)}
            />
          ))
        )}
      </main>

      {/* ── Bottom Nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-100 flex">
        <NavTab label="Attendance" icon={<HomeIcon />} onClick={() => navigate('/owner/dashboard')} />
        <NavTab label="Customers" icon={<UsersIcon />} onClick={() => navigate('/owner/customers')} />
        <NavTab label="Bills" icon={<ReceiptIcon />} active onClick={() => {}} />
      </nav>

      {/* ── Month picker ── */}
      {showPicker && (
        <MonthPicker
          year={year}
          month={month}
          onChange={(y, m) => { setYear(y); setMonth(m) }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}

function NavTab({ label, icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
        active ? 'text-black' : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      {icon}
      <span className={`text-[10px] font-semibold ${active ? 'text-black' : 'text-gray-400'}`}>
        {label}
      </span>
    </button>
  )
}
