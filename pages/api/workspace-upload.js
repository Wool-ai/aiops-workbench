import fs from 'fs';
import path from 'path';

const WORKSPACE_ROOT = path.join(process.cwd(), 'workspace');
const MAX_BYTES = 2 * 1024 * 1024;

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function resolveDir(projectId, bucketName) {
  const safeProject = projectId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (bucketName) {
    const safeBucket = slugify(bucketName);
    return path.join(WORKSPACE_ROOT, safeProject, 'buckets', safeBucket);
  }
  return path.join(WORKSPACE_ROOT, safeProject);
}

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { projectId, bucketName, filename, contentBase64 } = req.body;
  if (!projectId || !filename || !contentBase64) {
    return res.status(400).json({ error: 'projectId, filename, and contentBase64 required' });
  }

  const safeName = path.basename(filename);
  if (!safeName || safeName === 'instructions.md') {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const buf = Buffer.from(contentBase64, 'base64');
  if (buf.length > MAX_BYTES) {
    return res.status(413).json({ error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB)` });
  }

  const dir = resolveDir(projectId, bucketName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, safeName), buf);

  res.status(200).json({ ok: true, filename: safeName, size: buf.length });
}
