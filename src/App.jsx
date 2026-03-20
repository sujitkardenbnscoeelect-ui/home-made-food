import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

import Login from './pages/Login'
import OwnerDashboard from './pages/owner/OwnerDashboard'
import OwnerCustomers from './pages/owner/OwnerCustomers'
import OwnerBills from './pages/owner/OwnerBills'
import CustomerAttendance from './pages/customer/CustomerAttendance'
import CustomerBill from './pages/customer/CustomerBill'

function ProtectedRoute({ children, allowedRole }) {
  const { currentUser, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  if (allowedRole && role !== allowedRole) {
    return <Navigate to={role === 'owner' ? '/owner/dashboard' : '/customer/attendance'} replace />
  }

  return children
}

export default function App() {
  const { currentUser, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/owner/dashboard"
        element={
          <ProtectedRoute allowedRole="owner">
            <OwnerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner/customers"
        element={
          <ProtectedRoute allowedRole="owner">
            <OwnerCustomers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner/bills"
        element={
          <ProtectedRoute allowedRole="owner">
            <OwnerBills />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/attendance"
        element={
          <ProtectedRoute allowedRole="customer">
            <CustomerAttendance />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/bill"
        element={
          <ProtectedRoute allowedRole="customer">
            <CustomerBill />
          </ProtectedRoute>
        }
      />

      <Route
        path="/"
        element={
          currentUser
            ? <Navigate to={role === 'owner' ? '/owner/dashboard' : '/customer/attendance'} replace />
            : <Navigate to="/login" replace />
        }
      />
      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  )
}
