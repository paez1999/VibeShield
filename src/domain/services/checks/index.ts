import type { Check } from './types'
import { UNIVERSAL_CHECKS } from './universal'
import { JAVASCRIPT_CHECKS } from './javascript'
import { PYTHON_CHECKS } from './python'
import { NEXTJS_CHECKS } from './nextjs'
import { EXPRESS_CHECKS } from './express'
import { SUPABASE_CHECKS } from './supabase'
import path from 'path'

export type { Check } from './types'

export const ALL_CHECKS: Check[] = [
  ...UNIVERSAL_CHECKS,
  ...JAVASCRIPT_CHECKS,
  ...PYTHON_CHECKS,
  ...NEXTJS_CHECKS,
  ...EXPRESS_CHECKS,
  ...SUPABASE_CHECKS,
]

const EXT_MAP: Record<string, Check[]> = {
  '.js': [...UNIVERSAL_CHECKS, ...JAVASCRIPT_CHECKS, ...EXPRESS_CHECKS],
  '.jsx': [...UNIVERSAL_CHECKS, ...JAVASCRIPT_CHECKS, ...NEXTJS_CHECKS],
  '.ts': [...UNIVERSAL_CHECKS, ...JAVASCRIPT_CHECKS, ...EXPRESS_CHECKS],
  '.tsx': [...UNIVERSAL_CHECKS, ...JAVASCRIPT_CHECKS, ...NEXTJS_CHECKS],
  '.py': [...UNIVERSAL_CHECKS, ...PYTHON_CHECKS],
  '.sql': [...SUPABASE_CHECKS],
}

export function getChecksForFile(filePath: string): Check[] {
  const ext = path.extname(filePath).toLowerCase()
  return EXT_MAP[ext] ?? UNIVERSAL_CHECKS
}
