import { Storage } from '@google-cloud/storage';
import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'crypto';

const sql = neon(process.env.DATABASE_URL);

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

function decodeToken(token) {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    if (decoded.exp < Date.now()) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

async function verifyAdminAuth(token) {
  if (!token) return { authorized: false };

  const decoded = decodeToken(token);
  if (!decoded || !decoded.id) {
    return { authorized: false };
  }

  const adminCheck = await sql`SELECT id, 'admin' as type FROM admin_users WHERE id = ${decoded.id}`;
  if (adminCheck.length > 0) {
    return { authorized: true, type: 'admin', id: adminCheck[0].id };
  }

  const staffCheck = await sql`
    SELECT id, role, permissions, is_active 
    FROM admin_staff 
    WHERE id = ${decoded.id} AND is_active = true
  `;
  if (staffCheck.length > 0) {
    return { 
      authorized: true, 
      type: 'staff', 
      id: staffCheck[0].id,
      role: staffCheck[0].role,
      permissions: staffCheck[0].permissions || []
    };
  }

  return { authorized: false };
}

function hasPermission(auth, requiredPermission) {
  if (auth.type === 'admin') return true;
  if (auth.role === 'admin') return true;
  return auth.permissions?.includes(requiredPermission) || false;
}

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

  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let auth;
  try {
    auth = await verifyAdminAuth(token);
    if (!auth.authorized) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!hasPermission(auth, 'settings:write')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  try {
    const { name, contentType } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Missing file name' });
    }

    const publicSearchPaths = process.env.PUBLIC_OBJECT_SEARCH_PATHS || '';
    const paths = publicSearchPaths.split(',').map(p => p.trim()).filter(p => p);
    
    if (paths.length === 0) {
      return res.status(500).json({ error: 'Object storage not configured' });
    }

    const basePath = paths[0];
    const pathParts = basePath.split('/').filter(p => p);
    const bucketName = pathParts[0];
    
    const fileId = randomUUID();
    const ext = name.split('.').pop() || 'jpg';
    const objectName = `ad-images/${fileId}.${ext}`;

    const uploadURL = await signObjectURL({
      bucketName,
      objectName,
      method: 'PUT',
      ttlSec: 900,
    });

    const publicURL = `https://storage.googleapis.com/${bucketName}/${objectName}`;

    return res.status(200).json({
      uploadURL,
      publicURL,
      objectPath: `/${bucketName}/${objectName}`,
    });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    return res.status(500).json({ error: 'Failed to generate upload URL' });
  }
}
