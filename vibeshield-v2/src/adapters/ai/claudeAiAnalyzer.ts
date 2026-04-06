import Anthropic from '@anthropic-ai/sdk'
import type { AiAnalyzer, Finding, ScanContext, AiEnrichment } from '@/domain/ports/aiAnalyzer'

export class ClaudeAiAnalyzer implements AiAnalyzer {
  private readonly client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  async analyzeBatch(findings: Finding[], context: ScanContext): Promise<AiEnrichment[]> {
    if (findings.length === 0) return []

    const prompt = this.buildPrompt(findings, context)
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-6-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('')

    return this.parseResponse(text, findings)
  }

  private buildPrompt(findings: Finding[], context: ScanContext): string {
    const findingsJson = findings.map((f, i) => ({
      index: i,
      checkId: f.checkId,
      title: f.title,
      severity: f.severity,
      location: f.location,
      codeSnippet: f.codeSnippet,
      category: f.category,
    }))

    return `You are a security expert reviewing vulnerabilities found in the repository "${context.repo}" (ref: ${context.ref}).

For each vulnerability below, provide:
1. A plain-English explanation of why this is dangerous (2-3 sentences, written for a developer who used AI to generate this code and may not understand the risk)
2. A fix prompt that the developer can paste into their AI coding tool (Cursor, Copilot, etc.) to fix the issue

Respond with a JSON array. Each element must have:
- "index": the finding index (number)
- "explanation": your plain-English explanation (string)
- "fixPrompt": a prompt the developer can give to their AI coding tool to fix this specific issue (string)

Respond ONLY with the JSON array, no other text.

Findings:
${JSON.stringify(findingsJson, null, 2)}`
  }

  private parseResponse(text: string, findings: Finding[]): AiEnrichment[] {
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) return this.fallback(findings)

      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        index: number
        explanation: string
        fixPrompt: string
      }>

      return parsed.map(item => {
        const finding = findings[item.index]
        if (!finding) return null
        return {
          checkId: finding.checkId,
          locationHash: finding.locationHash,
          explanation: item.explanation,
          fixPrompt: item.fixPrompt,
        }
      }).filter((x): x is AiEnrichment => x !== null)
    } catch {
      return this.fallback(findings)
    }
  }

  private fallback(findings: Finding[]): AiEnrichment[] {
    return findings.map(f => ({
      checkId: f.checkId,
      locationHash: f.locationHash,
      explanation: f.description,
      fixPrompt: f.fix,
    }))
  }
}
