import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore.js'
import AuthPage from './pages/AuthPage.jsx'
import DashboardLayout from './components/layout/DashboardLayout.jsx'
import OverviewPage from './pages/OverviewPage.jsx'
import IntegrationsPage from './pages/IntegrationsPage.jsx'
import { BreachesPage, ModerationPage, AuditPage, SettingsPage } from './pages/PlaceholderPages.jsx'

function RequireAuth({ children }) {
  const token = useAuthStore((s) => s.token)
  if (!token) return <Navigate to="/" replace />
  return children
}

function RequireGuest({ children }) {
  const token = useAuthStore((s) => s.token)
  if (token) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={
          <RequireGuest><AuthPage /></RequireGuest>
        } />

        {/* Protected dashboard */}
        <Route path="/dashboard" element={
          <RequireAuth><DashboardLayout /></RequireAuth>
        }>
          <Route index                element={<OverviewPage />} />
          <Route path="integrations"  element={<IntegrationsPage />} />
          <Route path="breaches"      element={<BreachesPage />} />
          <Route path="moderation"    element={<ModerationPage />} />
          <Route path="audit"         element={<AuditPage />} />
          <Route path="settings"      element={<SettingsPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
