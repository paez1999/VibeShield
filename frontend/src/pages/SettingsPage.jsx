import { useState } from 'react'
import { Panel } from '../components/ui/index.jsx'
import { useAuthStore } from '../store/authStore.js'

export default function SettingsPage() {
  const { user } = useAuthStore()
  const [githubRepo, setGithubRepo] = useState('')
  const [apiUrl, setApiUrl]         = useState('')
  const [webhook, setWebhook]       = useState('')
  const [saved, setSaved]           = useState(false)

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
            <div style={fieldStyle}>
              <label style={labelStyle}>Slack webhook URL</label>
              <input value={webhook} onChange={e => setWebhook(e.target.value)}
                placeholder="https://hooks.slack.com/services/..." style={inputStyle}
                onFocus={e => e.target.style.borderColor='var(--red)'}
                onBlur={e  => e.target.style.borderColor='var(--border)'} />
              <div style={{ fontSize:10, color:'var(--muted)', marginTop:4 }}>Get notified on critical findings</div>
            </div>
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
