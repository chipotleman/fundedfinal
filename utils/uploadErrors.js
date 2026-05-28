// Shared client-side helpers for handling /api/uploads/request-url
// failures. Centralized so the avatar + banner flows (and any future
// upload flows) all surface the same diagnostic info instead of
// collapsing every failure mode into one generic "temporarily
// unavailable" toast — which made it impossible to tell from a user
// screenshot whether storage is misconfigured, the sidecar is
// unreachable, or signing itself is failing.

const CODE_HINTS = {
  storage_not_configured:
    'Object storage env vars are missing on the server (PRIVATE_OBJECT_DIR / DEFAULT_OBJECT_STORAGE_BUCKET_ID).',
  storage_sidecar_unreachable:
    'Server cannot reach the Replit Object Storage sidecar (127.0.0.1:1106).',
  storage_sign_failed:
    'Sidecar rejected the signing request — credentials or bucket may be wrong.',
};

// User-facing copy. We still show "temporarily unavailable" as the
// lead so the message stays calm, but we append a short hint + the
// diagnostic code so any screenshot of the toast tells us which leg
// is broken without needing to dig through deployment logs.
export function uploadFailureMessage(httpStatus, responseBody) {
  const code = responseBody?.code;
  if (code && CODE_HINTS[code]) {
    return (
      'Image uploads are temporarily unavailable. Please try again later.\n\n' +
      `Diagnostic: ${code}\n${CODE_HINTS[code]}`
    );
  }
  if (httpStatus === 401) return 'Please sign in again to upload images.';
  if (httpStatus === 503) {
    return (
      'Image uploads are temporarily unavailable. Please try again later.\n\n' +
      `Diagnostic: HTTP 503${code ? ` (${code})` : ''}`
    );
  }
  return (
    responseBody?.error ||
    `Could not start upload (HTTP ${httpStatus || 'unknown'}). Please try again.`
  );
}

// Best-effort diagnostic: when an upload fails, ping the authenticated
// health endpoint so the redacted env snapshot, sidecar reachability,
// and end-to-end sign probe land in the browser console. A screenshot
// of the console is then enough to triage. Never throws.
export async function reportUploadFailure(kind, httpStatus, responseBody) {
  if (typeof window === 'undefined') return;
  // eslint-disable-next-line no-console
  console.error(
    `[upload:${kind}] request-url failed`,
    { httpStatus, code: responseBody?.code, error: responseBody?.error }
  );
  try {
    const r = await fetch('/api/uploads/health', { credentials: 'include' });
    const body = await r.json().catch(() => ({}));
    // eslint-disable-next-line no-console
    console.error(`[upload:${kind}] /api/uploads/health -> ${r.status}`, body);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[upload:${kind}] /api/uploads/health unreachable`, err);
  }
}
