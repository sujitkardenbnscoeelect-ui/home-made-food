import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  setDoc,
  doc,
} from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { db, auth } from '../../lib/firebase'

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
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const EMPTY_RECORD = { lunch: false, dinner: false, extraAmount: 0 }

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

function UsersIcon() {
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

function ReceiptIcon() {
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

function MenuIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
    </svg>
  )
}

// ─── Menu Modal ───────────────────────────────────────────────────────────────

function MenuModal({ dateKey, onClose }) {
  const [fields, setFields] = useState({ lunchVeg: '', lunchNonVeg: '', dinnerVeg: '', dinnerNonVeg: '' })
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getDoc(doc(db, 'menus', dateKey)).then(snap => {
      if (snap.exists()) {
        const d = snap.data()
        setFields({
          lunchVeg:    d.lunchVeg    ?? '',
          lunchNonVeg: d.lunchNonVeg ?? '',
          dinnerVeg:   d.dinnerVeg   ?? '',
          dinnerNonVeg: d.dinnerNonVeg ?? '',
        })
      }
      setLoaded(true)
    })
  }, [dateKey])

  function set(key, val) { setFields(f => ({ ...f, [key]: val })) }

  async function handleSave() {
    setSaving(true)
    try {
      await setDoc(doc(db, 'menus', dateKey), { date: dateKey, ...fields })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black placeholder:text-gray-300'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-t-2xl px-6 pt-5 pb-10 shadow-xl"
        onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <h3 className="text-base font-semibold text-gray-900 mb-0.5">Today's Menu</h3>
        <p className="text-xs text-gray-400 mb-5">{dateKey}</p>

        {!loaded ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Lunch */}
            <div>
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">Lunch</p>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Veg</label>
                  <input value={fields.lunchVeg} onChange={e => set('lunchVeg', e.target.value)}
                    placeholder="Dal, Rice, Sabzi, Roti…" className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Non-Veg</label>
                  <input value={fields.lunchNonVeg} onChange={e => set('lunchNonVeg', e.target.value)}
                    placeholder="Chicken Curry, Rice, Roti…" className={inputCls} />
                </div>
              </div>
            </div>

            {/* Dinner */}
            <div>
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">Dinner</p>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Veg</label>
                  <input value={fields.dinnerVeg} onChange={e => set('dinnerVeg', e.target.value)}
                    placeholder="Dal, Sabzi, Roti…" className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Non-Veg</label>
                  <input value={fields.dinnerNonVeg} onChange={e => set('dinnerNonVeg', e.target.value)}
                    placeholder="Mutton Curry, Roti…" className={inputCls} />
                </div>
              </div>
            </div>

            <button onClick={handleSave} disabled={saving}
              className="w-full bg-black text-white rounded-xl py-3 text-sm font-semibold hover:bg-gray-900 active:bg-gray-800 transition disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Menu'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Extra Meal Modal ────────────────────────────────────────────────────────

function ExtraModal({ customer, record, onSave, onClose }) {
  const [amount, setAmount] = useState(String(record?.extraAmount ?? 0))

  function handleSave() {
    onSave(Math.max(0, parseInt(amount, 10) || 0))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-0 pb-0"
      onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-t-2xl px-6 pt-5 pb-8 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

        <h3 className="text-base font-semibold text-gray-900 mb-1">Extra Amount</h3>
        <p className="text-sm text-gray-400 mb-5">{customer.name}</p>

        <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
          Amount (₹)
        </label>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAmount(v => String(Math.max(0, (parseInt(v) || 0) - 10)))}
            className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-lg font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100"
          >−</button>
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">₹</span>
            <input
              type="number"
              min="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full pl-7 pr-3 border border-gray-200 rounded-lg py-2.5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
          <button
            onClick={() => setAmount(v => String((parseInt(v) || 0) + 10))}
            className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-lg font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100"
          >+</button>
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

const PREF_EMOJI = { veg: '🌿', nonveg: '🍖', fasting: '🙏' }

function CustomerRow({ customer, record, saving, onToggle, onExtra }) {
  const lunch = record?.lunch ?? false
  const dinner = record?.dinner ?? false
  const extraAmount = record?.extraAmount ?? 0
  const hasExtra = extraAmount > 0
  const isSaving = saving
  const lunchEmoji  = PREF_EMOJI[record?.lunchPreference]
  const dinnerEmoji = PREF_EMOJI[record?.dinnerPreference]

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
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
            {customer.name}
          </p>
          {(lunchEmoji || dinnerEmoji) && (
            <span className="text-sm leading-none flex-shrink-0 whitespace-nowrap">
              {lunchEmoji}{dinnerEmoji && lunchEmoji !== dinnerEmoji ? dinnerEmoji : ''}
            </span>
          )}
        </div>
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

        {/* Extra amount */}
        <button
          disabled={isSaving}
          onClick={onExtra}
          className={`h-9 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center px-2 relative ${
            hasExtra
              ? 'bg-gray-900 text-white min-w-[3rem]'
              : 'w-9 border-2 border-gray-200 text-gray-400'
          } disabled:opacity-40`}
        >
          {hasExtra ? `₹${extraAmount}` : '+'}
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
  const [menuModal, setMenuModal] = useState(false)

  // ── logout ─────────────────────────────────────────────────────────────────
  async function handleLogout() {
    if (window.confirm('Are you sure you want to logout?')) {
      await signOut(auth)
      navigate('/login')
    }
  }

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
        extraAmount: updated.extraAmount ?? 0,
      })
    } catch {
      setAttendance(prev => ({ ...prev, [cid]: current }))
    } finally {
      setSavingSet(prev => { const s = new Set(prev); s.delete(cid); return s })
    }
  }

  // ── save extras ────────────────────────────────────────────────────────────
  async function handleSaveExtra(customer, extraAmount) {
    const cid = customer.id
    const current = attendance[cid] ?? { ...EMPTY_RECORD }
    const updated = { ...current, extraAmount }
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
        extraAmount,
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

  const lunchPref  = { veg: 0, nonveg: 0, fasting: 0 }
  const dinnerPref = { veg: 0, nonveg: 0, fasting: 0 }
  customers.forEach(c => {
    const r = attendance[c.id]
    if (r?.lunchPreference  && lunchPref[r.lunchPreference]  !== undefined) lunchPref[r.lunchPreference]++
    if (r?.dinnerPreference && dinnerPref[r.dinnerPreference] !== undefined) dinnerPref[r.dinnerPreference]++
  })
  const hasLunchPref  = lunchPref.veg  + lunchPref.nonveg  + lunchPref.fasting  > 0
  const hasDinnerPref = dinnerPref.veg + dinnerPref.nonveg + dinnerPref.fasting > 0
  const hasPrefData   = hasLunchPref || hasDinnerPref

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
          <div className="flex items-center gap-1">
            <button
              onClick={() => fetchAttendance(true)}
              className="text-white p-2 rounded-xl active:bg-white/10 transition"
              aria-label="Refresh"
            >
              <RefreshIcon spinning={refreshing} />
            </button>
            <button
              onClick={handleLogout}
              className="text-white/60 hover:text-white p-2 -mr-1 rounded-xl active:bg-white/10 transition"
              aria-label="Logout"
            >
              <LogoutIcon />
            </button>
          </div>
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
            {isToday && (
              <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-wide leading-none mb-0.5">Today</p>
            )}
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
      <div className="bg-white border-b border-gray-100 px-4 pt-3 pb-2 flex-shrink-0 space-y-2">
        <div className="flex gap-3">
          <div className="flex items-center gap-2 bg-black text-white rounded-full px-3 py-1.5">
            <span className="text-xs font-semibold">Present</span>
            <span className="text-sm font-bold">{presentCount}</span>
          </div>
          <div className="flex items-center gap-2 bg-gray-100 text-gray-500 rounded-full px-3 py-1.5">
            <span className="text-xs font-semibold">Absent</span>
            <span className="text-sm font-bold">{absentCount}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-400">{customers.length} customers</span>
            <button
              onClick={() => setMenuModal(true)}
              className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-600 rounded-full px-2.5 py-1.5 transition"
              aria-label="Set today's menu"
            >
              <MenuIcon />
              <span className="text-xs font-semibold">Menu</span>
            </button>
          </div>
        </div>
        {hasPrefData && (
          <div className="flex flex-col gap-0.5 pb-1">
            {hasLunchPref && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-400 w-10">Lunch:</span>
                <span className="text-[11px] font-semibold text-gray-700">🌿 {lunchPref.veg}</span>
                <span className="text-[11px] font-semibold text-gray-700">🍖 {lunchPref.nonveg}</span>
                <span className="text-[11px] font-semibold text-gray-700">🙏 {lunchPref.fasting}</span>
              </div>
            )}
            {hasDinnerPref && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-400 w-10">Dinner:</span>
                <span className="text-[11px] font-semibold text-gray-700">🌿 {dinnerPref.veg}</span>
                <span className="text-[11px] font-semibold text-gray-700">🍖 {dinnerPref.nonveg}</span>
                <span className="text-[11px] font-semibold text-gray-700">🙏 {dinnerPref.fasting}</span>
              </div>
            )}
          </div>
        )}
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

      {/* ── Menu Modal ── */}
      {menuModal && (
        <MenuModal dateKey={today} onClose={() => setMenuModal(false)} />
      )}

      {/* ── Extra Meal Modal ── */}
      {modal && (
        <ExtraModal
          customer={modal.customer}
          record={attendance[modal.customer.id]}
          onSave={(amt) => handleSaveExtra(modal.customer, amt)}
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
