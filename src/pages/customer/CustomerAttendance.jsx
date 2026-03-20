import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { MONTH_NAMES, getMonthBounds } from '../../lib/generateBill'

// ─── helpers ──────────────────────────────────────────────────────────────────

function pad(n) { return String(n).padStart(2, '0') }

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function makeKey(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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

// ─── Calendar grid ────────────────────────────────────────────────────────────

function CalendarGrid({ year, month, attendanceMap, today }) {
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay() // 0=Sun

  // build cells: nulls for leading blanks, then 1..daysInMonth
  const cells = []
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  // pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null)

  function getDayState(day) {
    if (!day) return 'empty'
    const key = makeKey(year, month, day)
    if (key === today) return 'today'
    if (key > today) return 'future'
    const record = attendanceMap[key]
    if (record && (record.lunch || record.dinner)) return 'present'
    return 'absent'
  }

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, idx) => {
          const state = getDayState(day)
          return (
            <div key={idx} className="flex items-center justify-center h-9">
              {day && state !== 'empty' ? (
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold
                  ${state === 'present' ? 'bg-black text-white' : ''}
                  ${state === 'absent' ? 'bg-gray-100 text-gray-400' : ''}
                  ${state === 'today' ? 'bg-white border-2 border-black text-black' : ''}
                  ${state === 'future' ? 'text-gray-300' : ''}
                `}>
                  {day}
                </div>
              ) : (
                <span />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Today's meal card ────────────────────────────────────────────────────────

function TodayCard({ record }) {
  const lunch = record?.lunch ?? false
  const dinner = record?.dinner ?? false
  const hasExtra = (record?.extraLunch ?? 0) > 0 || (record?.extraDinner ?? 0) > 0

  if (!lunch && !dinner) {
    return (
      <div className="bg-gray-100 rounded-2xl px-5 py-4 text-center">
        <p className="text-sm font-semibold text-gray-400">No meals marked today</p>
        <p className="text-xs text-gray-400 mt-0.5">Check back after the owner marks attendance</p>
      </div>
    )
  }

  return (
    <div className="bg-black rounded-2xl px-5 py-4">
      <p className="text-gray-400 text-xs mb-3 uppercase tracking-wide font-medium">Today's Meals</p>
      <div className="flex gap-3">
        <div className={`flex-1 rounded-xl px-4 py-3 text-center ${lunch ? 'bg-white' : 'bg-white/10'}`}>
          <p className={`text-xs font-semibold ${lunch ? 'text-black' : 'text-gray-500'}`}>Lunch</p>
          <p className={`text-lg font-bold mt-0.5 ${lunch ? 'text-black' : 'text-gray-600'}`}>
            {lunch ? '✓' : '—'}
          </p>
        </div>
        <div className={`flex-1 rounded-xl px-4 py-3 text-center ${dinner ? 'bg-white' : 'bg-white/10'}`}>
          <p className={`text-xs font-semibold ${dinner ? 'text-black' : 'text-gray-500'}`}>Dinner</p>
          <p className={`text-lg font-bold mt-0.5 ${dinner ? 'text-black' : 'text-gray-600'}`}>
            {dinner ? '✓' : '—'}
          </p>
        </div>
        {hasExtra && (
          <div className="flex-1 rounded-xl px-4 py-3 text-center bg-white/10">
            <p className="text-xs font-semibold text-gray-400">Extra</p>
            <p className="text-lg font-bold mt-0.5 text-white">
              +{(record.extraLunch ?? 0) + (record.extraDinner ?? 0)}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CustomerAttendance() {
  const navigate = useNavigate()
  const { userData } = useAuth()
  const customerId = userData?.customerId

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const [customerName, setCustomerName] = useState('')
  const [attendanceMap, setAttendanceMap] = useState({}) // { 'YYYY-MM-DD': record }
  const [loading, setLoading] = useState(true)

  const today = todayKey()

  const fetchData = useCallback(async () => {
    if (!customerId) return
    setLoading(true)
    try {
      // customer name (only needed once, but safe to re-fetch)
      if (!customerName) {
        const cSnap = await getDoc(doc(db, 'customers', customerId))
        if (cSnap.exists()) setCustomerName(cSnap.data().name ?? '')
      }

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
    } finally {
      setLoading(false)
    }
  }, [customerId, year, month, customerName])

  useEffect(() => { fetchData() }, [fetchData])

  // ── stats ──────────────────────────────────────────────────────────────────
  const daysInMonth = new Date(year, month, 0).getDate()
  const todayYear = now.getFullYear()
  const todayMonth = now.getMonth() + 1
  const todayDay = now.getDate()
  const pastDays = (year === todayYear && month === todayMonth)
    ? todayDay
    : (year < todayYear || (year === todayYear && month < todayMonth))
      ? daysInMonth : 0

  let presentCount = 0
  for (let d = 1; d <= pastDays; d++) {
    const key = makeKey(year, month, d)
    const r = attendanceMap[key]
    if (r && (r.lunch || r.dinner)) presentCount++
  }
  const absentCount = pastDays - presentCount

  // ── month nav ──────────────────────────────────────────────────────────────
  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const isCurrentMonth = year === todayYear && month === todayMonth
  const todayRecord = attendanceMap[today]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Header ── */}
      <header className="bg-black px-4 pt-12 pb-5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center flex-shrink-0">
            <span className="text-black text-xs font-bold tracking-widest">HMF</span>
          </div>
          <div>
            <h1 className="text-white text-lg font-bold leading-tight m-0">Attendance</h1>
            <p className="text-gray-400 text-xs mt-0.5">{customerName || '—'}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-3 py-3 pb-24 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <div className="w-7 h-7 border-[3px] border-black border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Loading attendance…</p>
          </div>
        ) : (
          <>
            {/* ── Calendar card ── */}
            <div className="bg-white rounded-2xl px-4 py-4 shadow-sm border border-gray-100">
              {/* Month header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-base font-bold text-gray-900">
                    {MONTH_NAMES[month - 1]} {year}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {presentCount} Present · {absentCount} Absent
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={prevMonth} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition">
                    <ChevronLeftIcon />
                  </button>
                  <button onClick={nextMonth} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition">
                    <ChevronRightIcon />
                  </button>
                </div>
              </div>

              <CalendarGrid
                year={year}
                month={month}
                attendanceMap={attendanceMap}
                today={today}
              />

              {/* Legend */}
              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100">
                <LegendItem color="bg-black" label="Present" />
                <LegendItem color="bg-gray-100 border border-gray-200" label="Absent" />
                <LegendItem color="bg-white border-2 border-black" label="Today" />
              </div>
            </div>

            {/* ── Today's meal card (only for current month) ── */}
            {isCurrentMonth && (
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide px-1 mb-2">
                  Today
                </p>
                <TodayCard record={todayRecord} />
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Bottom Nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-100 flex">
        <NavTab label="Attendance" icon={<HomeIcon />} active onClick={() => {}} />
        <NavTab label="My Bill" icon={<ReceiptIcon />} onClick={() => navigate('/customer/bill')} />
      </nav>
    </div>
  )
}

function LegendItem({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-5 h-5 rounded-full ${color}`} />
      <span className="text-[11px] text-gray-500 font-medium">{label}</span>
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
