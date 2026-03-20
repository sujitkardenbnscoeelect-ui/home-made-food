import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import {
  MONTH_NAMES,
  MONTH_SHORT,
  getMonthBounds,
  calcBill,
  generateBillPDF,
} from '../../lib/generateBill'

// ─── helpers ──────────────────────────────────────────────────────────────────

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDay(dateStr) {
  const [, , dd] = dateStr.split('-')
  return parseInt(dd, 10)
}

function formatDayLabel(dateStr) {
  const [yyyy, mm, dd] = dateStr.split('-').map(Number)
  return new Date(yyyy, mm - 1, dd).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short',
  })
}

function formatDayOfWeek(dateStr) {
  const [yyyy, mm, dd] = dateStr.split('-').map(Number)
  return new Date(yyyy, mm - 1, dd).toLocaleDateString('en-GB', { weekday: 'short' })
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
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

function ReceiptIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.135.561 4.14 1.535 5.876L.057 23.852a.5.5 0 0 0 .614.614l5.976-1.478A11.954 11.954 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.693-.516-5.228-1.414l-.374-.22-3.882.96.977-3.768-.242-.388A9.956 9.956 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
    </svg>
  )
}

// ─── Day row ─────────────────────────────────────────────────────────────────

function DayRow({ dateStr, record, customer }) {
  const isAbsent = !record || (!record.lunch && !record.dinner && !record.extraLunch && !record.extraDinner)
  const dayNum = formatDay(dateStr)
  const dayLabel = formatDayLabel(dateStr)
  const dayOfWeek = formatDayOfWeek(dateStr)

  const rowAmt = isAbsent ? 0
    : (record.lunch ? customer.lunchRate : 0)
    + (record.dinner ? customer.dinnerRate : 0)
    + (record.extraLunch ?? 0) * customer.lunchRate
    + (record.extraDinner ?? 0) * customer.dinnerRate

  const extra = !isAbsent && ((record.extraLunch ?? 0) + (record.extraDinner ?? 0)) > 0

  return (
    <div className={`flex items-center gap-3 py-2.5 px-4 border-b border-gray-50 last:border-0 ${isAbsent ? 'opacity-50' : ''}`}>
      {/* date */}
      <div className="w-10 text-center flex-shrink-0">
        <p className="text-xs text-gray-400 leading-none">{dayOfWeek}</p>
        <p className={`text-sm font-bold mt-0.5 ${isAbsent ? 'text-gray-300' : 'text-gray-900'}`}>{dayNum}</p>
      </div>

      {/* meal pills */}
      <div className="flex-1 flex items-center gap-1.5">
        {isAbsent ? (
          <span className="text-xs text-gray-300">No meals</span>
        ) : (
          <>
            {record.lunch && (
              <span className="text-[11px] font-medium bg-gray-900 text-white rounded-full px-2 py-0.5">Lunch</span>
            )}
            {record.dinner && (
              <span className="text-[11px] font-medium bg-gray-900 text-white rounded-full px-2 py-0.5">Dinner</span>
            )}
            {extra && (
              <span className="text-[11px] font-medium bg-gray-200 text-gray-600 rounded-full px-2 py-0.5">
                +{(record.extraLunch ?? 0) + (record.extraDinner ?? 0)} extra
              </span>
            )}
          </>
        )}
      </div>

      {/* amount */}
      <p className={`text-sm font-semibold flex-shrink-0 ${isAbsent ? 'text-gray-300' : 'text-gray-900'}`}>
        {isAbsent ? '—' : `₹${rowAmt}`}
      </p>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CustomerBill() {
  const navigate = useNavigate()
  const { userData } = useAuth()
  const customerId = userData?.customerId

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const monthName = MONTH_NAMES[month - 1]
  const monthShort = MONTH_SHORT[month - 1]
  const lastDay = daysInMonth(year, month)
  const today = todayKey()

  const [customer, setCustomer] = useState(null)
  const [billData, setBillData] = useState(null)
  const [paid, setPaid] = useState(false)
  const [allDates, setAllDates] = useState([]) // full list of date strings for this month up to today
  const [attendanceMap, setAttendanceMap] = useState({})
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!customerId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      // customer profile
      const cSnap = await getDoc(doc(db, 'customers', customerId))
      const cData = { id: cSnap.id, invoiceIndex: 1, ...cSnap.data() }
      setCustomer(cData)

      // attendance for this month
      const { start, end } = getMonthBounds(year, month)
      const aSnap = await getDocs(
        query(collection(db, 'attendance'),
          where('customerId', '==', customerId),
          where('date', '>=', start),
          where('date', '<=', end)
        )
      )
      const aMap = {}
      aSnap.docs.forEach(d => { aMap[d.data().date] = d.data() })
      setAttendanceMap(aMap)
      setBillData(calcBill(cData, aSnap.docs.map(d => d.data())))

      // paid status
      const billSnap = await getDoc(doc(db, 'bills', `${customerId}_${year}-${String(month).padStart(2, '0')}`))
      setPaid(billSnap.exists() && billSnap.data().paid)

      // generate full date list up to today (or end of month if month is past)
      const todayDate = new Date()
      const todayYear = todayDate.getFullYear()
      const todayMonth = todayDate.getMonth() + 1
      const todayDay = todayDate.getDate()
      const capDay = (year === todayYear && month === todayMonth) ? todayDay : lastDay
      const dates = []
      for (let d = 1; d <= capDay; d++) {
        dates.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
      }
      setAllDates(dates.reverse()) // most recent first
    } finally {
      setLoading(false)
    }
  }, [customerId, year, month, lastDay])

  useEffect(() => { fetchData() }, [fetchData])

  function handlePDF() {
    if (!customer || !billData) return
    generateBillPDF(customer, billData, year, month)
  }

  function handleWhatsApp() {
    handlePDF()
    const text = encodeURIComponent(
      `Dear ${customer.name},\nYour Home Made Food bill for ${monthName} ${year} is ₹${billData.total}.\nPlease find your bill attached. Thank you! 🙏`
    )
    const phone = (customer?.phone ?? '').replace(/\D/g, '')
    window.open(`https://wa.me/91${phone}?text=${text}`, '_blank')
  }

  const dueDateStr = `Due: ${lastDay} ${monthShort}`

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Header ── */}
      <header className="bg-black px-4 pt-12 pb-5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center flex-shrink-0">
            <span className="text-black text-xs font-bold tracking-widest">HMF</span>
          </div>
          <div>
            <h1 className="text-white text-lg font-bold leading-tight m-0">My Bill</h1>
            <p className="text-gray-400 text-xs mt-0.5">{customer?.name ?? '—'}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <div className="w-7 h-7 border-[3px] border-black border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Loading your bill…</p>
          </div>
        ) : !customerId ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-center px-6">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-1 text-2xl">⚠️</div>
            <p className="text-sm font-semibold text-gray-700">Account not linked</p>
            <p className="text-xs text-gray-400">Your account has no customer profile attached. Please contact the owner.</p>
          </div>
        ) : (
          <>
            {/* ── Hero card ── */}
            <div className="px-3 pt-3">
              <div className="bg-black rounded-2xl px-5 py-6 text-white">
                <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">
                  {monthName} {year} · Running Total
                </p>

                {/* Big amount */}
                <p
                  className="text-5xl font-semibold mt-2 leading-none"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  ₹{billData?.total.toLocaleString('en-IN') ?? '0'}
                </p>

                {/* Meal summary */}
                <p className="text-gray-400 text-sm mt-3">
                  {[
                    billData?.lunchDays ? `${billData.lunchDays} Lunch` : '',
                    billData?.dinnerDays ? `${billData.dinnerDays} Dinner` : '',
                    (billData?.extraLunch ?? 0) + (billData?.extraDinner ?? 0) > 0
                      ? `${(billData?.extraLunch ?? 0) + (billData?.extraDinner ?? 0)} Extra` : '',
                  ].filter(Boolean).join(' · ') || 'No meals recorded yet'}
                </p>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${paid ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {paid ? 'PAID' : 'UNPAID'}
                  </span>
                  <p className="text-gray-400 text-xs">{dueDateStr}</p>
                </div>
              </div>
            </div>

            {/* ── Action buttons ── */}
            <div className="px-3 mt-3 flex gap-2">
              <button
                onClick={handlePDF}
                className="flex-1 flex items-center justify-center gap-2 bg-black text-white rounded-xl py-3 text-sm font-semibold hover:bg-gray-900 active:bg-gray-800 transition"
              >
                <DownloadIcon />
                Download PDF
              </button>
              <button
                onClick={handleWhatsApp}
                className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white rounded-xl py-3 text-sm font-semibold hover:bg-green-600 active:bg-green-700 transition"
              >
                <WhatsAppIcon />
                Share
              </button>
            </div>

            {/* ── Day-wise breakdown ── */}
            <div className="px-3 mt-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide px-1 mb-2">
                Day-wise Breakdown
              </p>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {allDates.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No days recorded yet this month</p>
                ) : (
                  allDates.map(dateStr => (
                    <DayRow
                      key={dateStr}
                      dateStr={dateStr}
                      record={attendanceMap[dateStr]}
                      customer={customer}
                    />
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* ── Bottom Nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-100 flex">
        <NavTab label="Attendance" icon={<HomeIcon />} onClick={() => navigate('/customer/attendance')} />
        <NavTab label="My Bill" icon={<ReceiptIcon />} active onClick={() => {}} />
      </nav>
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
