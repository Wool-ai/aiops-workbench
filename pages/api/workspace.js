import fs from 'fs';
import path from 'path';

const WORKSPACE_ROOT = path.join(process.cwd(), 'workspace');
const INSTRUCTIONS_FILE = 'instructions.md';
const IGNORED = new Set(['README.md', '.gitkeep', 'buckets']);

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
  const params = req.method === 'GET' || req.method === 'DELETE' ? req.query : req.body;
  const { projectId, bucketName, filename } = params;

  if (!projectId) return res.status(400).json({ error: 'projectId required' });

  const dir = resolveDir(projectId, bucketName);

  if (req.method === 'GET') {
    fs.mkdirSync(dir, { recursive: true });
    const instructionsPath = path.join(dir, INSTRUCTIONS_FILE);
    const instructions = fs.existsSync(instructionsPath)
      ? fs.readFileSync(instructionsPath, 'utf8')
      : '';
    const files = fs.readdirSync(dir)
      .filter(f => f !== INSTRUCTIONS_FILE && !IGNORED.has(f) && !f.startsWith('.'))
      .map(f => {
        const stat = fs.statSync(path.join(dir, f));
        return { name: f, size: stat.size, mtime: stat.mtimeMs };
      });
    return res.status(200).json({ instructions, files, projectDir: dir });
  }

  if (req.method === 'POST') {
    const { instructions } = req.body;
    if (instructions === undefined) return res.status(400).json({ error: 'instructions required' });
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, INSTRUCTIONS_FILE), instructions, 'utf8');
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    if (!filename) return res.status(400).json({ error: 'filename required' });
    const safe = path.basename(filename);
    if (safe === INSTRUCTIONS_FILE || IGNORED.has(safe)) {
      return res.status(400).json({ error: 'Cannot delete this file via this endpoint' });
    }
    const filePath = path.join(dir, safe);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
