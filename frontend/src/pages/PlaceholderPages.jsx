import { Panel } from '../components/ui/index.jsx'

function ComingSoon({ module, description }) {
  return (
    <div style={{ maxWidth: '1100px', animation: 'fadeIn .3s ease' }}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '2px', marginBottom: '4px' }}>
          COMING SOON
        </div>
        <h1 style={{ fontFamily: 'var(--font-disp)', fontWeight: 800, fontSize: '24px', color: '#fff' }}>
          {module}
        </h1>
      </div>
      <Panel>
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '10px',
            background: 'var(--surface2)', border: '1px solid var(--border2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: '20px',
          }}>
            🔒
          </div>
          <div style={{ fontFamily: 'var(--font-disp)', fontSize: '16px', color: '#fff', fontWeight: 600, marginBottom: '8px' }}>
            {module} — Phase 2
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '13px', maxWidth: '400px', margin: '0 auto', lineHeight: 1.7 }}>
            {description}
          </div>
          <div style={{
            marginTop: '24px', display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '8px 16px', background: 'rgba(0,212,170,.08)',
            border: '1px solid rgba(0,212,170,.2)', borderRadius: 'var(--radius)',
            color: 'var(--accent)', fontSize: '12px',
          }}>
            Currently building Integration Auditor → Credential Monitor is next
          </div>
        </div>
      </Panel>
    </div>
  )
}

export function BreachesPage() {
  return (
    <ComingSoon
      module="Credential Monitor"
      description="Batch-query Have I Been Pwned, detect credential stuffing attacks, force password resets, and trigger MFA enrollment for compromised users."
    />
  )
}

export function ModerationPage() {
  return (
    <ComingSoon
      module="Content Moderation"
      description="AI-powered toxicity detection via Hugging Face, NCII flagging, real-time moderation queue with approve / reject / escalate actions."
    />
  )
}

export function AuditPage() {
  return (
    <ComingSoon
      module="Audit Log"
      description="Full audit trail of all actions taken by your team — scans, rotations, remediations, and moderation decisions with timestamps and IP addresses."
    />
  )
}

export function SettingsPage() {
  return (
    <ComingSoon
      module="Settings"
      description="Configure alert webhooks, Slack notifications, weekly digest emails, and manage API keys for your organization."
    />
  )
}
