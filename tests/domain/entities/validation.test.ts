import { describe, it, expect } from 'vitest'
import {
  type Severity,
  type VulnStatus,
  type ScanType,
  type ScanStatus,
  type PlanType,
  SEVERITIES,
  VULN_STATUSES,
  SCAN_TYPES,
  SCAN_STATUSES,
  PLAN_TYPES,
} from '@/domain/entities'

describe('Entity constants', () => {
  it('SEVERITIES contains all severity levels in order', () => {
    expect(SEVERITIES).toEqual(['critical', 'high', 'medium', 'low', 'info'])
  })
  it('VULN_STATUSES contains all vulnerability statuses', () => {
    expect(VULN_STATUSES).toEqual(['open', 'resolved', 'ignored', 'auto_resolved'])
  })
  it('SCAN_TYPES contains all scan types', () => {
    expect(SCAN_TYPES).toEqual(['code', 'api', 'text', 'deps'])
  })
  it('SCAN_STATUSES contains all scan statuses in lifecycle order', () => {
    expect(SCAN_STATUSES).toEqual(['queued', 'fetching', 'scanning', 'analyzing', 'complete', 'failed'])
  })
  it('PLAN_TYPES contains all plan types', () => {
    expect(PLAN_TYPES).toEqual(['trial', 'free', 'pro', 'team'])
  })
})
