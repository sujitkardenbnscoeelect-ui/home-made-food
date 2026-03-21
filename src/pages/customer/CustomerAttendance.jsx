import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { db, auth } from '../../lib/firebase'
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

function formatFullDate(dateStr) {
  const [yyyy, mm, dd] = dateStr.split('-').map(Number)
  return new Date(yyyy, mm - 1, dd).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
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

function LogoutIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
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

function CalendarGrid({ year, month, attendanceMap, today, selectedDate, onSelectDate }) {
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()

  const cells = []
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  function getDayState(day) {
    if (!day) return 'empty'
    const key = makeKey(year, month, day)
    if (key > today) return 'future'
    const record = attendanceMap[key]
    const isPresent = record?.lunch || record?.dinner
    if (key === today) return isPresent ? 'present-today' : 'today'
    return isPresent ? 'present' : 'absent'
  }

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} className="h-9" />

          const key = makeKey(year, month, day)
          const state = getDayState(day)
          const isSelected = key === selectedDate
          const isTappable = state !== 'future' && state !== 'empty'

          // Circle styles per state
          let circleClass = 'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all'
          if (isSelected) {
            circleClass += ' bg-white text-black border-2 border-black border-dashed'
          } else if (state === 'present' || state === 'present-today') {
            circleClass += ' bg-[#1a1a1a] text-white'
          } else if (state === 'today') {
            circleClass += ' bg-white border-2 border-black text-black'
          } else if (state === 'absent') {
            circleClass += ' bg-[#FF3B30] text-white'
          } else {
            // future
            circleClass = 'w-8 h-8 flex items-center justify-center text-xs font-semibold text-gray-300'
          }

          return (
            <div key={idx} className="flex items-center justify-center h-9">
              <button
                disabled={!isTappable}
                onClick={() => isTappable && onSelectDate(key)}
                className={`focus:outline-none active:scale-90 transition-transform ${isTappable ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className={circleClass}>{day}</div>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Today's menu card ────────────────────────────────────────────────────────

function TodayMenuCard({ menu }) {
  if (!menu) {
    return (
      <div className="bg-white rounded-2xl px-4 py-4 shadow-sm border border-gray-100 text-center">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Today's Menu</p>
        <p className="text-sm text-gray-400">Menu not updated yet</p>
      </div>
    )
  }

  const hasLunch  = menu.lunchVeg || menu.lunchNonVeg
  const hasDinner = menu.dinnerVeg || menu.dinnerNonVeg

  return (
    <div className="bg-white rounded-2xl px-4 py-4 shadow-sm border border-gray-100">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Today's Menu</p>

      {hasLunch && (
        <div className="mb-3">
          <p className="text-[11px] font-bold text-black uppercase tracking-wide mb-1.5">Lunch</p>
          <div className="space-y-1">
            {menu.lunchVeg && (
              <div className="flex gap-2 items-start">
                <span className="mt-0.5 w-4 h-4 rounded-full bg-green-100 flex-shrink-0 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-green-700">V</span>
                </span>
                <p className="text-sm text-gray-700">{menu.lunchVeg}</p>
              </div>
            )}
            {menu.lunchNonVeg && (
              <div className="flex gap-2 items-start">
                <span className="mt-0.5 w-4 h-4 rounded-full bg-red-100 flex-shrink-0 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-red-700">N</span>
                </span>
                <p className="text-sm text-gray-700">{menu.lunchNonVeg}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {hasDinner && (
        <div className={hasLunch ? 'pt-3 border-t border-gray-100' : ''}>
          <p className="text-[11px] font-bold text-black uppercase tracking-wide mb-1.5">Dinner</p>
          <div className="space-y-1">
            {menu.dinnerVeg && (
              <div className="flex gap-2 items-start">
                <span className="mt-0.5 w-4 h-4 rounded-full bg-green-100 flex-shrink-0 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-green-700">V</span>
                </span>
                <p className="text-sm text-gray-700">{menu.dinnerVeg}</p>
              </div>
            )}
            {menu.dinnerNonVeg && (
              <div className="flex gap-2 items-start">
                <span className="mt-0.5 w-4 h-4 rounded-full bg-red-100 flex-shrink-0 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-red-700">N</span>
                </span>
                <p className="text-sm text-gray-700">{menu.dinnerNonVeg}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Selected day detail card ─────────────────────────────────────────────────

function SelectedDayCard({ dateStr, record, customer }) {
  if (!dateStr) return null

  const fullDate = formatFullDate(dateStr)
  const isFuture = dateStr > todayKey()

  if (isFuture) {
    return (
      <div className="bg-gray-100 rounded-2xl px-5 py-5 text-center">
        <p className="text-xs text-gray-400 font-medium mb-1">{fullDate}</p>
        <p className="text-sm font-semibold text-gray-400">Not yet marked</p>
      </div>
    )
  }

  const lunch = record?.lunch ?? false
  const dinner = record?.dinner ?? false
  const extraAmount = record?.extraAmount ?? 0
  const isAbsent = !lunch && !dinner && !extraAmount

  if (isAbsent) {
    return (
      <div className="bg-gray-100 rounded-2xl px-5 py-5 text-center">
        <p className="text-xs text-gray-400 font-medium mb-1">{fullDate}</p>
        <p className="text-sm font-semibold text-gray-500">Absent</p>
        <p className="text-xs text-gray-400 mt-0.5">No meals marked for this day</p>
      </div>
    )
  }

  const dayTotal =
    (lunch  ? (customer?.lunchRate  ?? 0) : 0) +
    (dinner ? (customer?.dinnerRate ?? 0) : 0) +
    extraAmount

  return (
    <div className="bg-black rounded-2xl px-5 py-4">
      <p className="text-gray-400 text-xs font-medium mb-3">{fullDate}</p>
      <div className="flex gap-2 mb-3">
        {/* Lunch */}
        <div className={`flex-1 rounded-xl px-3 py-2.5 text-center ${lunch ? 'bg-white' : 'bg-white/10'}`}>
          <p className={`text-[11px] font-semibold ${lunch ? 'text-black' : 'text-gray-500'}`}>Lunch</p>
          <p className={`text-base font-bold mt-0.5 ${lunch ? 'text-black' : 'text-gray-600'}`}>
            {lunch ? '\u2713' : '\u2715'}
          </p>
        </div>
        {/* Dinner */}
        <div className={`flex-1 rounded-xl px-3 py-2.5 text-center ${dinner ? 'bg-white' : 'bg-white/10'}`}>
          <p className={`text-[11px] font-semibold ${dinner ? 'text-black' : 'text-gray-500'}`}>Dinner</p>
          <p className={`text-base font-bold mt-0.5 ${dinner ? 'text-black' : 'text-gray-600'}`}>
            {dinner ? '\u2713' : '\u2715'}
          </p>
        </div>
        {/* Extra */}
        <div className="flex-1 rounded-xl px-3 py-2.5 text-center bg-white/10">
          <p className="text-[11px] font-semibold text-gray-400">Extra</p>
          <p className="text-xs font-bold mt-0.5 text-white">
            {extraAmount > 0 ? `Rs.${extraAmount}` : 'None'}
          </p>
        </div>
      </div>
      {/* Day total */}
      <div className="flex items-center justify-between pt-2.5 border-t border-white/10">
        <p className="text-xs text-gray-400">Day total</p>
        <p className="text-sm font-bold text-white">Rs.{dayTotal}</p>
      </div>
    </div>
  )
}

const PREFS = [
  { value: 'veg',     emoji: '🌿', label: 'Veg'     },
  { value: 'nonveg',  emoji: '🍖', label: 'Non-Veg' },
  { value: 'fasting', emoji: '🙏', label: 'Fasting'  },
]

// ─── Single meal block ────────────────────────────────────────────────────────

function MealBlock({ meal, isOpen, closedAt, todayRecord, ownerMarked, onSave }) {
  const savedAttendance = todayRecord?.[meal]
  const savedPref       = todayRecord?.[`${meal}Preference`]

  // key prop on MealBlock handles remount when data first loads;
  // useState initializes correctly from props on each mount
  const [attendance, setAttendance] = useState(savedAttendance ?? null)
  const [pref, setPref]             = useState(savedPref ?? null)
  const [saving, setSaving]         = useState(false)

  const title = meal === 'lunch' ? 'Lunch' : 'Dinner'
  const savedPrefEntry = PREFS.find(p => p.value === savedPref)

  // ── Owner already marked ────────────────────────────────────────────────────
  if (ownerMarked) {
    return (
      <div className="bg-gray-50 rounded-2xl px-4 py-4 border border-gray-100">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{title}</p>
          <span className="text-[11px] text-gray-400 bg-white rounded-full px-2 py-0.5 border border-gray-200">Owner marked</span>
        </div>
        <p className="text-sm font-semibold text-gray-600">
          {savedAttendance ? '✓ Present' : '✗ Absent'}
          {savedPrefEntry && <span className="font-normal text-gray-400"> · {savedPrefEntry.emoji} {savedPrefEntry.label}</span>}
        </p>
      </div>
    )
  }

  // ── Time window closed ──────────────────────────────────────────────────────
  if (!isOpen) {
    return (
      <div className="bg-gray-50 rounded-2xl px-4 py-4 border border-gray-100">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{title}</p>
          <span className="text-[11px] text-red-400 font-semibold">Closed at {closedAt}</span>
        </div>
        {savedAttendance != null ? (
          <p className="text-sm font-semibold text-gray-600">
            {savedAttendance ? '✓ Present' : '✗ Absent'}
            {savedPrefEntry && <span className="font-normal text-gray-400"> · {savedPrefEntry.emoji} {savedPrefEntry.label}</span>}
          </p>
        ) : (
          <p className="text-sm text-gray-400">Not marked</p>
        )}
      </div>
    )
  }

  // ── Active ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (attendance === null) return
    setSaving(true)
    try { await onSave(attendance, pref) } finally { setSaving(false) }
  }

  return (
    <div className="bg-white rounded-2xl px-4 py-4 border border-gray-100 shadow-sm">
      <p className="text-xs font-bold text-gray-900 uppercase tracking-wide mb-3">{title}</p>

      {/* Attendance: Present / Absent */}
      <p className="text-xs text-gray-500 mb-2">Will you have {title} today?</p>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setAttendance(true)}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition active:scale-[0.98] ${
            attendance === true ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          ✓ Present
        </button>
        <button
          onClick={() => setAttendance(false)}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition active:scale-[0.98] ${
            attendance === false ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          ✗ Absent
        </button>
      </div>

      {/* Preference: Veg / Non-Veg / Fasting */}
      <p className="text-xs text-gray-500 mb-2">{title} preference:</p>
      <div className="flex gap-2 mb-4">
        {PREFS.map(p => (
          <button
            key={p.value}
            onClick={() => setPref(p.value)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition active:scale-[0.98] ${
              pref === p.value ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p.emoji} {p.label}
          </button>
        ))}
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving || attendance === null}
        className="w-full py-3 rounded-xl text-sm font-semibold bg-black text-white hover:bg-gray-800 active:bg-gray-900 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saving ? 'Saving…' : `Save ${title}`}
      </button>
    </div>
  )
}

// ─── Self attendance section ───────────────────────────────────────────────────

function SelfAttendanceSection({ todayRecord, onSaveMeal }) {
  const hour = new Date().getHours()
  const lunchOpen  = hour < 6   // before 6:00 AM
  const dinnerOpen = hour < 19  // before 7:00 PM

  const ownerMarked = todayRecord != null && todayRecord.selfMarked !== true

  // Hide entirely if owner already marked, or all time windows are closed
  if (ownerMarked || (!lunchOpen && !dinnerOpen)) return null

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide px-1">Mark Today's Attendance</p>

      {lunchOpen && (
        <MealBlock
          key={`lunch-${todayRecord ? 'loaded' : 'empty'}`}
          meal="lunch"
          isOpen={lunchOpen}
          closedAt="6:00 AM"
          todayRecord={todayRecord}
          ownerMarked={false}
          onSave={(att, pref) => onSaveMeal('lunch', att, pref)}
        />
      )}

      {dinnerOpen && (
        <MealBlock
          key={`dinner-${todayRecord ? 'loaded' : 'empty'}`}
          meal="dinner"
          isOpen={dinnerOpen}
          closedAt="7:00 PM"
          todayRecord={todayRecord}
          ownerMarked={false}
          onSave={(att, pref) => onSaveMeal('dinner', att, pref)}
        />
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CustomerAttendance() {
  const navigate = useNavigate()
  const { userData } = useAuth()
  const customerId = userData?.customerId

  const now = new Date()
  const todayYear = now.getFullYear()
  const todayMonth = now.getMonth() + 1

  const [year, setYear] = useState(todayYear)
  const [month, setMonth] = useState(todayMonth)

  const [customer, setCustomer] = useState(null)
  const [attendanceMap, setAttendanceMap] = useState({})
  const [todayMenu, setTodayMenu] = useState(undefined) // undefined = loading, null = not found
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  const today = todayKey()
  const [selectedDate, setSelectedDate] = useState(today)

  async function handleSaveMeal(meal, attendance, pref) {
    const docId = `${customerId}_${today}`
    const existing = attendanceMap[today] ?? {}
    const prefField = `${meal}Preference`
    const newData = {
      ...existing,
      [meal]: attendance,
      [prefField]: pref ?? null,
      selfMarked: true,
      customerId,
      date: today,
    }
    setAttendanceMap(prev => ({ ...prev, [today]: newData }))
    setToast('Saved successfully')
    const timer = setTimeout(() => setToast(null), 2500)
    try {
      await setDoc(doc(db, 'attendance', docId), {
        [meal]: attendance,
        [prefField]: pref ?? null,
        selfMarked: true,
        customerId,
        date: today,
      }, { merge: true })
    } catch (err) {
      console.error('Failed to save:', err)
      clearTimeout(timer)
      setToast(null)
      setAttendanceMap(prev => ({ ...prev, [today]: existing }))
    }
  }

  async function handleLogout() {
    if (window.confirm('Are you sure you want to logout?')) {
      await signOut(auth)
      navigate('/login')
    }
  }

  const fetchData = useCallback(async () => {
    if (!customerId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      // Fetch customer profile once
      if (!customer) {
        const cSnap = await getDoc(doc(db, 'customers', customerId))
        if (cSnap.exists()) setCustomer({ id: cSnap.id, ...cSnap.data() })
      }

      // Query by customerId only — avoids needing a composite Firestore index.
      // Date filtering is done in JS below.
      const aSnap = await getDocs(
        query(collection(db, 'attendance'), where('customerId', '==', customerId))
      )

      // Today's menu (fetch once regardless of selected month)
      const menuSnap = await getDoc(doc(db, 'menus', today))
      setTodayMenu(menuSnap.exists() ? menuSnap.data() : null)

      console.log('customerId:', customerId)
      console.log('attendance records found:', aSnap.size)

      const { start, end } = getMonthBounds(year, month)
      const aMap = {}
      aSnap.docs.forEach(d => {
        const data = d.data()
        // Always include today so self-attendance section works on any viewed month
        if ((data.date >= start && data.date <= end) || data.date === today) {
          aMap[data.date] = data
        }
      })
      setAttendanceMap(aMap)
    } catch (err) {
      console.error('Failed to fetch attendance:', err)
    } finally {
      setLoading(false)
    }
  }, [customerId, year, month, customer])

  useEffect(() => { fetchData() }, [fetchData])

  // ── stats ──────────────────────────────────────────────────────────────────
  const daysInMonth = new Date(year, month, 0).getDate()
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
    const newYear  = month === 1 ? year - 1 : year
    const newMonth = month === 1 ? 12 : month - 1
    setYear(newYear); setMonth(newMonth)
    setSelectedDate(newYear === todayYear && newMonth === todayMonth ? today : null)
  }
  function nextMonth() {
    const newYear  = month === 12 ? year + 1 : year
    const newMonth = month === 12 ? 1 : month + 1
    setYear(newYear); setMonth(newMonth)
    setSelectedDate(newYear === todayYear && newMonth === todayMonth ? today : null)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Header ── */}
      <header className="bg-black px-4 pt-12 pb-5 flex-shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center flex-shrink-0">
              <span className="text-black text-xs font-bold tracking-widest">HMF</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-white text-lg font-bold leading-tight m-0">Attendance</h1>
              <p className="text-gray-400 text-xs mt-0.5">{customer?.name || '—'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-white/60 hover:text-white p-2 -mr-1 rounded-xl active:bg-white/10 transition flex-shrink-0"
            aria-label="Logout"
          >
            <LogoutIcon />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-3 py-3 pb-24 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <div className="w-7 h-7 border-[3px] border-black border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Loading attendance…</p>
          </div>
        ) : !customerId ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-center px-6">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-1 text-2xl">⚠️</div>
            <p className="text-sm font-semibold text-gray-700">Account not linked</p>
            <p className="text-xs text-gray-400">Your account has no customer profile attached. Please contact the owner.</p>
          </div>
        ) : (
          <>
            {/* ── Today's menu ── */}
            {todayMenu !== undefined && (
              <TodayMenuCard menu={todayMenu} />
            )}

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
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />

              {/* Legend */}
              <div className="flex items-center gap-3 flex-wrap mt-4 pt-3 border-t border-gray-100">
                <LegendItem color="bg-[#1a1a1a]" label="Present" />
                <LegendItem color="bg-[#FF3B30]" label="Absent" />
                <LegendItem color="bg-white border-2 border-black" label="Today" />
              </div>
            </div>

            {/* ── Selected day detail ── */}
            {selectedDate && (
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide px-1 mb-2">
                  Selected Day
                </p>
                <SelectedDayCard
                  dateStr={selectedDate}
                  record={attendanceMap[selectedDate]}
                  customer={customer}
                />
              </div>
            )}

            {/* ── Self attendance ── */}
            <SelfAttendanceSection
              todayRecord={attendanceMap[today]}
              onSaveMeal={handleSaveMeal}
            />
          </>
        )}
      </main>

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-lg pointer-events-none">
          ✓ {toast}
        </div>
      )}

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
