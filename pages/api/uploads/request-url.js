import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'crypto';

const REPLIT_SIDECAR_ENDPOINT = 'http://127.0.0.1:1106';

const storage = new Storage({
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

async function signObjectURL({ bucketName, objectName, method, ttlSec }) {
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, size, contentType } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing required field: name' });
    }

    const privateObjectDir = process.env.PRIVATE_OBJECT_DIR || '';
    if (!privateObjectDir) {
      return res.status(500).json({ error: 'Object storage not configured' });
    }

    const objectId = randomUUID();
    const ext = name.split('.').pop() || '';
    const objectName = `uploads/avatars/${objectId}${ext ? '.' + ext : ''}`;
    
    const parts = privateObjectDir.split('/').filter(Boolean);
    const bucketName = parts[0];
    const fullObjectName = parts.slice(1).join('/') + '/' + objectName;

    const uploadURL = await signObjectURL({
      bucketName,
      objectName: fullObjectName,
      method: 'PUT',
      ttlSec: 900,
    });

    const objectPath = `/objects/${objectName}`;

    res.json({
      uploadURL,
      objectPath,
      metadata: { name, size, contentType },
    });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
}
