import type { Check } from './types'

export const JAVASCRIPT_CHECKS: Check[] = [
  {
    id: 'xss-document-write',
    category: 'xss',
    severity: 'high',
    title: 'XSS via document.write() with Dynamic Content',
    description:
      'document.write() with dynamic content allows Cross-Site Scripting (XSS). Attacker-controlled data rendered through document.write() executes arbitrary JavaScript in the victim\'s browser.',
    fix: 'Avoid document.write() entirely. Use DOM APIs such as document.createElement() and textContent, or a templating library that auto-escapes output.',
    pattern: /document\.write\s*\(\s*(?:[^)]*(?:\+|`|\$\{)[^)]*)\)/gim,
    fileTypes: ['.js', '.jsx', '.ts', '.tsx'],
  },
  {
    id: 'xss-innerhtml',
    category: 'xss',
    severity: 'high',
    title: 'XSS via innerHTML Assignment with Dynamic Content',
    description:
      'Assigning user-controlled content to innerHTML parses it as HTML, allowing script injection. Even without <script> tags, event handlers like onerror can execute JavaScript.',
    fix: 'Use element.textContent for plain text. If HTML is required, sanitize input with DOMPurify before assignment. Prefer React JSX or similar frameworks that safely escape by default.',
    pattern: /\.innerHTML\s*=\s*(?:[^;]*(?:\+|`|\$\{|req\.|params\.|body\.|query\.))/gim,
    fileTypes: ['.js', '.jsx', '.ts', '.tsx'],
  },
  {
    id: 'prototype-pollution',
    category: 'injection',
    severity: 'high',
    title: 'Prototype Pollution via Object Merge with User Input',
    description:
      'Merging user-supplied objects (e.g., via Object.assign or lodash merge) without key filtering allows an attacker to inject properties into Object.prototype, affecting all objects in the process.',
    fix: 'Sanitize merge inputs by rejecting keys like __proto__, constructor, and prototype. Use Object.create(null) for accumulator objects, or a merge library that is prototype-pollution-safe.',
    pattern:
      /(?:Object\.assign|merge|extend|deepmerge|_.merge|_.extend)\s*\([^)]*(?:req\.|params\.|body\.|query\.)/gim,
    fileTypes: ['.js', '.jsx', '.ts', '.tsx'],
  },
  {
    id: 'cookie-no-httponly',
    category: 'configuration',
    severity: 'high',
    title: 'Cookie Set Without HttpOnly Flag',
    description:
      'Cookies without the HttpOnly flag are accessible to JavaScript. If XSS is present, an attacker can steal session cookies, leading to account takeover.',
    fix: 'Set the HttpOnly flag on all session and authentication cookies: res.cookie("session", value, { httpOnly: true, secure: true, sameSite: "Strict" }).',
    pattern: /res\.cookie\s*\([^)]*\)\s*(?!.*httpOnly)/gim,
    fileTypes: ['.js', '.jsx', '.ts', '.tsx'],
  },
]
