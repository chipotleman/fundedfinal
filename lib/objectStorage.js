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
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    }
  );
  if (!response.ok) {
    throw new Error(`Failed to sign object URL: ${response.status}`);
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
