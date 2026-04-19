import {
  getStorageClient,
  resolvePrivateObjectPath,
  contentTypeFromName,
} from '../../../lib/objectStorage';

export const config = {
  api: {
    responseLimit: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const subPath = Array.isArray(req.query.path)
    ? req.query.path.join('/')
    : req.query.path || '';

  const resolved = resolvePrivateObjectPath(subPath);
  if (!resolved) {
    return res.status(500).json({ error: 'Object storage not configured' });
  }

  try {
    const storage = getStorageClient();
    const file = storage.bucket(resolved.bucketName).file(resolved.objectName);

    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ error: 'Not found' });
    }

    const [metadata] = await file.getMetadata();
    const contentType =
      metadata.contentType || contentTypeFromName(resolved.objectName);

    res.setHeader('Content-Type', contentType);
    if (metadata.size) {
      res.setHeader('Content-Length', String(metadata.size));
    }
    if (metadata.etag) {
      res.setHeader('ETag', metadata.etag);
    }
    res.setHeader('Cache-Control', 'public, max-age=3600, immutable');

    if (req.method === 'HEAD') {
      return res.status(200).end();
    }

    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch && metadata.etag && ifNoneMatch === metadata.etag) {
      return res.status(304).end();
    }

    await new Promise((resolve, reject) => {
      const stream = file.createReadStream();
      stream.on('error', reject);
      stream.on('end', resolve);
      stream.pipe(res);
    });
  } catch (error) {
    console.error('Error serving object:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to load object' });
    }
    try { res.end(); } catch (_e) {}
  }
}
