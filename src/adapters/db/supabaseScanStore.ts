import type { SupabaseClient } from '@supabase/supabase-js'
import type { Scan, ScanStatus, ScanProgress } from '../../domain/entities/scan'
import type { SeveritySummary } from '../../domain/entities/vulnerability'
import type { ScanStore, PaginationOpts, Paginated } from '../../domain/ports/scanStore'

export class SupabaseScanStore implements ScanStore {
  constructor(private readonly db: SupabaseClient) {}

  async create(scan: Omit<Scan, 'id' | 'createdAt' | 'completedAt'>): Promise<string> {
    const { data, error } = await this.db
      .from('scans')
      .insert({
        org_id: scan.orgId,
        user_id: scan.userId,
        repo: scan.repo,
        ref: scan.ref,
        type: scan.type,
        status: scan.status,
        progress: scan.progress,
        tree_sha: scan.treeSha,
        score: scan.score,
        summary: scan.summary,
        duration_ms: scan.durationMs,
        error: scan.error,
      })
      .select('id')
      .single()

    if (error) throw error
    return data.id
  }

  async updateStatus(id: string, status: ScanStatus, progress?: Partial<ScanProgress>): Promise<void> {
    const update: Record<string, unknown> = { status }
    if (progress !== undefined) {
      update.progress = progress
    }

    const { error } = await this.db.from('scans').update(update).eq('id', id)
    if (error) throw error
  }

  async complete(id: string, score: string, summary: SeveritySummary, durationMs: number): Promise<void> {
    const { error } = await this.db
      .from('scans')
      .update({
        status: 'complete',
        score,
        summary,
        duration_ms: durationMs,
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) throw error
  }

  async fail(id: string, error: string): Promise<void> {
    const { error: dbError } = await this.db
      .from('scans')
      .update({
        status: 'failed',
        error,
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (dbError) throw dbError
  }

  async getById(id: string): Promise<Scan | null> {
    const { data, error } = await this.db.from('scans').select('*').eq('id', id).maybeSingle()

    if (error) throw error
    if (!data) return null
    return this.toScan(data)
  }

  async listByOrg(orgId: string, opts: PaginationOpts): Promise<Paginated<Scan>> {
    const { data, error, count } = await this.db
      .from('scans')
      .select('*', { count: 'exact' })
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .range(opts.offset, opts.offset + opts.limit - 1)

    if (error) throw error
    return {
      data: (data ?? []).map((row) => this.toScan(row)),
      total: count ?? 0,
    }
  }

  async countByOrgSince(orgId: string, since: Date): Promise<number> {
    const { count, error } = await this.db
      .from('scans')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('created_at', since.toISOString())

    if (error) throw error
    return count ?? 0
  }

  private toScan(row: Record<string, unknown>): Scan {
    return {
      id: row.id as string,
      orgId: row.org_id as string,
      userId: row.user_id as string,
      repo: (row.repo as string | null) ?? null,
      ref: (row.ref as string | null) ?? null,
      type: row.type as Scan['type'],
      status: row.status as ScanStatus,
      progress: row.progress as ScanProgress,
      treeSha: (row.tree_sha as string | null) ?? null,
      score: (row.score as string | null) ?? null,
      summary: (row.summary as SeveritySummary | null) ?? null,
      durationMs: (row.duration_ms as number | null) ?? null,
      error: (row.error as string | null) ?? null,
      createdAt: new Date(row.created_at as string),
      completedAt: row.completed_at ? new Date(row.completed_at as string) : null,
    }
  }
}
