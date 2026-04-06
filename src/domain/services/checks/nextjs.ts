import type { Check } from './types'

export const NEXTJS_CHECKS: Check[] = [
  {
    id: 'nextjs-dangerously-set',
    category: 'xss',
    severity: 'high',
    title: 'XSS via dangerouslySetInnerHTML in React/Next.js',
    description:
      'dangerouslySetInnerHTML bypasses React\'s automatic HTML escaping. If the value contains user-supplied content, an attacker can inject script tags or event handlers to execute JavaScript.',
    fix: 'Avoid dangerouslySetInnerHTML where possible. If raw HTML is required, sanitize the content with DOMPurify before passing it in: { __html: DOMPurify.sanitize(userContent) }.',
    pattern: /dangerouslySetInnerHTML\s*=\s*\{\s*\{[^}]*(?:\+|`|\$\{|props\.|state\.)/gim,
    fileTypes: ['.jsx', '.tsx'],
  },
  {
    id: 'nextjs-exposed-server-secret',
    category: 'secrets',
    severity: 'critical',
    title: 'Server-Side Secret Exposed in Client Component',
    description:
      'Next.js only exposes environment variables prefixed with NEXT_PUBLIC_ to the browser bundle. Referencing non-prefixed variables (e.g., process.env.SECRET_KEY) in client components causes Next.js to inline the value, leaking secrets to all users.',
    fix: 'Prefix public-safe variables with NEXT_PUBLIC_. Keep sensitive variables (API keys, database credentials) server-side only by using them exclusively in Server Components, API routes, or server actions.',
    pattern: /process\.env\.(?!NEXT_PUBLIC_)[A-Z_]{3,}/gim,
    fileTypes: ['.jsx', '.tsx'],
  },
]
