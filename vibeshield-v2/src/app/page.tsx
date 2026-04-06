'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ScoreBar } from '@/components/ui/score-bar'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'

export default function LandingPage() {
  const [repo, setRepo] = useState('')
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!repo.trim()) return
    setScanning(true); setResult(null); setError('')
    try {
      const res = await fetch('/api/scan-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: repo.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Scan failed')
      setResult(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-red rounded-lg flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 18 18" fill="none">
              <path d="M9 1.5L15 5V10.5C15 13.5 12 16 9 16.5C6 16 3 13.5 3 10.5V5L9 1.5Z" stroke="#fff" strokeWidth="1.5" fill="none"/>
              <path d="M6.5 9.5L8 11L11.5 7.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="font-display font-extrabold text-2xl text-white">VibeShield</span>
        </div>

        <h1 className="font-display font-extrabold text-4xl text-white text-center mb-3">
          Security for vibe-coded apps
        </h1>
        <p className="text-muted text-sm text-center max-w-md mb-10">
          You built your app with AI. Let us check if it&apos;s safe to ship.
          Paste your GitHub repo and get a security score in seconds.
        </p>

        {/* Scan form */}
        <form onSubmit={handleScan} className="w-full max-w-lg flex gap-2.5 mb-6">
          <input
            value={repo}
            onChange={e => setRepo(e.target.value)}
            placeholder="owner/repo"
            className="flex-1 bg-surface border border-border rounded-sm px-4 py-3 text-white font-mono text-sm outline-none focus:border-red transition-colors"
          />
          <button type="submit" disabled={scanning || !repo.trim()}
            className="bg-red text-white font-display font-bold text-sm px-6 py-3 rounded-sm hover:bg-red-dim transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0">
            {scanning && <Spinner size={14} />}
            {scanning ? 'Scanning...' : 'Scan free'}
          </button>
        </form>

        {error && (
          <div className="w-full max-w-lg p-3 bg-red/10 border border-red/20 rounded-sm text-red text-xs mb-6">
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="w-full max-w-lg bg-surface border border-border rounded-lg p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[10px] text-muted tracking-widest mb-1">SECURITY SCORE</div>
                <div className={`font-display text-5xl font-extrabold ${
                  result.score === 'A' ? 'text-green' : result.score === 'B' ? 'text-green' : result.score === 'C' ? 'text-amber' : 'text-red'
                }`}>{result.score}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-muted tracking-widest mb-1">FINDINGS</div>
                <div className="font-display text-3xl font-extrabold text-white">{result.totalFindings}</div>
              </div>
            </div>

            <div className="flex gap-3 mb-4">
              {(['critical', 'high', 'medium', 'low'] as const).map(s => (
                <div key={s} className="flex items-center gap-1.5 text-[10px]">
                  <Badge variant={s}>{result.summary?.[s] ?? 0}</Badge>
                  <span className="text-muted">{s}</span>
                </div>
              ))}
            </div>

            <div className="h-px bg-border my-4" />

            <p className="text-muted text-xs mb-3">
              {result.totalFindings > 0
                ? 'Sign up to see detailed findings, AI analysis, and fix suggestions.'
                : 'Your code looks clean! Sign up to run deeper scans with AI analysis.'}
            </p>
            <Link href="/auth"
              className="inline-block bg-red text-white font-display font-bold text-xs px-5 py-2 rounded-sm hover:bg-red-dim transition-colors">
              Sign up free — 3 full scans included
            </Link>
          </div>
        )}

        {/* Features */}
        {!result && (
          <div className="grid grid-cols-3 gap-6 w-full max-w-2xl mt-16">
            {[
              { title: 'Code scanning', desc: '29+ vulnerability patterns across JS, Python, Next.js, Express' },
              { title: 'Secret detection', desc: '16+ credential patterns — AWS, GitHub, Stripe, database URLs' },
              { title: 'AI fix prompts', desc: 'Get fix suggestions you can paste directly into your AI coding tool' },
            ].map(f => (
              <div key={f.title} className="text-center">
                <div className="text-white text-xs font-medium mb-1">{f.title}</div>
                <div className="text-muted text-[10px] leading-relaxed">{f.desc}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-6 text-muted text-[10px]">
        VibeShield — Security for AI-generated apps
      </div>
    </div>
  )
}
