import type { Severity } from '../entities/vulnerability'

export interface ScanNotification {
  target: string
  scanType: string
  totalFindings: number
  critical: number
  high: number
  topFindings: Array<{
    title: string
    severity: Severity
    location: string | null
  }>
}

export interface Notifier {
  notify(notification: ScanNotification): Promise<void>
}
