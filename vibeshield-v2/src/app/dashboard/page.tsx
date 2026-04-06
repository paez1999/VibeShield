import { PageHeader } from '@/components/layout/page-header'

export default function DashboardPage() {
  return (
    <div className="max-w-[1100px] animate-fadeIn">
      <PageHeader subtitle="SECURITY OVERVIEW" title="Dashboard" />
      <p className="text-muted text-xs">Loading dashboard...</p>
    </div>
  )
}
