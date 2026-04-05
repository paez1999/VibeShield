import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore.js'
import AuthPage from './pages/AuthPage.jsx'
import DashboardLayout from './components/layout/DashboardLayout.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import VulnsPage from './pages/VulnsPage.jsx'
import EndpointsPage from './pages/EndpointsPage.jsx'
import { CodeScanPage, ApiScanPage, DepsScanPage } from './pages/ScanPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'

function RequireAuth({ children }) {
  const { user, loading } = useAuthStore()
  if (loading) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)', fontFamily:'var(--mono)', fontSize:12, gap:10 }}>
      <span style={{ width:14, height:14, border:'2px solid var(--border2)', borderTop:'2px solid var(--red)', borderRadius:'50%', animation:'spin .7s linear infinite', display:'inline-block' }} />
      Loading…
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
  const init = useAuthStore(s => s.init)
  useEffect(() => { const unsub = init(); return unsub }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RequireGuest><AuthPage /></RequireGuest>} />
        <Route path="/dashboard" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
          <Route index                  element={<DashboardPage />} />
          <Route path="vulns"           element={<VulnsPage />} />
          <Route path="endpoints"       element={<EndpointsPage />} />
          <Route path="scan/code"       element={<CodeScanPage />} />
          <Route path="scan/api"        element={<ApiScanPage />} />
          <Route path="scan/deps"       element={<DepsScanPage />} />
          <Route path="settings"        element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
