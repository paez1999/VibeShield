export interface AppConfig {
  supabaseUrl: string
  supabaseServiceRoleKey: string
  githubToken: string
  anthropicApiKey: string
  stripeSecretKey: string
}

export function loadConfig(): AppConfig {
  const required = (key: string): string => {
    const val = process.env[key]
    if (!val) throw new Error(`Missing required env var: ${key}`)
    return val
  }

  return {
    supabaseUrl: required('SUPABASE_URL'),
    supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    githubToken: required('GITHUB_TOKEN'),
    anthropicApiKey: required('ANTHROPIC_API_KEY'),
    stripeSecretKey: required('STRIPE_SECRET_KEY'),
  }
}
