import { useEffect, useState } from 'react'
import { Panel } from '../components/ui/index.jsx'
import { useAuthStore } from '../store/authStore.js'

export default function SettingsPage() {
  const { user } = useAuthStore()
  const [githubRepo, setGithubRepo] = useState('')
  const [apiUrl, setApiUrl]         = useState('')
  const [webhook, setWebhook]       = useState('')
  const [saved, setSaved]           = useState(false)
  const [ghStatus, setGhStatus]     = useState(null)
  const [slackStatus, setSlackStatus] = useState(null)

  useEffect(() => {
    fetch('/health')
      .then(r => r.json())
      .then(d => { setGhStatus(!!d.githubToken); setSlackStatus(!!d.slackWebhook) })
      .catch(() => { setGhStatus(false); setSlackStatus(false) })
  }, [])

  const save = (e) => {
    e.preventDefault()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const inputStyle = {
    width:'100%', background:'var(--bg)', border:'1px solid var(--border)',
    borderRadius:'var(--radius)', padding:'9px 12px', color:'var(--white)',
    fontFamily:'var(--mono)', fontSize:12, outline:'none', transition:'border-color .15s',
  }
  const labelStyle = { display:'block', fontSize:10, color:'var(--muted)', marginBottom:6, letterSpacing:'1px', textTransform:'uppercase' }
  const fieldStyle = { marginBottom:16 }

  return (
    <div style={{ maxWidth:700, animation:'fadeIn .3s ease' }}>
      <div style={{ marginBottom:22 }}>
        <div style={{ fontSize:11, color:'var(--muted)', letterSpacing:'2px', marginBottom:4 }}>CONFIGURATION</div>
        <h1 style={{ fontFamily:'var(--disp)', fontWeight:800, fontSize:24, color:'var(--white)' }}>Settings</h1>
      </div>

      <form onSubmit={save} style={{ display:'flex', flexDirection:'column', gap:16 }}>
        <Panel title="Project">
          <div style={{ padding:20 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>GitHub repository</label>
              <input value={githubRepo} onChange={e => setGithubRepo(e.target.value)}
                placeholder="owner/repo" style={inputStyle}
                onFocus={e => e.target.style.borderColor='var(--red)'}
                onBlur={e  => e.target.style.borderColor='var(--border)'} />
              <div style={{ fontSize:10, color:'var(--muted)', marginTop:4 }}>Default repo for code and dependency scans</div>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>API base URL</label>
              <input value={apiUrl} onChange={e => setApiUrl(e.target.value)}
                placeholder="https://api.yourapp.com" style={inputStyle}
                onFocus={e => e.target.style.borderColor='var(--red)'}
                onBlur={e  => e.target.style.borderColor='var(--border)'} />
              <div style={{ fontSize:10, color:'var(--muted)', marginTop:4 }}>Default URL for API endpoint scans</div>
            </div>
          </div>
        </Panel>

        <Panel title="Notifications">
          <div style={{ padding:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
              <div style={{
                width:8, height:8, borderRadius:'50%', flexShrink:0,
                background: slackStatus === null ? 'var(--muted)' : slackStatus ? 'var(--green)' : 'var(--red)',
              }} />
              <span style={{ fontSize:11, color: slackStatus ? 'var(--green)' : 'var(--muted)' }}>
                {slackStatus === null ? 'Checking…' : slackStatus ? 'SLACK_WEBHOOK_URL configured — notifications active' : 'SLACK_WEBHOOK_URL not set — Slack notifications disabled'}
              </span>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Slack webhook URL</label>
              <input value={webhook} onChange={e => setWebhook(e.target.value)}
                placeholder="https://hooks.slack.com/services/..." style={inputStyle}
                onFocus={e => e.target.style.borderColor='var(--red)'}
                onBlur={e  => e.target.style.borderColor='var(--border)'} />
              <div style={{ fontSize:10, color:'var(--muted)', marginTop:4 }}>Set SLACK_WEBHOOK_URL on the backend to get notified on critical/high findings</div>
            </div>
          </div>
        </Panel>

        <Panel title="GitHub Integration">
          <div style={{ padding:20 }}>
            {/* Status badge */}
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
              <div style={{
                width:8, height:8, borderRadius:'50%',
                background: ghStatus === null ? 'var(--muted)' : ghStatus ? 'var(--green)' : 'var(--red)',
                flexShrink:0,
              }} />
              <span style={{ fontSize:11, color: ghStatus ? 'var(--green)' : 'var(--muted)' }}>
                {ghStatus === null ? 'Checking…' : ghStatus ? 'GITHUB_TOKEN configured — authenticated (5 000 req/hr)' : 'GITHUB_TOKEN not set — unauthenticated mode, public repos only (60 req/hr)'}
              </span>
            </div>

            {!ghStatus && ghStatus !== null && (
              <div>
                <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:'1px', textTransform:'uppercase', marginBottom:10 }}>Add a token to increase rate limits &amp; enable private repos</div>
                {[
                  ['1', 'Create a Personal Access Token', 'Go to GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens. Grant read access to Contents and Metadata for the repos you want to scan.'],
                  ['2', 'Add it to your environment', 'In your .env file (local) or Railway / Render / Docker environment variables, add:'],
                  ['3', 'Restart the backend', 'The server reads GITHUB_TOKEN on startup. Restart it and reload this page to verify.'],
                ].map(([n, title, desc]) => (
                  <div key={n} style={{ display:'flex', gap:12, marginBottom:14 }}>
                    <div style={{
                      width:20, height:20, borderRadius:'50%', background:'var(--s2)',
                      border:'1px solid var(--border)', display:'flex', alignItems:'center',
                      justifyContent:'center', fontSize:9, color:'var(--muted)', flexShrink:0, marginTop:1,
                    }}>{n}</div>
                    <div>
                      <div style={{ fontSize:11, color:'var(--white)', marginBottom:3 }}>{title}</div>
                      <div style={{ fontSize:10, color:'var(--muted)', lineHeight:1.5 }}>{desc}</div>
                      {n === '2' && (
                        <div style={{
                          marginTop:6, background:'var(--bg)', border:'1px solid var(--border)',
                          borderRadius:'var(--radius)', padding:'7px 10px',
                          fontFamily:'var(--mono)', fontSize:11, color:'var(--green)',
                        }}>
                          GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <a
                  href="https://github.com/settings/tokens?type=beta"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display:'inline-block', marginTop:4,
                    fontSize:10, color:'var(--red)', textDecoration:'none',
                    border:'1px solid var(--border)', borderRadius:'var(--radius)',
                    padding:'6px 12px', fontFamily:'var(--mono)',
                  }}
                  onMouseEnter={e => e.target.style.borderColor='var(--red)'}
                  onMouseLeave={e => e.target.style.borderColor='var(--border)'}
                >
                  Open GitHub token settings ↗
                </a>
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Account">
          <div style={{ padding:20 }}>
            <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>Email</div>
            <div style={{ fontSize:12, color:'var(--white)' }}>{user?.email}</div>
          </div>
        </Panel>

        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <button type="submit"
            style={{ background:saved?'var(--green)':'var(--red)', border:'none', borderRadius:'var(--radius)', padding:'9px 24px', color:'#fff', fontFamily:'var(--mono)', fontSize:12, cursor:'pointer', transition:'background .2s' }}>
            {saved ? '✓ Saved' : 'Save settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
