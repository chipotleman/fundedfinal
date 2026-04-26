import { Storage } from '@google-cloud/storage';

// Replit Object Storage sidecar (loopback). Override via env if Replit
// ever moves the port.
export const REPLIT_SIDECAR_ENDPOINT =
  (process.env.REPLIT_OBJECT_STORAGE_SIDECAR || '').trim() ||
  'http://127.0.0.1:1106';

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
    const tagged = new Error(
      `Object storage sidecar unreachable at ${REPLIT_SIDECAR_ENDPOINT}: ${err?.message || err}`
    );
    tagged.cause = err;
    tagged.code = 'sidecar_unreachable';
    throw tagged;
  }
  if (!response.ok) {
    let body = '';
    try {
      body = (await response.text()).slice(0, 500);
    } catch {
      body = '';
    }
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
 * Resolve the effective PRIVATE_OBJECT_DIR. Prefers the explicit env var,
 * falls back to `<DEFAULT_OBJECT_STORAGE_BUCKET_ID>/.private` (the
 * integration's documented convention) so uploads still succeed if a
 * deployment received the bucket id but not the explicit private dir.
 * Returns '' if neither is usable.
 */
export function resolveEffectivePrivateObjectDir() {
  const explicit = (process.env.PRIVATE_OBJECT_DIR || '').trim();
  if (explicit) return explicit;
  const bucket = (process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || '').trim();
  if (!bucket) return '';
  return `/${bucket.replace(/^\/+/, '')}/.private`;
}

/**
 * Resolve a stored "/objects/<subpath>" reference against the effective
 * private dir. Returns { bucketName, objectName } or null.
 */
export function resolvePrivateObjectPath(subPath) {
  const privateObjectDir = resolveEffectivePrivateObjectDir();
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
 * Returns `{ blocking, warnings }`. `blocking` is non-empty only when no
 * usable private dir can be resolved (neither PRIVATE_OBJECT_DIR nor a
 * bucket-id fallback). `warnings` covers partial/non-blocking issues.
 */
export function describeObjectStorageMisconfig() {
  const blocking = [];
  const warnings = [];
  const priv = process.env.PRIVATE_OBJECT_DIR || '';
  const bucketId = (process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || '').trim();
  const effective = resolveEffectivePrivateObjectDir();
  if (!priv.trim()) {
    if (effective) {
      warnings.push(
        priv === ''
          ? 'PRIVATE_OBJECT_DIR is not set (using DEFAULT_OBJECT_STORAGE_BUCKET_ID/.private fallback)'
          : 'PRIVATE_OBJECT_DIR is set but blank (using DEFAULT_OBJECT_STORAGE_BUCKET_ID/.private fallback)'
      );
    } else {
      blocking.push(
        priv === ''
          ? 'PRIVATE_OBJECT_DIR is not set and no DEFAULT_OBJECT_STORAGE_BUCKET_ID fallback available'
          : 'PRIVATE_OBJECT_DIR is set but blank and no DEFAULT_OBJECT_STORAGE_BUCKET_ID fallback available'
      );
    }
  } else {
    const parts = priv.split('/').map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) {
      blocking.push(`PRIVATE_OBJECT_DIR has no usable bucket segment ("${priv}")`);
    }
  }
  if (!bucketId) warnings.push('DEFAULT_OBJECT_STORAGE_BUCKET_ID is not set');
  if (!process.env.PUBLIC_OBJECT_SEARCH_PATHS) warnings.push('PUBLIC_OBJECT_SEARCH_PATHS is not set');
  return { blocking, warnings };
}

/**
 * Single-line, redacted snapshot of storage-relevant env vars (lengths
 * only, never values) plus the resolved sidecar endpoint. Designed to be
 * appended to failure logs so a single line names the missing piece.
 */
export function describeStorageEnvSnapshot() {
  const fmt = (name) => {
    const v = process.env[name];
    if (v == null) return `${name}=missing`;
    if (v === '') return `${name}=blank`;
    return `${name}=set(${v.length})`;
  };
  const parts = [
    `sidecar=${REPLIT_SIDECAR_ENDPOINT}`,
    fmt('PRIVATE_OBJECT_DIR'),
    fmt('DEFAULT_OBJECT_STORAGE_BUCKET_ID'),
    fmt('PUBLIC_OBJECT_SEARCH_PATHS'),
  ];
  const deployId = process.env.REPLIT_DEPLOYMENT_ID || process.env.REPLIT_DEPLOYMENT || '';
  parts.push(`replit_deployment=${deployId ? 'yes' : 'no'}`);
  if (process.env.NODE_ENV) parts.push(`node_env=${process.env.NODE_ENV}`);
  return parts.join(' ');
}

/**
 * Active reachability probe for the sidecar. Short-timeout GET against
 * `/token` — any HTTP response (including 4xx/5xx) means the port is
 * open. Returns `{ ok, status, error }`. Never throws.
 */
export async function probeSidecarReachability({ timeoutMs = 2000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${REPLIT_SIDECAR_ENDPOINT}/token`, {
      method: 'GET',
      signal: controller.signal,
    });
    return { ok: true, status: res.status };
  } catch (err) {
    return {
      ok: false,
      status: null,
      error:
        err?.name === 'AbortError'
          ? `timeout after ${timeoutMs}ms`
          : err?.message || String(err),
    };
  } finally {
    clearTimeout(timer);
  }
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
