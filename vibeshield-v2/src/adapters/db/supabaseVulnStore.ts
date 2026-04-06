import type { SupabaseClient } from '@supabase/supabase-js'
import type { Vulnerability, NewVulnerability, SeveritySummary } from '../../domain/entities/vulnerability'
import type { VulnStore, VulnFilters } from '../../domain/ports/vulnStore'
import type { PaginationOpts, Paginated } from '../../domain/ports/scanStore'

export class SupabaseVulnStore implements VulnStore {
  constructor(private readonly db: SupabaseClient) {}

  async upsertMany(vulns: NewVulnerability[]): Promise<number> {
    if (vulns.length === 0) return 0

    const rows = vulns.map((v) => ({
      org_id: v.orgId,
      scan_id: v.scanId,
      check_id: v.checkId,
      location_hash: v.locationHash,
      title: v.title,
      description: v.description,
      category: v.category,
      severity: v.severity,
      status: v.status,
      location: v.location,
      code_snippet: v.codeSnippet,
      fix_prompt: v.fixPrompt,
      ai_explanation: v.aiExplanation,
      source: v.source,
    }))

    const { data, error } = await this.db
      .from('vulnerabilities')
      .upsert(rows, { onConflict: 'org_id,check_id,location_hash' })
      .select('id')

    if (error) throw error
    return data?.length ?? 0
  }

  async listByOrg(orgId: string, filters: VulnFilters, opts: PaginationOpts): Promise<Paginated<Vulnerability>> {
    let query = this.db
      .from('vulnerabilities')
      .select('*', { count: 'exact' })
      .eq('org_id', orgId)

    if (filters.status !== undefined) query = query.eq('status', filters.status)
    if (filters.severity !== undefined) query = query.eq('severity', filters.severity)
    if (filters.category !== undefined) query = query.eq('category', filters.category)
    if (filters.scanId !== undefined) query = query.eq('scan_id', filters.scanId)

    const { data, error, count } = await query
      .order('first_seen_at', { ascending: false })
      .range(opts.offset, opts.offset + opts.limit - 1)

    if (error) throw error
    return {
      data: (data ?? []).map((row) => this.toVuln(row)),
      total: count ?? 0,
    }
  }

  async summaryByOrg(orgId: string): Promise<SeveritySummary> {
    const { data, error } = await this.db.rpc('vuln_summary_by_org', { p_org_id: orgId })

    if (error) throw error
    return data as SeveritySummary
  }

  async resolve(id: string, userId: string): Promise<void> {
    const { error } = await this.db
      .from('vulnerabilities')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
      })
      .eq('id', id)

    if (error) throw error
  }

  async ignore(id: string, userId: string): Promise<void> {
    const { error } = await this.db
      .from('vulnerabilities')
      .update({
        status: 'ignored',
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
      })
      .eq('id', id)

    if (error) throw error
  }

  async autoResolveStale(orgId: string, scanId: string, currentLocationHashes: string[]): Promise<number> {
    const { data, error } = await this.db
      .from('vulnerabilities')
      .update({ status: 'auto_resolved' })
      .eq('org_id', orgId)
      .eq('status', 'open')
      .not('location_hash', 'in', `(${currentLocationHashes.map((h) => `"${h}"`).join(',')})`)
      .select('id')

    if (error) throw error
    return data?.length ?? 0
  }

  private toVuln(row: Record<string, unknown>): Vulnerability {
    return {
      id: row.id as string,
      orgId: row.org_id as string,
      scanId: row.scan_id as string,
      checkId: row.check_id as string,
      locationHash: row.location_hash as string,
      title: row.title as string,
      description: row.description as string,
      category: row.category as string,
      severity: row.severity as Vulnerability['severity'],
      status: row.status as Vulnerability['status'],
      location: (row.location as string | null) ?? null,
      codeSnippet: (row.code_snippet as string | null) ?? null,
      fixPrompt: (row.fix_prompt as string | null) ?? null,
      aiExplanation: (row.ai_explanation as string | null) ?? null,
      source: row.source as string,
      firstSeenAt: new Date(row.first_seen_at as string),
      resolvedAt: row.resolved_at ? new Date(row.resolved_at as string) : null,
    }
  }
}
