import type { Severity } from '../../entities/vulnerability'

export interface Check {
  id: string
  category: string
  severity: Severity
  title: string
  description: string
  fix: string
  pattern: RegExp
  fileTypes?: string[]
}
