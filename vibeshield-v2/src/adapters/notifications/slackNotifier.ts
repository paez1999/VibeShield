import type { Notifier, ScanNotification } from '@/domain/ports/notifier'

const SEVERITY_EMOJI: Record<string, string> = {
  critical: ':red_circle:',
  high: ':orange_circle:',
  medium: ':yellow_circle:',
  low: ':white_circle:',
  info: ':blue_circle:',
}

export class SlackNotifier implements Notifier {
  constructor(private readonly webhookUrl: string | undefined) {}

  async notify(notification: ScanNotification): Promise<void> {
    if (!this.webhookUrl) return
    if (notification.critical === 0 && notification.high === 0) return

    try {
      const blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:shield: *VibeShield Scan Alert*\n*Target:* ${notification.target}\n*Type:* ${notification.scanType}\n*Findings:* ${notification.totalFindings} total (${notification.critical} critical, ${notification.high} high)`,
          },
        },
        { type: 'divider' },
      ]

      if (notification.topFindings.length > 0) {
        const findingLines = notification.topFindings
          .slice(0, 5)
          .map(f => `${SEVERITY_EMOJI[f.severity] ?? ':question:'} *${f.title}*${f.location ? ` — \`${f.location}\`` : ''}`)
          .join('\n')

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Top findings:*\n${findingLines}`,
          },
        })
      }

      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks }),
      })
    } catch {
      // Never throw — notification failure should not break scans
    }
  }
}
