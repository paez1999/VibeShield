import type { Check } from './types'

export const SUPABASE_CHECKS: Check[] = [
  {
    id: 'supabase-service-key-client',
    category: 'secrets',
    severity: 'critical',
    title: 'Supabase Service Role Key Used in Client-Side Code',
    description:
      'The Supabase service role key bypasses Row Level Security (RLS) and has full database access. Embedding it in client-side code exposes it to all users, allowing anyone to read, modify, or delete any data in your database.',
    fix: 'Use the public anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY) on the client side. Keep the service role key strictly server-side in API routes, server actions, or backend services behind authentication.',
    pattern:
      /(?:createClient|supabase)\s*\([^)]*(?:service_role|SERVICE_ROLE|serviceRole)[^)]*\)/gim,
    fileTypes: ['.js', '.jsx', '.ts', '.tsx'],
  },
  {
    id: 'supabase-rls-disabled',
    category: 'authorization',
    severity: 'critical',
    title: 'Supabase Table with Row Level Security Disabled',
    description:
      'A table has Row Level Security (RLS) explicitly disabled. Without RLS, any user with database access (including via the anon key) can read or modify all rows in the table, bypassing any application-level access controls.',
    fix: 'Enable RLS on all tables: ALTER TABLE table_name ENABLE ROW LEVEL SECURITY. Then create appropriate policies to restrict access to authorized users only.',
    pattern: /ALTER\s+TABLE\s+\S+\s+DISABLE\s+ROW\s+LEVEL\s+SECURITY/gim,
    fileTypes: ['.sql'],
  },
]
