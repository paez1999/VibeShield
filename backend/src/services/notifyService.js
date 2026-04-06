const SEV_EMOJI = { critical: '🔴', high: '🟠', medium: '🟡', low: '⚪' }

/**
 * Send a Slack notification when a scan produces critical/high findings.
 * Silently no-ops if SLACK_WEBHOOK_URL is not set.
 */
export async function notifySlack(findings, context = {}) {
  const url = process.env.SLACK_WEBHOOK_URL
  if (!url) return

  const critical = findings.filter(f => f.severity === 'critical').length
  const high     = findings.filter(f => f.severity === 'high').length
  if (critical === 0 && high === 0) return   // only alert on critical/high

  const top = findings
    .filter(f => f.severity === 'critical' || f.severity === 'high')
    .slice(0, 5)
    .map(f => `${SEV_EMOJI[f.severity] || '•'} *${f.title}*${f.location ? `  \`${f.location}\`` : ''}`)
    .join('\n')

  const target = context.target || context.repo || 'unknown'
  const type   = context.type   || 'scan'
  const counts = [
    critical && `${critical} critical`,
    high     && `${high} high`,
  ].filter(Boolean).join(', ')

  const body = {
    text: `⚠️ *VibeShield — ${counts} findings* in \`${target}\` (${type})`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `⚠️ *VibeShield scan found ${counts} issues*\nTarget: \`${target}\`  |  Type: ${type}  |  Total: ${findings.length}`,
        },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: top },
      },
    ],
  }

  try {
    await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
  } catch (err) {
    console.warn('[notify] Slack post failed:', err.message)
  }
}
