import type { Severity } from '../entities/vulnerability'

export interface Finding {
  checkId: string
  locationHash: string
  title: string
  description: string
  fix: string
  category: string
  severity: Severity
  location: string
  codeSnippet: string
}

export interface ScanContext {
  repo: string
  ref: string
}

export interface AiEnrichment {
  checkId: string
  locationHash: string
  explanation: string
  fixPrompt: string
}

export interface AiAnalyzer {
  analyzeBatch(findings: Finding[], context: ScanContext): Promise<AiEnrichment[]>
}
