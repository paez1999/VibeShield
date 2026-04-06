import { jsonOk } from '@/lib/api-utils'

export async function GET() {
  return jsonOk({
    status: 'ok',
    version: process.env.npm_package_version || '2.0.0',
    ts: new Date().toISOString(),
    githubToken: !!process.env.GITHUB_TOKEN,
    slackWebhook: !!process.env.SLACK_WEBHOOK_URL,
  })
}
