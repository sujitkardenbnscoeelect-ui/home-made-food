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
  addDoc,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import {
  MONTH_NAMES,
  getMonthBounds,
  calcBill,
  generateBillPDF,
} from '../../lib/generateBill'

// ─── helpers ─────────────────────────────────────────────────────────────────

function pad(n) { return String(n).padStart(2, '0') }
function mKey(year, month) { return `${year}-${pad(month)}` }

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function getTomorrowDate() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function formatBillingDate(dateStr) {
  if (!dateStr) return null
  const [y, m, day] = dateStr.split('-').map(Number)
  return `${day} ${MONTH_NAMES[m - 1]} ${y}`
}

function getWeeks(year, month) {
  const last = new Date(year, month, 0).getDate()
  const weeks = [
    { num: 1, start: 1,  end: 7  },
    { num: 2, start: 8,  end: 14 },
    { num: 3, start: 15, end: 21 },
    { num: 4, start: 22, end: 28 },
  ]
  if (last > 28) weeks.push({ num: 5, start: 29, end: last })
  return weeks
}

function weekLabel(week, month) {
  const m = MONTH_NAMES[month - 1].slice(0, 3)
  return `${m} ${week.start}–${week.end}`
}

function filterWeekDocs(allDocs, week) {
  return allDocs.filter(d => {
    const day = parseInt(d.date.split('-')[2], 10)
    return day >= week.start && day <= week.end
  })
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
function PlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}
function XIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

