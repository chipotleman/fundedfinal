import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import {
  describeObjectStorageMisconfig,
  describeStorageEnvSnapshot,
  probeSidecarReachability,
  signObjectURL,
  resolvePrivateObjectPath,
  REPLIT_SIDECAR_ENDPOINT,
} from '../../../lib/objectStorage';

// Authenticated, read-only diagnostic endpoint.
//
// Why this exists: when the live site stops being able to sign uploads,
// the only signal users see is the "Voice storage is temporarily
// unavailable" toast. Reaching this endpoint while signed in returns
// the exact same redacted snapshot that gets written to the deployment
// logs (env-var presence by length, sidecar host, and whether a no-op
// signing call against the sidecar actually succeeds end-to-end), so a
// single curl tells the operator which leg is broken without waiting
// on log delivery or recording a real voice note.
//
// Notes on safety:
// - Auth required (session check) so anonymous callers can't enumerate.
// - Env values are NEVER returned, only their presence + length.
// - The probe is GET-only against `${SIDECAR}/token` and the sign call
//   is for a synthetic object name; no bytes are written.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const envSnapshot = describeStorageEnvSnapshot();
  const misconfig = describeObjectStorageMisconfig();
  const sidecar = await probeSidecarReachability();

  let signProbe = { attempted: false };
  if (misconfig.blocking.length === 0 && sidecar.ok) {
    const subPath = `uploads/health/__probe__/${Date.now()}.bin`;
    const resolved = resolvePrivateObjectPath(subPath);
    if (!resolved) {
      signProbe = {
        attempted: true,
        ok: false,
        reason: 'resolvePrivateObjectPath returned null',
      };
    } else {
      try {
        await signObjectURL({
          bucketName: resolved.bucketName,
          objectName: resolved.objectName,
          method: 'PUT',
          ttlSec: 60,
        });
        signProbe = { attempted: true, ok: true };
      } catch (err) {
        signProbe = {
          attempted: true,
          ok: false,
          code: err?.code || 'unknown',
          status: err?.status || null,
          reason: err?.message || String(err),
        };
      }
    }
  }

  const overallOk =
    misconfig.blocking.length === 0 &&
    sidecar.ok &&
    (signProbe.attempted ? signProbe.ok : true);

  // Mirror the result into the deployment logs so an operator who is
  // already tailing logs can see the health-check outcome without having
  // to inspect the response body. The same redacted snapshot is appended
  // for consistency with the existing failure logs.
  if (overallOk) {
    console.log(
      `[uploads/health] ok | sidecar=${REPLIT_SIDECAR_ENDPOINT} sidecar_status=${sidecar.status} sign=${signProbe.attempted ? 'ok' : 'skipped'} | ${envSnapshot}`
    );
  } else {
    console.error(
      `[uploads/health] degraded | blocking=${misconfig.blocking.join(',') || 'none'} sidecar_ok=${sidecar.ok} sign=${signProbe.attempted ? (signProbe.ok ? 'ok' : `failed:${signProbe.code || ''}`) : 'skipped'} | ${envSnapshot}`
    );
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(overallOk ? 200 : 503).json({
    ok: overallOk,
    envSnapshot,
    misconfig,
    sidecar,
    signProbe,
  });
}
