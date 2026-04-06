import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
const ScanCodeSchema = z.object({
    repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
    ref: z.string().default('main'),
    orgId: z.string().uuid(),
    userId: z.string(),
});
export const scanCodeFunction = onCall({
    timeoutSeconds: 300,
    memory: '512MiB',
    minInstances: 0,
    region: 'europe-west1',
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }
    const parseResult = ScanCodeSchema.safeParse(request.data);
    if (!parseResult.success) {
        throw new HttpsError('invalid-argument', 'Invalid scan parameters');
    }
    const { repo, ref, orgId, userId } = parseResult.data;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const githubToken = process.env.GITHUB_TOKEN;
    if (!supabaseUrl || !supabaseKey || !githubToken) {
        throw new HttpsError('internal', 'Server configuration error');
    }
    // Placeholder: full orchestrator wiring comes when build tooling
    // is set up to share domain code between Next.js and Cloud Functions
    return {
        status: 'queued',
        message: `Scan queued for ${repo}@${ref}`,
        scanId: 'placeholder',
    };
});
