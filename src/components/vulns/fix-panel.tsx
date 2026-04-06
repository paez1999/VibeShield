'use client'

import { useState } from 'react'

function CodeBlock({ code, label, variant }: { code: string; label: string; variant: 'danger' | 'success' }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex-1 min-w-0">
      <div className={`flex items-center justify-between px-3 py-1.5 ${variant === 'danger' ? 'bg-red/10 border-b border-red/20' : 'bg-green/10 border-b border-green/15'} rounded-t-md`}>
        <span className={`text-[10px] font-medium tracking-widest ${variant === 'danger' ? 'text-red' : 'text-green'}`}>{label}</span>
        <button onClick={copy} className="text-muted text-[10px] hover:text-white transition-colors font-mono">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className={`m-0 p-3 bg-bg border ${variant === 'danger' ? 'border-red/15' : 'border-green/10'} border-t-0 rounded-b-md ${variant === 'danger' ? 'text-red/60' : 'text-green/60'} text-[11px] leading-relaxed overflow-auto whitespace-pre-wrap break-words font-mono min-h-[80px]`}>
        {code}
      </pre>
    </div>
  )
}

export function FixPanel({ vuln }: { vuln: any }) {
  const explanation = vuln.ai_explanation || vuln.description
  const fixPrompt = vuln.fix_prompt || vuln.fix || 'No fix suggestion available.'
  const codeSnippet = vuln.code_snippet || ''

  return (
    <div className="mt-3 space-y-3">
      {/* Explanation */}
      <div className="p-3 bg-blue/[.07] border border-blue/15 rounded-md text-xs text-text leading-relaxed">
        {explanation}
      </div>

      {/* Code snippet + fix prompt side by side */}
      {codeSnippet && (
        <div className="flex gap-3">
          <CodeBlock code={codeSnippet} label="VULNERABLE" variant="danger" />
          <CodeBlock code={fixPrompt} label="FIX PROMPT" variant="success" />
        </div>
      )}

      {/* If no code snippet, just show fix prompt */}
      {!codeSnippet && (
        <CodeBlock code={fixPrompt} label="FIX PROMPT — paste into your AI coding tool" variant="success" />
      )}
    </div>
  )
}
