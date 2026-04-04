import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'

export default function DashboardLayout() {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{
        flex: 1,
        overflowY: 'auto',
        background: 'var(--bg)',
        padding: '24px',
      }}>
        <Outlet />
      </main>
    </div>
  )
}
