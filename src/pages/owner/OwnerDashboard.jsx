import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'

// ─── helpers ────────────────────────────────────────────────────────────────

function todayKey() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function offsetDate(dateStr, days) {
  const [yyyy, mm, dd] = dateStr.split('-').map(Number)
  const d = new Date(yyyy, mm - 1, dd)
  d.setDate(d.getDate() + days)
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function formatDisplayDate(dateStr) {
  const [yyyy, mm, dd] = dateStr.split('-').map(Number)
  const d = new Date(yyyy, mm - 1, dd)
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const EMPTY_RECORD = { lunch: false, dinner: false, extraLunch: 0, extraDinner: 0 }

// ─── icons ───────────────────────────────────────────────────────────────────

function RefreshIcon({ spinning }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`w-5 h-5 ${spinning ? 'animate-spin' : ''}`}
    >
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

function HomeIcon({ active }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function UsersIcon({ active }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function ReceiptIcon({ active }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
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

// ─── Extra Meal Modal ────────────────────────────────────────────────────────

function ExtraModal({ customer, record, onSave, onClose }) {
  const [extraLunch, setExtraLunch] = useState(String(record?.extraLunch ?? 0))
  const [extraDinner, setExtraDinner] = useState(String(record?.extraDinner ?? 0))

  function handleSave() {
    const el = Math.max(0, parseInt(extraLunch, 10) || 0)
    const ed = Math.max(0, parseInt(extraDinner, 10) || 0)
    onSave(el, ed)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-0 pb-0"
      onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-t-2xl px-6 pt-5 pb-8 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* drag handle */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

        <h3 className="text-base font-semibold text-gray-900 mb-1">
          Extra Meals
        </h3>
        <p className="text-sm text-gray-400 mb-5">{customer.name}</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
              Extra Lunch
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setExtraLunch(v => String(Math.max(0, (parseInt(v) || 0) - 1)))}
                className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-lg font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100"
              >−</button>
              <input
                type="number"
                min="0"
                value={extraLunch}
                onChange={e => setExtraLunch(e.target.value)}
                className="w-16 text-center border border-gray-200 rounded-lg py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
              />
              <button
                onClick={() => setExtraLunch(v => String((parseInt(v) || 0) + 1))}
                className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-lg font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100"
              >+</button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
              Extra Dinner
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setExtraDinner(v => String(Math.max(0, (parseInt(v) || 0) - 1)))}
                className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-lg font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100"
              >−</button>
              <input
                type="number"
                min="0"
                value={extraDinner}
                onChange={e => setExtraDinner(e.target.value)}
                className="w-16 text-center border border-gray-200 rounded-lg py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
              />
              <button
                onClick={() => setExtraDinner(v => String((parseInt(v) || 0) + 1))}
                className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-lg font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100"
              >+</button>
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="mt-6 w-full bg-black text-white rounded-xl py-3 text-sm font-semibold hover:bg-gray-900 active:bg-gray-800 transition"
        >
          Save
        </button>
      </div>
    </div>
  )
}

// ─── Customer Row ─────────────────────────────────────────────────────────────

function CustomerRow({ customer, record, saving, onToggle, onExtra }) {
  const lunch = record?.lunch ?? false
  const dinner = record?.dinner ?? false
  const hasExtra = (record?.extraLunch ?? 0) > 0 || (record?.extraDinner ?? 0) > 0
  const isSaving = saving

  return (
    <div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm border border-gray-100">
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-black flex-shrink-0 flex items-center justify-center">
        <span className="text-white text-sm font-bold uppercase">
          {customer.name?.charAt(0) ?? '?'}
        </span>
      </div>

      {/* Name + rates */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
          {customer.name}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          L ₹{customer.lunchRate ?? '—'} · D ₹{customer.dinnerRate ?? '—'}
        </p>
      </div>

      {/* L / D toggles */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          disabled={isSaving}
          onClick={() => onToggle('lunch')}
          className={`w-9 h-9 rounded-xl text-xs font-bold transition-all active:scale-95 ${
            lunch
              ? 'bg-black text-white'
              : 'border-2 border-gray-200 text-gray-400'
          } disabled:opacity-40`}
        >
          L
        </button>
        <button
          disabled={isSaving}
          onClick={() => onToggle('dinner')}
          className={`w-9 h-9 rounded-xl text-xs font-bold transition-all active:scale-95 ${
            dinner
              ? 'bg-black text-white'
              : 'border-2 border-gray-200 text-gray-400'
          } disabled:opacity-40`}
        >
          D
        </button>

        {/* Extra meals */}
        <button
          disabled={isSaving}
          onClick={onExtra}
          className={`w-9 h-9 rounded-xl text-base font-bold transition-all active:scale-95 flex items-center justify-center relative ${
            hasExtra
              ? 'bg-gray-900 text-white'
              : 'border-2 border-gray-200 text-gray-400'
          } disabled:opacity-40`}
        >
          +
          {hasExtra && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-white border border-gray-200 rounded-full text-[8px] font-bold text-gray-900 flex items-center justify-center leading-none">
              {(record?.extraLunch ?? 0) + (record?.extraDinner ?? 0)}
            </span>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OwnerDashboard() {
  const navigate = useNavigate()
  const today = todayKey()

  const [selectedDate, setSelectedDate] = useState(today)
  const displayDate = formatDisplayDate(selectedDate)
  const isToday = selectedDate === today

  const [customers, setCustomers] = useState([])
  const [attendance, setAttendance] = useState({})
  const [savingSet, setSavingSet] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [modal, setModal] = useState(null)

  // ── date navigation ────────────────────────────────────────────────────────
  function goToPrevDay() {
    setSelectedDate(d => offsetDate(d, -1))
  }
  function goToNextDay() {
    setSelectedDate(d => {
      const next = offsetDate(d, 1)
      return next <= today ? next : d
    })
  }
  function goToToday() {
    setSelectedDate(today)
  }

  // ── fetch customers (once) ─────────────────────────────────────────────────
  const fetchCustomers = useCallback(async () => {
    const cSnap = await getDocs(
      query(collection(db, 'customers'), where('active', '==', true))
    )
    setCustomers(cSnap.docs.map(d => ({ id: d.id, ...d.data() })))
  }, [])

  // ── fetch attendance for selected date ────────────────────────────────────
  const fetchAttendance = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const aSnap = await getDocs(
        query(collection(db, 'attendance'), where('date', '==', selectedDate))
      )
      const aMap = {}
      aSnap.docs.forEach(d => {
        const data = d.data()
        aMap[data.customerId] = data
      })
      setAttendance(aMap)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedDate])

  // customers load once; attendance reloads whenever date changes
  useEffect(() => { fetchCustomers() }, [fetchCustomers])
  useEffect(() => { fetchAttendance() }, [fetchAttendance])

  // ── toggle lunch / dinner ──────────────────────────────────────────────────
  async function handleToggle(customer, type) {
    const cid = customer.id
    const current = attendance[cid] ?? { ...EMPTY_RECORD }
    const updated = { ...current, [type]: !current[type] }
    const docId = `${cid}_${selectedDate}`

    setAttendance(prev => ({ ...prev, [cid]: updated }))
    setSavingSet(prev => new Set(prev).add(cid))

    try {
      await setDoc(doc(db, 'attendance', docId), {
        customerId: cid,
        date: selectedDate,
        lunch: updated.lunch,
        dinner: updated.dinner,
        extraLunch: updated.extraLunch ?? 0,
        extraDinner: updated.extraDinner ?? 0,
      })
    } catch {
      setAttendance(prev => ({ ...prev, [cid]: current }))
    } finally {
      setSavingSet(prev => { const s = new Set(prev); s.delete(cid); return s })
    }
  }

  // ── save extras ────────────────────────────────────────────────────────────
  async function handleSaveExtra(customer, extraLunch, extraDinner) {
    const cid = customer.id
    const current = attendance[cid] ?? { ...EMPTY_RECORD }
    const updated = { ...current, extraLunch, extraDinner }
    const docId = `${cid}_${selectedDate}`

    setAttendance(prev => ({ ...prev, [cid]: updated }))
    setModal(null)
    setSavingSet(prev => new Set(prev).add(cid))

    try {
      await setDoc(doc(db, 'attendance', docId), {
        customerId: cid,
        date: selectedDate,
        lunch: updated.lunch,
        dinner: updated.dinner,
        extraLunch,
        extraDinner,
      })
    } catch {
      setAttendance(prev => ({ ...prev, [cid]: current }))
    } finally {
      setSavingSet(prev => { const s = new Set(prev); s.delete(cid); return s })
    }
  }

  // ── stats ──────────────────────────────────────────────────────────────────
  const presentCount = customers.filter(c => {
    const r = attendance[c.id]
    return r?.lunch || r?.dinner
  }).length
  const absentCount = customers.length - presentCount

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Header ── */}
      <header className="bg-black px-4 pt-12 pb-4 flex-shrink-0">
        {/* Row 1: logo + title + refresh */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center flex-shrink-0">
              <span className="text-black text-xs font-bold tracking-widest">HMF</span>
            </div>
            <h1 className="text-white text-lg font-bold leading-tight m-0">Attendance</h1>
          </div>
          <button
            onClick={() => fetchAttendance(true)}
            className="text-white p-2 -mr-1 rounded-xl active:bg-white/10 transition"
            aria-label="Refresh"
          >
            <RefreshIcon spinning={refreshing} />
          </button>
        </div>

        {/* Row 2: date navigator */}
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevDay}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center text-white transition flex-shrink-0"
            aria-label="Previous day"
          >
            <ChevronLeftIcon />
          </button>

          <div className="flex-1 text-center">
            <p className="text-white text-sm font-semibold leading-tight">{displayDate}</p>
          </div>

          <button
            onClick={goToNextDay}
            disabled={isToday}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center text-white transition flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next day"
          >
            <ChevronRightIcon />
          </button>

          {!isToday && (
            <button
              onClick={goToToday}
              className="flex-shrink-0 bg-white text-black text-xs font-bold px-2.5 py-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition"
            >
              Today
            </button>
          )}
        </div>
      </header>

      {/* ── Stats bar ── */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex gap-3 flex-shrink-0">
        <div className="flex items-center gap-2 bg-black text-white rounded-full px-3 py-1.5">
          <span className="text-xs font-semibold">Present</span>
          <span className="text-sm font-bold">{presentCount}</span>
        </div>
        <div className="flex items-center gap-2 bg-gray-100 text-gray-500 rounded-full px-3 py-1.5">
          <span className="text-xs font-semibold">Absent</span>
          <span className="text-sm font-bold">{absentCount}</span>
        </div>
        <div className="ml-auto flex items-center">
          <span className="text-xs text-gray-400">{customers.length} customers</span>
        </div>
      </div>

      {/* ── List ── */}
      <main className="flex-1 overflow-y-auto px-3 py-3 pb-24">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <div className="w-7 h-7 border-[3px] border-black border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Loading customers…</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-center px-6">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-1">
              <UsersIcon />
            </div>
            <p className="text-sm font-semibold text-gray-700">No customers added yet</p>
            <p className="text-xs text-gray-400">Go to the Customers tab to add customers</p>
          </div>
        ) : (
          <div className="space-y-2">
            {customers.map(customer => (
              <CustomerRow
                key={customer.id}
                customer={customer}
                record={attendance[customer.id]}
                saving={savingSet.has(customer.id)}
                onToggle={(type) => handleToggle(customer, type)}
                onExtra={() => setModal({ customer })}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Bottom Nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-100 flex">
        <NavTab
          label="Attendance"
          active
          icon={<HomeIcon active />}
          onClick={() => {}}
        />
        <NavTab
          label="Customers"
          icon={<UsersIcon />}
          onClick={() => navigate('/owner/customers')}
        />
        <NavTab
          label="Bills"
          icon={<ReceiptIcon />}
          onClick={() => navigate('/owner/bills')}
        />
      </nav>

      {/* ── Extra Meal Modal ── */}
      {modal && (
        <ExtraModal
          customer={modal.customer}
          record={attendance[modal.customer.id]}
          onSave={(el, ed) => handleSaveExtra(modal.customer, el, ed)}
          onClose={() => setModal(null)}
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