// ─── Month Picker ─────────────────────────────────────────────────────────────

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
              <button key={name} onClick={() => { onChange(y, i + 1); onClose() }}
                className={`py-2.5 rounded-xl text-sm font-semibold transition ${active ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {name.slice(0, 3)}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({ title, message, confirmLabel = 'Confirm', onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onCancel}>
      <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-5">{message}</p>
        <div className="flex gap-2">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800 transition">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Payment Modal (flexible) ─────────────────────────────────────────────────

function PaymentModal({ customer, onSave, onClose }) {
  const [amount, setAmount] = useState('')
  const [date, setDate]     = useState(todayStr())
  const [note, setNote]     = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleSave() {
    const amt = Number(amount)
    if (!amount || isNaN(amt) || amt <= 0) { setError('Enter a valid amount'); return }
    setSaving(true)
    try {
      await onSave({ amount: amt, date, note: note.trim() })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black transition'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-t-2xl px-5 pt-4 pb-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
        <h3 className="text-base font-bold text-gray-900 mb-0.5">Record Payment</h3>
        <p className="text-sm text-gray-400 mb-5">{customer.name}</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Amount Received *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">₹</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0" className={`${inputCls} pl-7`} autoFocus />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Note (optional)</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder="e.g. Paid via UPI" className={inputCls} />
          </div>
          {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
        </div>

        <button onClick={handleSave} disabled={saving}
          className="mt-5 w-full bg-black text-white rounded-xl py-3.5 text-sm font-semibold hover:bg-gray-900 active:bg-gray-800 transition disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Payment'}
        </button>
      </div>
    </div>
  )
}

// ─── History Sheet ────────────────────────────────────────────────────────────

function HistorySheet({ customer, paymentType, onClose }) {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [fetchError, setFetchError] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setFetchError(null)
      try {
        // normalize to string — Firestore doc IDs are always strings but legacy data may differ
        const cid = String(customer.id)
        console.log('History query customerId:', cid, 'type:', typeof cid, 'paymentType:', paymentType)

        const typeKey = paymentType === 'flexible' ? 'flexible'
          : paymentType === 'weekly' ? 'weekly' : 'monthly'

        // ── payments collection (new format, saved from current code) ──
        const paySnap = await getDocs(
          query(collection(db, 'payments'), where('customerId', '==', cid))
        )
        console.log('[HistorySheet] payments found:', paySnap.size, 'docs')
        paySnap.docs.forEach(d => console.log('  payment doc:', d.id, d.data()))

        const fromPayments = paySnap.docs.map(d => ({ id: d.id, _source: 'payments', ...d.data() }))
          // include if type matches, OR no type field at all (legacy record — accept for any type)
          .filter(p => p.type === typeKey || !p.type)

        // ── bills collection (legacy format — monthly/weekly records saved before payments collection) ──
        let fromBills = []
        if (typeKey === 'monthly' || typeKey === 'weekly') {
          const billsSnap = await getDocs(
            query(collection(db, 'bills'), where('customerId', '==', cid))
          )
          console.log('[HistorySheet] bills found:', billsSnap.size, 'docs')
          fromBills = billsSnap.docs
            .map(d => ({ id: d.id, _source: 'bills', ...d.data() }))
            .filter(b => b.paid === true)
            // only include if there is no corresponding payments entry for same period
            .filter(b => {
              if (typeKey === 'monthly') {
                return !fromPayments.some(p => p.year === b.year && p.month === b.month)
              }
              return !fromPayments.some(p => p.year === b.year && p.month === b.month && p.weekNum === b.weekNum)
            })
        }

        const merged = [...fromPayments, ...fromBills]
          .sort((a, b) => (b.paidAt ?? b.createdAt ?? '').localeCompare(a.paidAt ?? a.createdAt ?? ''))

        console.log('[HistorySheet] total items after merge:', merged.length)
        setItems(merged)
      } catch (err) {
        console.error('[HistorySheet] fetch error:', err)
        setFetchError(err.message ?? 'Failed to load history')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [customer.id, paymentType])

  const totalPaid = paymentType === 'flexible'
    ? items.reduce((s, p) => s + p.amount, 0)
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-t-2xl flex flex-col max-h-[80vh] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex-shrink-0 px-5 pt-4 pb-3 border-b border-gray-100">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-bold text-gray-900">{customer.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">Payment History</p>
            </div>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
              <XIcon />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
            </div>
          ) : fetchError ? (
            <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-3 text-center">{fetchError}</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No payment history yet</p>
          ) : paymentType === 'flexible' ? (
            <div className="space-y-1">
              {items.map(p => (
                <div key={p.id} className="flex items-start justify-between py-2.5 border-b border-gray-50">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">₹{p.amount}</p>
                    {p.note && <p className="text-xs text-gray-400 mt-0.5">{p.note}</p>}
                  </div>
                  <p className="text-xs text-gray-400">{p.date}</p>
                </div>
              ))}
              <div className="pt-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">Total Paid</p>
                <p className="text-sm font-bold text-green-600">₹{totalPaid}</p>
              </div>
            </div>
          ) : paymentType === 'weekly' ? (
            <div className="space-y-1">
              {items.map(p => {
                const mealParts = [
                  p.lunchDays > 0 && `${p.lunchDays} Lunch`,
                  p.dinnerDays > 0 && `${p.dinnerDays} Dinner`,
                  p.extraAmount > 0 && `₹${p.extraAmount} extra`,
                ].filter(Boolean)
                return (
                <div key={p.id} className="flex items-start justify-between py-2.5 border-b border-gray-50">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {p.weekLabel ?? `Week ${p.weekNum} - ${MONTH_NAMES[(p.month ?? 1) - 1]} ${p.year}`}
                    </p>
                    {p.startDate && p.endDate && (
                      <p className="text-xs text-gray-400 mt-0.5">{p.startDate} – {p.endDate}</p>
                    )}
                    {mealParts.length > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5">{mealParts.join(' · ')}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      Paid on {p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-green-600">₹{p.amount ?? '—'}</p>
                </div>
                )
              })}
              <div className="pt-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">Total Paid</p>
                <p className="text-sm font-bold text-green-600">₹{items.reduce((s, p) => s + (p.amount ?? 0), 0)}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {items.map(p => {
                const mealParts = [
                  p.lunchDays > 0 && `${p.lunchDays} Lunch`,
                  p.dinnerDays > 0 && `${p.dinnerDays} Dinner`,
                  p.extraAmount > 0 && `₹${p.extraAmount} extra`,
                ].filter(Boolean)
                return (
                <div key={p.id} className="flex items-start justify-between py-2.5 border-b border-gray-50">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {MONTH_NAMES[(p.month ?? 1) - 1]} {p.year}
                    </p>
                    {mealParts.length > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5">{mealParts.join(' · ')}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      Paid on {p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-green-600">₹{p.amount ?? '—'}</p>
                </div>
                )
              })}
              <div className="pt-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">Total Paid</p>
                <p className="text-sm font-bold text-green-600">₹{items.reduce((s, p) => s + (p.amount ?? 0), 0)}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Monthly Bill Card ─────────────────────────────────────────────────────────

function MonthlyBillCard({ customer, billData, paid, undoActive, onMarkPaid, onUndo, onForceUnpaid, onPDF, onWhatsApp, onHistory }) {
  const { lunchDays, dinnerDays, extraAmount, total } = billData
  const longPressTimer = useRef(null)

  const summaryParts = []
  if (lunchDays) summaryParts.push(`${lunchDays}L`)
  if (dinnerDays) summaryParts.push(`${dinnerDays}D`)
  if (extraAmount) summaryParts.push(`₹${extraAmount} extra`)

  function startLongPress() {
    if (!paid) return
    longPressTimer.current = setTimeout(() => onForceUnpaid(), 600)
  }
  function cancelLongPress() { clearTimeout(longPressTimer.current) }

  return (
    <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 select-none"
      onMouseDown={startLongPress} onMouseUp={cancelLongPress} onMouseLeave={cancelLongPress}
      onTouchStart={startLongPress} onTouchEnd={cancelLongPress}>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-black flex-shrink-0 flex items-center justify-center">
          <span className="text-white text-sm font-bold uppercase">{customer.name?.charAt(0) ?? '?'}</span>
        </div>
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
          {customer.billingStartDate && (
            <p className="text-[10px] text-blue-500 mt-0.5">Billing from: {formatBillingDate(customer.billingStartDate)}</p>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-base font-bold text-gray-900">₹{total}</p>
          <button onClick={onHistory} className="text-[11px] text-gray-400 hover:text-gray-600 mt-0.5 block">History</button>
        </div>
      </div>

      {undoActive && (
        <div className="mt-2 flex items-center justify-between bg-green-50 rounded-xl px-3 py-2 border border-green-100">
          <p className="text-xs font-semibold text-green-700">Marked as paid ✓</p>
          <button onClick={onUndo} className="text-xs font-bold text-green-700 underline">Undo</button>
        </div>
      )}

      {paid && !undoActive && (
        <p className="text-[10px] text-gray-300 text-center mt-2">Hold to reverse payment</p>
      )}

      {(lunchDays > 0 || dinnerDays > 0) && total > 0 && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
          {!paid ? (
            <>
              <button onClick={onWhatsApp}
                className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white rounded-xl py-2 text-xs font-semibold transition">
                <WhatsAppIcon /> WhatsApp
              </button>
              <button onClick={onMarkPaid}
                className="flex items-center justify-center gap-1.5 bg-gray-900 hover:bg-black text-white rounded-xl px-4 py-2 text-xs font-semibold transition">
                Mark Paid
              </button>
              <button onClick={onPDF}
                className="flex items-center justify-center border border-gray-200 text-gray-500 rounded-xl px-3 py-2 text-xs font-semibold hover:bg-gray-50 transition">
                <PdfIcon />
              </button>
            </>
          ) : (
            <button onClick={onPDF}
              className="flex items-center justify-center gap-1.5 border border-gray-200 text-gray-500 rounded-xl px-4 py-2 text-xs font-semibold hover:bg-gray-50 transition">
              <PdfIcon /> Download PDF
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Weekly Bill Card ─────────────────────────────────────────────────────────

function WeeklyBillCard({ customer, weeks, undoKeys, onMarkPaid, onUndo, onForceUnpaid, onHistory }) {
  const [showHistory, setShowHistory] = useState(false)

  const unpaidWeeks = weeks.filter(w => !w.paid)
  const paidWeeks   = weeks.filter(w => w.paid)
  const balanceDue  = unpaidWeeks.reduce((s, w) => s + w.billData.total, 0)
  const unpaidCount = unpaidWeeks.filter(w => w.billData.total > 0).length

  return (
    <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-black flex-shrink-0 flex items-center justify-center">
          <span className="text-white text-sm font-bold uppercase">{customer.name?.charAt(0) ?? '?'}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">{customer.name}</p>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700">WEEKLY</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {unpaidCount > 0 ? `${unpaidCount} week${unpaidCount !== 1 ? 's' : ''} unpaid` : 'All weeks paid'}
          </p>
          {customer.billingStartDate && (
            <p className="text-[10px] text-blue-500 mt-0.5">Billing from: {formatBillingDate(customer.billingStartDate)}</p>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-base font-bold text-gray-900">₹{balanceDue}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">balance due</p>
        </div>
      </div>

      {/* Active (unpaid) weeks */}
      {unpaidWeeks.length > 0 && (
        <div className="space-y-2 border-t border-gray-100 pt-3">
          {unpaidWeeks.map(week => (
            <WeekRow
              key={week.num}
              week={week}
              hasUndo={undoKeys.has(week.docId)}
              onMarkPaid={() => onMarkPaid(week)}
              onUndo={() => onUndo(week)}
              onForceUnpaid={() => onForceUnpaid(week)}
            />
          ))}
        </div>
      )}

      {/* Paid weeks history */}
      {paidWeeks.length > 0 && (
        <div className={`border-t border-gray-100 pt-2 mt-2`}>
          <button
            onClick={() => setShowHistory(v => !v)}
            className="w-full flex items-center justify-between text-xs text-gray-400 hover:text-gray-600 py-1 transition"
          >
            <span>
              {paidWeeks.length} week{paidWeeks.length !== 1 ? 's' : ''} paid ·{' '}
              ₹{paidWeeks.reduce((s, w) => s + w.billData.total, 0)}
            </span>
            <span className="font-semibold">{showHistory ? '▲ Hide' : '▼ History'}</span>
          </button>
          {showHistory && (
            <div className="mt-1.5 space-y-1.5">
              {paidWeeks.map(week => (
                <div key={week.num}
                  className="bg-green-50 rounded-xl px-3 py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-green-800">{week.label}</p>
                    {week.paidAt && (
                      <p className="text-[10px] text-green-600 mt-0.5">
                        Paid {new Date(week.paidAt).toLocaleDateString('en-GB')} ✓
                      </p>
                    )}
                  </div>
                  <p className="text-xs font-bold text-green-700">₹{week.paidAmount ?? week.billData.total}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* All paid — link to full history */}
      {unpaidWeeks.length === 0 && paidWeeks.length > 0 && !showHistory && (
        <div className="mt-1 text-center">
          <button onClick={onHistory} className="text-xs text-gray-400 hover:text-gray-600">
            View full payment history
          </button>
        </div>
      )}
    </div>
  )
}

function WeekRow({ week, hasUndo, onMarkPaid, onUndo, onForceUnpaid }) {
  const longPressTimer = useRef(null)

  function startLongPress() {
    if (!week.paid) return
    longPressTimer.current = setTimeout(() => onForceUnpaid(), 600)
  }
  function cancelLongPress() { clearTimeout(longPressTimer.current) }

  return (
    <div className={`rounded-xl px-3 py-2.5 select-none ${week.paid ? 'bg-gray-50' : 'bg-white border border-gray-200'}`}
      onMouseDown={startLongPress} onMouseUp={cancelLongPress} onMouseLeave={cancelLongPress}
      onTouchStart={startLongPress} onTouchEnd={cancelLongPress}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-700">{week.label}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {week.billData.lunchDays > 0 ? `${week.billData.lunchDays}L ` : ''}
            {week.billData.dinnerDays > 0 ? `${week.billData.dinnerDays}D` : ''}
            {week.billData.lunchDays === 0 && week.billData.dinnerDays === 0 ? 'No meals' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-gray-900">₹{week.billData.total}</p>
          {week.paid ? (
            <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-md">PAID</span>
          ) : week.billData.total > 0 ? (
            <button onClick={onMarkPaid}
              className="text-[11px] font-bold bg-black text-white rounded-lg px-2.5 py-1 hover:bg-gray-800 transition">
              Mark Paid
            </button>
          ) : null}
        </div>
      </div>
      {hasUndo && (
        <div className="mt-1.5 flex items-center justify-between bg-green-50 rounded-lg px-2 py-1.5">
          <p className="text-[11px] font-semibold text-green-700">Marked as paid ✓</p>
          <button onClick={onUndo} className="text-[11px] font-bold text-green-700 underline">Undo</button>
        </div>
      )}
    </div>
  )
}

// ─── Flexible Bill Card ───────────────────────────────────────────────────────

function FlexibleBillCard({ customer, billData, payments, onAddPayment, onHistory }) {
  const { lunchDays, dinnerDays, extraAmount, total } = billData
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0)
  const balance = total - totalPaid

  const summaryParts = []
  if (lunchDays) summaryParts.push(`${lunchDays}L`)
  if (dinnerDays) summaryParts.push(`${dinnerDays}D`)
  if (extraAmount) summaryParts.push(`₹${extraAmount} extra`)

  return (
    <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-black flex-shrink-0 flex items-center justify-center">
          <span className="text-white text-sm font-bold uppercase">{customer.name?.charAt(0) ?? '?'}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">{customer.name}</p>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700">FLEXIBLE</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {summaryParts.length ? summaryParts.join(' · ') : 'No meals this month'}
          </p>
          {customer.billingStartDate && (
            <p className="text-[10px] text-blue-500 mt-0.5">Billing from: {formatBillingDate(customer.billingStartDate)}</p>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <button onClick={onHistory} className="text-[11px] text-gray-400 hover:text-gray-600">History</button>
        </div>
      </div>

      {/* Balance summary */}
      <div className="bg-gray-50 rounded-xl px-3 py-3 mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <div>
            <p className="text-xs text-gray-500">Attendance Total</p>
            {(lunchDays > 0 || dinnerDays > 0) && (
              <p className="text-[10px] text-gray-400 mt-0.5">
                {lunchDays > 0 ? `${lunchDays}L` : ''}{lunchDays > 0 && dinnerDays > 0 ? ' · ' : ''}{dinnerDays > 0 ? `${dinnerDays}D` : ''}
                {extraAmount > 0 ? ` · ₹${extraAmount} extra` : ''}
              </p>
            )}
          </div>
          <p className="text-sm font-bold text-gray-900">₹{total}</p>
        </div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-gray-500">Total Paid ({payments.length} payment{payments.length !== 1 ? 's' : ''})</p>
          <p className="text-sm font-semibold text-green-600">−₹{totalPaid}</p>
        </div>
        <div className="border-t border-gray-200 pt-2 flex items-center justify-between">
          <p className="text-xs font-bold text-gray-700">Balance Due</p>
          <p className={`text-sm font-bold ${balance > 0 ? 'text-red-500' : 'text-green-600'}`}>
            {balance > 0 ? `₹${balance}` : 'Paid in full ✓'}
          </p>
        </div>
      </div>

      {/* Recent payments */}
      {payments.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Recent Payments</p>
          <div className="space-y-1">
            {payments.slice(0, 3).map(p => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-500">{p.date}{p.note ? ` · ${p.note}` : ''}</span>
                <span className="font-semibold text-green-600">₹{p.amount}</span>
              </div>
            ))}
            {payments.length > 3 && (
              <button onClick={onHistory} className="text-xs text-gray-400 hover:text-gray-600 mt-0.5">
                +{payments.length - 3} more — view history
              </button>
            )}
          </div>
        </div>
      )}

      <button onClick={onAddPayment}
        className="w-full flex items-center justify-center gap-1.5 bg-black text-white rounded-xl py-2.5 text-xs font-semibold hover:bg-gray-900 active:bg-gray-800 transition">
        <PlusIcon /> Record Payment
      </button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OwnerBills() {
  const navigate = useNavigate()
  const now = new Date()

  const [year, setYear]           = useState(now.getFullYear())
  const [month, setMonth]         = useState(now.getMonth() + 1)
  const [showPicker, setShowPicker] = useState(false)

  const [billRows, setBillRows]   = useState([])
  const [loading, setLoading]     = useState(true)

  const [confirmModal, setConfirmModal] = useState(null) // { title, message, confirmLabel?, onConfirm }
  const [historySheet, setHistorySheet] = useState(null) // { customer, paymentType }
  const [paymentModal, setPaymentModal] = useState(null) // { customer }

  // undo: set of docIds with active 60s undo window
  const [undoKeys, setUndoKeys]   = useState(new Set())
  const undoTimers = useRef({})
  const undoCallbacks = useRef({})

  function startUndo(docId, onUndo) {
    clearTimeout(undoTimers.current[docId])
    undoCallbacks.current[docId] = onUndo
    setUndoKeys(prev => new Set([...prev, docId]))
    undoTimers.current[docId] = setTimeout(() => {
      setUndoKeys(prev => { const s = new Set(prev); s.delete(docId); return s })
      delete undoTimers.current[docId]
      delete undoCallbacks.current[docId]
    }, 60000)
  }

  function triggerUndo(docId) {
    clearTimeout(undoTimers.current[docId])
    setUndoKeys(prev => { const s = new Set(prev); s.delete(docId); return s })
    const cb = undoCallbacks.current[docId]
    delete undoTimers.current[docId]
    delete undoCallbacks.current[docId]
    if (cb) cb()
  }

  // ── fetch ──────────────────────────────────────────────────────────────────
  const fetchBills = useCallback(async () => {
    setLoading(true)
    try {
      const cSnap = await getDocs(query(collection(db, 'customers'), where('active', '==', true)))
      const customers = cSnap.docs.map((d, i) => ({ id: d.id, invoiceIndex: i + 1, ...d.data() }))

      const { start, end } = getMonthBounds(year, month)
      const aSnap = await getDocs(
        query(collection(db, 'attendance'), where('date', '>=', start), where('date', '<=', end))
      )
      const aMap = {}
      aSnap.docs.forEach(d => {
        const data = d.data()
        if (!aMap[data.customerId]) aMap[data.customerId] = []
        aMap[data.customerId].push(data)
      })

      const mk = mKey(year, month)
      const weeks = getWeeks(year, month)

      const rows = await Promise.all(customers.map(async customer => {
        const paymentType = customer.paymentType ?? 'monthly'
        const billingStart = customer.billingStartDate ?? null
        const customerDocs = (aMap[customer.id] ?? []).filter(rec =>
          !billingStart || rec.date >= billingStart
        )

        if (paymentType === 'weekly') {
          const weekData = await Promise.all(weeks.map(async week => {
            const docId = `${customer.id}_${mk}_w${week.num}`
            const snap = await getDoc(doc(db, 'bills', docId))
            const snapData = snap.exists() ? snap.data() : {}
            return {
              ...week,
              label: weekLabel(week, month),
              billData: calcBill(customer, filterWeekDocs(customerDocs, week)),
              paid: snapData.paid ?? false,
              paidAt: snapData.paidAt ?? null,
              paidAmount: snapData.amount ?? null,
              docId,
            }
          }))
          return { customer, paymentType, weeks: weekData }
        }

        if (paymentType === 'flexible') {
          const billData = calcBill(customer, customerDocs)
          const pSnap = await getDocs(
            query(collection(db, 'payments'), where('customerId', '==', customer.id))
          )
          const payments = pSnap.docs.map(d => ({ id: d.id, ...d.data() }))
            .filter(p => p.type === 'flexible' || !p.type)
            .sort((a, b) => (b.date ?? b.paidAt ?? '').localeCompare(a.date ?? a.paidAt ?? ''))
          return { customer, paymentType, billData, payments }
        }

        // monthly (default)
        const docId = `${customer.id}_${mk}`
        const snap = await getDoc(doc(db, 'bills', docId))
        const billData = calcBill(customer, customerDocs)
        return { customer, paymentType, billData, paid: snap.exists() ? (snap.data().paid ?? false) : false, docId }
      }))

      rows.sort((a, b) => {
        const aTotal = a.paymentType === 'weekly' ? a.weeks.reduce((s, w) => s + w.billData.total, 0) : (a.billData?.total ?? 0)
        const bTotal = b.paymentType === 'weekly' ? b.weeks.reduce((s, w) => s + w.billData.total, 0) : (b.billData?.total ?? 0)
        const aUnpaid = a.paymentType === 'monthly' ? !a.paid && aTotal > 0
          : a.paymentType === 'weekly' ? a.weeks.some(w => !w.paid && w.billData.total > 0)
          : (aTotal - (a.payments?.reduce((s, p) => s + p.amount, 0) ?? 0)) > 0
        const bUnpaid = b.paymentType === 'monthly' ? !b.paid && bTotal > 0
          : b.paymentType === 'weekly' ? b.weeks.some(w => !w.paid && w.billData.total > 0)
          : (bTotal - (b.payments?.reduce((s, p) => s + p.amount, 0) ?? 0)) > 0
        if (aUnpaid !== bUnpaid) return aUnpaid ? -1 : 1
        return bTotal - aTotal
      })

      setBillRows(rows)
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { fetchBills() }, [fetchBills])

  // ── mark paid: monthly ────────────────────────────────────────────────────
  function handleMarkPaidMonthly(row) {
    setConfirmModal({
      title: 'Confirm Payment',
      message: `Mark ₹${row.billData.total} as paid for ${row.customer.name}?`,
      onConfirm: async () => {
        setConfirmModal(null)
        const paidAt = new Date().toISOString()
        const newBillingStart = getTomorrowDate()
        await setDoc(doc(db, 'bills', row.docId), {
          customerId: row.customer.id, year, month, paid: true, paidAt,
        })
        const payRef = await addDoc(collection(db, 'payments'), {
          customerId: row.customer.id,
          type: 'monthly',
          amount: row.billData.total,
          lunchDays: row.billData.lunchDays ?? 0,
          dinnerDays: row.billData.dinnerDays ?? 0,
          extraAmount: row.billData.extraAmount ?? 0,
          year,
          month,
          paidAt,
        })
        await updateDoc(doc(db, 'customers', row.customer.id), { billingStartDate: newBillingStart })
        // reload so new billing cycle (from billingStartDate) shows immediately
        await fetchBills()
        startUndo(row.docId, async () => {
          await deleteDoc(doc(db, 'payments', payRef.id))
          await setDoc(doc(db, 'bills', row.docId), { customerId: row.customer.id, year, month, paid: false })
          await updateDoc(doc(db, 'customers', row.customer.id), { billingStartDate: null })
          await fetchBills()
        })
      },
    })
  }

  async function handleForceUnpaidMonthly(row) {
    setConfirmModal({
      title: 'Mark as Unpaid?',
      message: `Reverse payment for ${row.customer.name}?`,
      confirmLabel: 'Yes, mark unpaid',
      onConfirm: async () => {
        setConfirmModal(null)
        // Find and delete matching payment records for this month
        const pSnap = await getDocs(query(collection(db, 'payments'), where('customerId', '==', row.customer.id)))
        const toDelete = pSnap.docs.filter(d => {
          const p = d.data()
          return p.type === 'monthly' && p.year === year && p.month === month
        })
        await Promise.all(toDelete.map(d => deleteDoc(doc(db, 'payments', d.id))))
        await setDoc(doc(db, 'bills', row.docId), { customerId: row.customer.id, year, month, paid: false })
        await updateDoc(doc(db, 'customers', row.customer.id), { billingStartDate: null })
        await fetchBills()
      },
    })
  }

  // ── mark paid: weekly ─────────────────────────────────────────────────────
  function handleMarkPaidWeek(customer, week) {
    setConfirmModal({
      title: 'Confirm Payment',
      message: `Mark ₹${week.billData.total} as paid for ${customer.name} (${week.label})?`,
      onConfirm: async () => {
        setConfirmModal(null)
        const paidAt = new Date().toISOString()
        const newBillingStart = getTomorrowDate()
        const wLabel = `Week ${week.num} - ${MONTH_NAMES[month - 1].slice(0, 3)} ${year}`
        const startDate = `${year}-${pad(month)}-${pad(week.start)}`
        const endDate   = `${year}-${pad(month)}-${pad(week.end)}`
        await setDoc(doc(db, 'bills', week.docId), {
          customerId: customer.id, year, month, weekNum: week.num, paid: true, paidAt,
          amount: week.billData.total,
        })
        const payRef = await addDoc(collection(db, 'payments'), {
          customerId: customer.id,
          type: 'weekly',
          weekNum: week.num,
          weekLabel: wLabel,
          startDate,
          endDate,
          amount: week.billData.total,
          lunchDays: week.billData.lunchDays ?? 0,
          dinnerDays: week.billData.dinnerDays ?? 0,
          extraAmount: week.billData.extraAmount ?? 0,
          year,
          month,
          paidAt,
        })
        await updateDoc(doc(db, 'customers', customer.id), { billingStartDate: newBillingStart })
        // reload so new billing cycle (from billingStartDate) shows immediately
        await fetchBills()
        startUndo(week.docId, async () => {
          await deleteDoc(doc(db, 'payments', payRef.id))
          await setDoc(doc(db, 'bills', week.docId), {
            customerId: customer.id, year, month, weekNum: week.num, paid: false,
          })
          await updateDoc(doc(db, 'customers', customer.id), { billingStartDate: null })
          await fetchBills()
        })
      },
    })
  }

  async function handleForceUnpaidWeek(customer, week) {
    setConfirmModal({
      title: 'Mark as Unpaid?',
      message: `Reverse payment for ${customer.name} — ${week.label}?`,
      confirmLabel: 'Yes, mark unpaid',
      onConfirm: async () => {
        setConfirmModal(null)
        // Find and delete matching payment records for this week
        const pSnap = await getDocs(query(collection(db, 'payments'), where('customerId', '==', customer.id)))
        const toDelete = pSnap.docs.filter(d => {
          const p = d.data()
          return p.type === 'weekly' && p.year === year && p.month === month && p.weekNum === week.num
        })
        await Promise.all(toDelete.map(d => deleteDoc(doc(db, 'payments', d.id))))
        await setDoc(doc(db, 'bills', week.docId), {
          customerId: customer.id, year, month, weekNum: week.num, paid: false,
        })
        await updateDoc(doc(db, 'customers', customer.id), { billingStartDate: null })
        await fetchBills()
      },
    })
  }

  // ── record payment: flexible ───────────────────────────────────────────────
  async function handleAddPayment(customer, { amount, date, note }) {
    const paidAt = new Date().toISOString()
    await addDoc(collection(db, 'payments'), {
      customerId: customer.id,
      type: 'flexible',
      amount,
      date,
      note,
      paidAt,
      createdAt: paidAt,
    })
    setPaymentModal(null)
    await fetchBills()
  }

  // ── PDF / WhatsApp ─────────────────────────────────────────────────────────
  function handlePDF(customer, billData) {
    generateBillPDF(customer, billData, year, month)
  }

  function handleWhatsApp(customer, billData) {
    generateBillPDF(customer, billData, year, month)
    const text = encodeURIComponent(
      `Dear ${customer.name},\nYour Home Made Food bill for ${MONTH_NAMES[month - 1]} ${year} is \u20b9${billData.total}.\nPlease find your bill attached. Thank you!`
    )
    const phone = (customer.phone ?? '').replace(/\D/g, '')
    window.open(`https://wa.me/91${phone}?text=${text}`, '_blank')
  }

  // ── nav ────────────────────────────────────────────────────────────────────
  function prevMonth() { if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1) }

  // ── stats ──────────────────────────────────────────────────────────────────
  const grandTotal = billRows.reduce((s, r) => {
    if (r.paymentType === 'weekly') return s + r.weeks.reduce((ws, w) => ws + w.billData.total, 0)
    return s + (r.billData?.total ?? 0)
  }, 0)

  const unpaidCount = billRows.filter(r => {
    if (r.paymentType === 'monthly') return !r.paid && (r.billData?.total ?? 0) > 0
    if (r.paymentType === 'weekly') return r.weeks.some(w => !w.paid && w.billData.total > 0)
    const totalPaid = r.payments.reduce((s, p) => s + p.amount, 0)
    return (r.billData?.total ?? 0) > totalPaid
  }).length

  const daysInMonth = new Date(year, month, 0).getDate()
  const daysDone = Math.min(now.getDate(), daysInMonth)
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
              <h1 className="text-white text-lg font-bold leading-tight m-0">Bills</h1>
              <p className="text-gray-400 text-xs mt-0.5">{monthLabel}</p>
            </div>
          </div>
          <button onClick={() => setShowPicker(true)} className="text-white p-2 -mr-1 rounded-xl active:bg-white/10 transition">
            <CalendarIcon />
          </button>
        </div>
      </header>

      {/* ── Summary card ── */}
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
              <p className="text-xs text-gray-400">{unpaidCount} pending payment{unpaidCount !== 1 ? 's' : ''}</p>
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
          billRows.map(row => {
            if (row.paymentType === 'weekly') {
              return (
                <WeeklyBillCard
                  key={row.customer.id}
                  customer={row.customer}
                  weeks={row.weeks}
                  undoKeys={undoKeys}
                  onMarkPaid={(week) => handleMarkPaidWeek(row.customer, week)}
                  onUndo={(week) => triggerUndo(week.docId)}
                  onForceUnpaid={(week) => handleForceUnpaidWeek(row.customer, week)}
                  onHistory={() => setHistorySheet({ customer: row.customer, paymentType: 'weekly' })}
                />
              )
            }
            if (row.paymentType === 'flexible') {
              return (
                <FlexibleBillCard
                  key={row.customer.id}
                  customer={row.customer}
                  billData={row.billData}
                  payments={row.payments}
                  onAddPayment={() => setPaymentModal({ customer: row.customer })}
                  onHistory={() => setHistorySheet({ customer: row.customer, paymentType: 'flexible' })}
                />
              )
            }
            return (
              <MonthlyBillCard
                key={row.customer.id}
                customer={row.customer}
                billData={row.billData}
                paid={row.paid}
                undoActive={undoKeys.has(row.docId)}
                onMarkPaid={() => handleMarkPaidMonthly(row)}
                onUndo={() => triggerUndo(row.docId)}
                onForceUnpaid={() => handleForceUnpaidMonthly(row)}
                onPDF={() => handlePDF(row.customer, row.billData)}
                onWhatsApp={() => handleWhatsApp(row.customer, row.billData)}
                onHistory={() => setHistorySheet({ customer: row.customer, paymentType: 'monthly' })}
              />
            )
          })
        )}
      </main>

      {/* ── Bottom Nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-100 flex">
        <NavTab label="Attendance" icon={<HomeIcon />} onClick={() => navigate('/owner/dashboard')} />
        <NavTab label="Customers" icon={<UsersIcon />} onClick={() => navigate('/owner/customers')} />
        <NavTab label="Bills" icon={<ReceiptIcon />} active onClick={() => {}} />
      </nav>

      {/* ── Modals ── */}
      {showPicker && (
        <MonthPicker year={year} month={month}
          onChange={(y, m) => { setYear(y); setMonth(m) }}
          onClose={() => setShowPicker(false)} />
      )}
      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
      {historySheet && (
        <HistorySheet
          customer={historySheet.customer}
          paymentType={historySheet.paymentType}
          onClose={() => setHistorySheet(null)}
        />
      )}
      {paymentModal && (
        <PaymentModal
          customer={paymentModal.customer}
          onSave={(data) => handleAddPayment(paymentModal.customer, data)}
          onClose={() => setPaymentModal(null)}
        />
      )}
    </div>
  )
}

function NavTab({ label, icon, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
        active ? 'text-black' : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      {icon}
      <span className={`text-[10px] font-semibold ${active ? 'text-black' : 'text-gray-400'}`}>{label}</span>
    </button>
  )
}
