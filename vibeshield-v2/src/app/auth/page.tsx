'use client'

import { useAuth } from '@/lib/hooks/use-auth'
import { Spinner } from '@/components/ui/spinner'

export default function AuthPage() {
  const { signInWithGitHub, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size={20} />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-surface border border-border rounded-lg p-10 animate-fade-in">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 bg-red rounded-md flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 1.5L15 5V10.5C15 13.5 12 16 9 16.5C6 16 3 13.5 3 10.5V5L9 1.5Z" stroke="#fff" strokeWidth="1.5" fill="none"/>
              <path d="M6.5 9.5L8 11L11.5 7.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="font-display font-extrabold text-xl text-white">VibeShield</span>
        </div>

        {/* Heading */}
        <h1 className="font-display font-extrabold text-2xl text-white mb-2">
          Security for vibe-coded apps
        </h1>
        <p className="text-muted text-xs mb-8">
          Scan your AI-generated code for vulnerabilities, exposed secrets, and security misconfigurations.
        </p>

        {/* GitHub OAuth button */}
        <button
          onClick={signInWithGitHub}
          className="w-full flex items-center justify-center gap-3 bg-white text-bg font-display font-bold text-sm py-3 rounded-sm hover:bg-white/90 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          Sign in with GitHub
        </button>

        <p className="text-center text-muted text-[10px] mt-6">
          By signing in, you agree to our Terms of Service
        </p>
      </div>
    </div>
  )
}
