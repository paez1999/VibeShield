import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore.js'
import AuthPage from './pages/AuthPage.jsx'
import DashboardLayout from './components/layout/DashboardLayout.jsx'
import OverviewPage from './pages/OverviewPage.jsx'
import IntegrationsPage from './pages/IntegrationsPage.jsx'
import { BreachesPage, ModerationPage, AuditPage, SettingsPage } from './pages/PlaceholderPages.jsx'

function RequireAuth({ children }) {
  const { user, loading } = useAuthStore()
  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
      Loading...
    </div>
  )
  if (!user) return <Navigate to="/" replace />
  return children
}

function RequireGuest({ children }) {
  const { user, loading } = useAuthStore()
  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  const init = useAuthStore((s) => s.init)

  // Subscribe to Firebase auth state once on mount
  useEffect(() => {
    const unsubscribe = init()
    return unsubscribe
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RequireGuest><AuthPage /></RequireGuest>} />
        <Route path="/dashboard" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
          <Route index                element={<OverviewPage />} />
          <Route path="integrations"  element={<IntegrationsPage />} />
          <Route path="breaches"      element={<BreachesPage />} />
          <Route path="moderation"    element={<ModerationPage />} />
          <Route path="audit"         element={<AuditPage />} />
          <Route path="settings"      element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
