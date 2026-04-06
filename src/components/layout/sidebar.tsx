'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/use-auth'

interface NavItem { to: string; label: string; badge?: number }

const SCANNERS: NavItem[] = [
  { to: '/dashboard/scan/code', label: 'Code scan' },
  { to: '/dashboard/scan/api', label: 'API scan' },
  { to: '/dashboard/scan/deps', label: 'Dependencies' },
]
const CONFIG: NavItem[] = [
  { to: '/dashboard/billing', label: 'Billing' },
  { to: '/dashboard/settings', label: 'Settings' },
]

function NavSection({ label, items }: { label: string; items: NavItem[] }) {
  const pathname = usePathname()
  return (
    <div className="pt-3">
      <div className="px-3.5 pb-2 text-[10px] text-muted tracking-[2px]">{label}</div>
      {items.map(({ to, label, badge }) => {
        const isActive = to === '/dashboard' ? pathname === to : pathname.startsWith(to)
        return (
          <Link
            key={to}
            href={to}
            className={`flex items-center gap-2 px-3.5 py-2 text-[11px] tracking-wide transition-all border-l-2 ${
              isActive
                ? 'text-white bg-red/[.07] border-red'
                : 'text-muted border-transparent hover:text-text'
            }`}
          >
            {label}
            {badge && badge > 0 && (
              <span className="ml-auto bg-red/20 text-red text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}

export function Sidebar() {
  const { user, signOut } = useAuth()
  const [vulnCount, setVulnCount] = useState(0)

  useEffect(() => {
    fetch('/api/vulns/summary', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setVulnCount((data.critical || 0) + (data.high || 0) + (data.medium || 0) + (data.low || 0))
      })
      .catch(() => {})
  }, [])

  const navItems: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/dashboard/vulns', label: 'Vulnerabilities', badge: vulnCount || undefined },
    { to: '/dashboard/history', label: 'Scan history' },
  ]

  return (
    <aside className="w-[200px] bg-surface border-r border-border flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-border flex items-center gap-2.5">
        <div className="w-7 h-7 bg-red rounded-md flex items-center justify-center shrink-0">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1L13 4V9C13 12 10.5 14.5 8 15C5.5 14.5 3 12 3 9V4L8 1Z" stroke="#fff" strokeWidth="1.2" fill="none"/>
            <path d="M5.5 8L7 9.5L10.5 6" stroke="#fff" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </div>
        <span className="font-display font-extrabold text-base text-white">VibeShield</span>
      </div>

      <NavSection label="OVERVIEW" items={navItems} />
      <div className="h-px bg-border my-2" />
      <NavSection label="SCANNERS" items={SCANNERS} />
      <div className="h-px bg-border my-2" />
      <NavSection label="CONFIG" items={CONFIG} />

      {/* Bottom: user + logout */}
      <div className="mt-auto border-t border-border p-3">
        <div className="bg-surface2 border border-border2 rounded-sm p-2 mb-2">
          <div className="text-[11px] text-white font-medium truncate">
            {user?.email?.split('@')[0] || 'User'}
          </div>
          <div className="text-[10px] text-muted mt-0.5 truncate">{user?.email || ''}</div>
        </div>
        <button
          onClick={signOut}
          className="w-full bg-transparent border border-border rounded-sm text-muted text-[11px] py-1.5 hover:border-red hover:text-red transition-all"
        >
          Logout
        </button>
      </div>
    </aside>
  )
}
