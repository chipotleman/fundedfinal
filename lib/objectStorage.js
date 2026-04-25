import { Storage } from '@google-cloud/storage';

const REPLIT_SIDECAR_ENDPOINT = 'http://127.0.0.1:1106';

let cachedStorage = null;

export function getStorageClient() {
  if (cachedStorage) return cachedStorage;
  cachedStorage = new Storage({
    credentials: {
      audience: 'replit',
      subject_token_type: 'access_token',
      token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
      type: 'external_account',
      credential_source: {
        url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
        format: {
          type: 'json',
          subject_token_field_name: 'access_token',
        },
      },
      universe_domain: 'googleapis.com',
    },
    projectId: '',
  });
  return cachedStorage;
}

export async function signObjectURL({ bucketName, objectName, method, ttlSec }) {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  let response;
  try {
    response = await fetch(
      `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      }
    );
  } catch (err) {
    // Network-level failure reaching the sidecar (commonly: sidecar not
    // running in this environment). Re-throw with a tagged message so
    // callers can distinguish this from a 4xx/5xx response.
    const tagged = new Error(
      `Object storage sidecar unreachable at ${REPLIT_SIDECAR_ENDPOINT}: ${err?.message || err}`
    );
    tagged.cause = err;
    tagged.code = 'sidecar_unreachable';
    throw tagged;
  }
  if (!response.ok) {
    let body = '';
    try { body = (await response.text()).slice(0, 500); } catch (_e) {}
    const tagged = new Error(
      `Failed to sign object URL: ${response.status} ${response.statusText}` +
        (body ? ` — ${body}` : '')
    );
    tagged.code = 'sign_failed';
    tagged.status = response.status;
    throw tagged;
  }
  const { signed_url } = await response.json();
  return signed_url;
}

/**
 * Resolve a stored "/objects/<subpath>" reference against PRIVATE_OBJECT_DIR.
 * Returns { bucketName, objectName } or null if storage isn't configured.
 */
export function resolvePrivateObjectPath(subPath) {
  const privateObjectDir = process.env.PRIVATE_OBJECT_DIR || '';
  if (!privateObjectDir) return null;
  const parts = privateObjectDir.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  const bucketName = parts[0];
  const prefix = parts.slice(1).join('/');
  const cleaned = String(subPath || '')
    .replace(/^\/+/, '')
    .replace(/\.\.+/g, '');
  if (!cleaned) return null;
  const objectName = prefix ? `${prefix}/${cleaned}` : cleaned;
  return { bucketName, objectName };
}

/**
 * Diagnose object-storage configuration.
 *
 * Returns `{ blocking, warnings }`:
 *  - `blocking`: problems that genuinely prevent signing/serving uploaded
 *    objects (PRIVATE_OBJECT_DIR missing/blank/unparseable). Callers
 *    should fail fast when this is non-empty.
 *  - `warnings`: env vars that are normally provided by the Replit Object
 *    Storage integration but aren't strictly required for signing private
 *    uploads. Logged for context so a partial misconfiguration is still
 *    visible in deployment logs.
 */
export function describeObjectStorageMisconfig() {
  const blocking = [];
  const warnings = [];
  const priv = process.env.PRIVATE_OBJECT_DIR || '';
  if (!priv.trim()) {
    blocking.push(
      priv === ''
        ? 'PRIVATE_OBJECT_DIR is not set'
        : 'PRIVATE_OBJECT_DIR is set but blank'
    );
  } else {
    const parts = priv.split('/').map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) {
      blocking.push(`PRIVATE_OBJECT_DIR has no usable bucket segment ("${priv}")`);
    }
  }
  if (!process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID) {
    warnings.push('DEFAULT_OBJECT_STORAGE_BUCKET_ID is not set');
  }
  if (!process.env.PUBLIC_OBJECT_SEARCH_PATHS) {
    warnings.push('PUBLIC_OBJECT_SEARCH_PATHS is not set');
  }
  return { blocking, warnings };
}

export function contentTypeFromName(name) {
  const ext = String(name || '').toLowerCase().split('.').pop();
  switch (ext) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'svg': return 'image/svg+xml';
    case 'mp3': return 'audio/mpeg';
    case 'm4a': return 'audio/mp4';
    case 'wav': return 'audio/wav';
    case 'webm': return 'audio/webm';
    case 'ogg': return 'audio/ogg';
    default: return 'application/octet-stream';
  }
}
