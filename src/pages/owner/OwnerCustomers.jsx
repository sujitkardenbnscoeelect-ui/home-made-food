import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  setDoc,
  orderBy,
  query,
} from 'firebase/firestore'
import {
  createUserWithEmailAndPassword,
} from 'firebase/auth'
import { db, auth } from '../../lib/firebase'

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

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: '',
  phone: '',
  email: '',
  lunchRate: '',
  dinnerRate: '',
}

function RatePill({ label, value }) {
  return (
    <span className="inline-flex items-center text-[11px] font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
      {label} ₹{value}
    </span>
  )
}


// ─── Customer Form Modal ──────────────────────────────────────────────────────

function CustomerModal({ mode, initial, onSave, onClose }) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM)
  const [active, setActive] = useState(initial?.active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(field) {
    return (e) => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required.'); return }
    if (!form.email.trim()) { setError('Email is required.'); return }
    if (!form.lunchRate || !form.dinnerRate) { setError('Both rates are required.'); return }
    setError('')
    setSaving(true)
    try {
      await onSave({ ...form, active })
    } catch (err) {
      setError(err.message ?? 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const isEdit = mode === 'edit'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle + header */}
        <div className="flex-shrink-0 px-5 pt-4 pb-3 border-b border-gray-100">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900 m-0">
              {isEdit ? 'Edit Customer' : 'Add Customer'}
            </h2>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
              <XIcon />
            </button>
          </div>
        </div>

        {/* Scrollable fields */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <Field label="Full Name" required>
            <input
              type="text"
              placeholder="e.g. Ramesh Sharma"
              value={form.name}
              onChange={set('name')}
              className={inputCls}
            />
          </Field>

          <Field label="Phone Number">
            <input
              type="tel"
              placeholder="e.g. 9876543210"
              value={form.phone}
              onChange={set('phone')}
              className={inputCls}
            />
          </Field>

          <Field label="Email" required>
            <input
              type="email"
              placeholder="e.g. ramesh@gmail.com"
              value={form.email}
              onChange={set('email')}
              disabled={isEdit}
              className={`${inputCls} ${isEdit ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}`}
            />
            {isEdit && (
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed after creation.</p>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Lunch Rate" required>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">₹</span>
                <input
                  type="number"
                  placeholder="70"
                  value={form.lunchRate}
                  onChange={set('lunchRate')}
                  className={`${inputCls} pl-7`}
                />
              </div>
            </Field>
            <Field label="Dinner Rate" required>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">₹</span>
                <input
                  type="number"
                  placeholder="80"
                  value={form.dinnerRate}
                  onChange={set('dinnerRate')}
                  className={`${inputCls} pl-7`}
                />
              </div>
            </Field>
          </div>

          {/* Active toggle — only in edit mode */}
          {isEdit && (
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium text-gray-900">Active Member</p>
                <p className="text-xs text-gray-400">Inactive members are hidden from attendance</p>
              </div>
              <button
                type="button"
                onClick={() => setActive(v => !v)}
                className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${active ? 'bg-black' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${active ? 'left-[26px]' : 'left-0.5'}`} />
              </button>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-5 pb-8 pt-3 border-t border-gray-100">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-black text-white rounded-xl py-3.5 text-sm font-semibold hover:bg-gray-900 active:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (isEdit ? 'Saving…' : 'Creating account…') : (isEdit ? 'Save Changes' : 'Add Customer')}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputCls =
  'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition'

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

// ─── Customer Row ─────────────────────────────────────────────────────────────

function CustomerRow({ customer, onTap }) {
  return (
    <button
      onClick={onTap}
      className="w-full bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm border border-gray-100 text-left active:bg-gray-50 transition"
    >
      <div className="w-10 h-10 rounded-full bg-black flex-shrink-0 flex items-center justify-center">
        <span className="text-white text-sm font-bold uppercase">
          {customer.name?.charAt(0) ?? '?'}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{customer.name}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <RatePill label="Lunch" value={customer.lunchRate} />
          <RatePill label="Dinner" value={customer.dinnerRate} />
        </div>
      </div>

      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${customer.active ? 'bg-green-400' : 'bg-gray-300'}`} />
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OwnerCustomers() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // null | { mode: 'add' } | { mode: 'edit', customer }

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'customers'), orderBy('name')))
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  // ── filtered list ──────────────────────────────────────────────────────────
  const filtered = customers.filter(c => {
    const q = search.toLowerCase()
    return (
      c.name?.toLowerCase().includes(q) ||
      c.phone?.includes(q)
    )
  })

  const activeCount = customers.filter(c => c.active).length

  // ── add customer ───────────────────────────────────────────────────────────
  async function handleAdd(form) {
    // 1. Create Firebase Auth account
    const credential = await createUserWithEmailAndPassword(
      auth,
      form.email.trim(),
      'HMF@1234'
    )
    const uid = credential.user.uid

    // 2. Add to customers collection
    const customerRef = await addDoc(collection(db, 'customers'), {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      lunchRate: Number(form.lunchRate),
      dinnerRate: Number(form.dinnerRate),
      active: true,
      createdAt: new Date().toISOString(),
    })

    // 3. Add to users collection
    await setDoc(doc(db, 'users', uid), {
      uid,
      email: form.email.trim(),
      role: 'customer',
      customerId: customerRef.id,
    })

    setModal(null)
    await fetchCustomers()
  }

  // ── edit customer ──────────────────────────────────────────────────────────
  async function handleEdit(form) {
    const { id } = modal.customer
    await updateDoc(doc(db, 'customers', id), {
      name: form.name.trim(),
      phone: form.phone.trim(),
      lunchRate: Number(form.lunchRate),
      dinnerRate: Number(form.dinnerRate),
      active: form.active,
    })
    setModal(null)
    await fetchCustomers()
  }

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
              <h1 className="text-white text-lg font-bold leading-tight m-0">Customers</h1>
              <p className="text-gray-400 text-xs mt-0.5">
                {loading ? '—' : `${activeCount} active member${activeCount !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>

          <button
            onClick={() => setModal({ mode: 'add' })}
            className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-black text-xl font-bold hover:bg-gray-100 active:bg-gray-200 transition flex-shrink-0"
            aria-label="Add customer"
          >
            +
          </button>
        </div>
      </header>

      {/* ── Search bar ── */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex-shrink-0">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Search by name or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-9 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <XIcon />
            </button>
          )}
        </div>
      </div>

      {/* ── List ── */}
      <main className="flex-1 overflow-y-auto px-3 py-3 pb-24">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <div className="w-7 h-7 border-[3px] border-black border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Loading customers…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-center px-6">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-1">
              <UsersIcon />
            </div>
            {search ? (
              <>
                <p className="text-sm font-semibold text-gray-700">No results for "{search}"</p>
                <p className="text-xs text-gray-400">Try a different name or phone number</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-gray-700">No customers yet</p>
                <p className="text-xs text-gray-400">Tap the + button to add your first customer</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(customer => (
              <CustomerRow
                key={customer.id}
                customer={customer}
                onTap={() => setModal({ mode: 'edit', customer })}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Bottom Nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-100 flex">
        <NavTab label="Attendance" icon={<HomeIcon />} onClick={() => navigate('/owner/dashboard')} />
        <NavTab label="Customers" icon={<UsersIcon />} active onClick={() => {}} />
        <NavTab label="Bills" icon={<ReceiptIcon />} onClick={() => navigate('/owner/bills')} />
      </nav>

      {/* ── Modals ── */}
      {modal?.mode === 'add' && (
        <CustomerModal
          mode="add"
          onSave={handleAdd}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.mode === 'edit' && (
        <CustomerModal
          mode="edit"
          initial={{
            name: modal.customer.name ?? '',
            phone: modal.customer.phone ?? '',
            email: modal.customer.email ?? '',
            lunchRate: String(modal.customer.lunchRate ?? ''),
            dinnerRate: String(modal.customer.dinnerRate ?? ''),
            active: modal.customer.active ?? true,
          }}
          onSave={handleEdit}
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
