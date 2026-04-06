import type { Check } from './types'

export const EXPRESS_CHECKS: Check[] = [
  {
    id: 'express-no-helmet',
    category: 'configuration',
    severity: 'medium',
    title: 'Express App Missing Helmet Security Headers',
    description:
      'Express does not set secure HTTP response headers by default. Without Helmet, the app is missing protections such as Content-Security-Policy, X-Frame-Options, and X-Content-Type-Options, increasing exposure to clickjacking, MIME sniffing, and XSS.',
    fix: "Install and apply helmet: npm install helmet, then app.use(helmet()). Review each header Helmet sets and customize as needed for your application.",
    pattern: /(?:const|var|let)\s+app\s*=\s*express\s*\(\s*\)(?![\s\S]*helmet)/gim,
    fileTypes: ['.js', '.ts'],
  },
  {
    id: 'express-body-no-limit',
    category: 'configuration',
    severity: 'medium',
    title: 'express.json() Without Request Body Size Limit',
    description:
      'express.json() without a limit option accepts arbitrarily large request bodies. An attacker can send multi-gigabyte payloads to exhaust server memory and cause a denial of service.',
    fix: "Set an appropriate body size limit: app.use(express.json({ limit: '100kb' })). Choose a limit appropriate for your API's maximum expected payload size.",
    pattern: /express\.json\s*\(\s*\)/gim,
    fileTypes: ['.js', '.ts'],
  },
]
