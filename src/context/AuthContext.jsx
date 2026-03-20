import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [role, setRole] = useState(null)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Reset to loading on every auth state change so ProtectedRoute
      // never acts on stale role/user data during the Firestore fetch.
      setLoading(true)

      if (user) {
        try {
          const docSnap = await getDoc(doc(db, 'users', user.uid))
          if (docSnap.exists()) {
            const data = docSnap.data()
            setRole(data.role)
            setUserData(data)
          } else {
            setRole(null)
            setUserData(null)
          }
        } catch {
          setRole(null)
          setUserData(null)
        }
        setCurrentUser(user)
      } else {
        setCurrentUser(null)
        setRole(null)
        setUserData(null)
      }

      setLoading(false)
    })

    return unsubscribe
  }, [])

  const value = { currentUser, role, userData, loading }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
