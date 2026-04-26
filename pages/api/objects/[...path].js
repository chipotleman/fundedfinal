import {
  getStorageClient,
  resolvePrivateObjectPath,
  contentTypeFromName,
  describeObjectStorageMisconfig,
  describeStorageEnvSnapshot,
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

  const envSnapshot = describeStorageEnvSnapshot();
  const resolved = resolvePrivateObjectPath(subPath);
  if (!resolved) {
    const misconfig = describeObjectStorageMisconfig();
    console.error(
      '[objects/serve] storage_not_configured — ' +
        (misconfig.blocking.length > 0
          ? misconfig.blocking.join('; ')
          : `resolvePrivateObjectPath returned null for subPath="${subPath}"`) +
        ' | ' + envSnapshot
    );
    if (misconfig.warnings.length > 0) {
      console.warn(
        '[objects/serve] object storage env warnings: ' +
          misconfig.warnings.join('; ') +
          ' | ' + envSnapshot
      );
    }
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
    // The reader hits the same sidecar as the writer — append the redacted
    // env snapshot so a streaming/credential failure here surfaces the same
    // diagnostic context as a sign failure on the writer side, and the next
    // production regression can be triaged from a single log line.
    console.error(
      '[objects/serve] read_failed — bucket=' + resolved.bucketName +
        ' object=' + resolved.objectName +
        ' code=' + (error?.code || 'unknown') +
        ' status=' + (error?.status || error?.statusCode || 'n/a') +
        ': ' + (error?.message || error) +
        ' | ' + envSnapshot
    );
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to load object' });
    }
    try { res.end(); } catch (_e) {}
  }
}
