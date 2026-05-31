import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';

// Authenticated, read-only diagnostic endpoint for the Vercel Blob
// upload path. The old Replit-sidecar probe is gone now that uploads
// go through `@vercel/blob/client` `handleUpload` — there's no sidecar
// to ping. The only server-side prerequisite is `BLOB_READ_WRITE_TOKEN`.
//
// Returns 200 with `{ ok: true }` when the token is present, otherwise
// 503 with `{ ok: false, code: 'storage_not_configured' }` so a single
// `curl` (or the `reportUploadFailure` console dump) reveals the cause
// without a deployment-log dive.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const hasToken = !!process.env.BLOB_READ_WRITE_TOKEN;
  res.setHeader('Cache-Control', 'no-store');
  if (!hasToken) {
    console.error(
      '[uploads/health] storage_not_configured — BLOB_READ_WRITE_TOKEN is not set'
    );
    return res.status(503).json({
      ok: false,
      code: 'storage_not_configured',
      message:
        'BLOB_READ_WRITE_TOKEN is not set on the deployment. Create a Blob store in the Vercel dashboard and add the token.',
    });
  }
  return res.status(200).json({ ok: true, provider: 'vercel-blob' });
}
