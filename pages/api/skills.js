import fs from 'fs';
import path from 'path';
import os from 'os';

const PROJECT_DIR = path.join(process.cwd(), '.claude', 'commands');
const GLOBAL_DIR = path.join(os.homedir(), '.claude', 'commands');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readSkills(dir, scope) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const name = f.replace(/\.md$/, '');
      const content = fs.readFileSync(path.join(dir, f), 'utf8');
      return { name, scope, content };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function skillPath(scope, name) {
  const base = scope === 'global' ? GLOBAL_DIR : PROJECT_DIR;
  return path.join(base, `${name}.md`);
}

export default function handler(req, res) {
  if (req.method === 'GET') {
    return res.json({
      project: readSkills(PROJECT_DIR, 'project'),
      global: readSkills(GLOBAL_DIR, 'global'),
    });
  }

  if (req.method === 'POST') {
    const { name, scope = 'project', content = '' } = req.body;
    if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {
      return res.status(400).json({ error: 'Invalid skill name (alphanumeric, hyphens, underscores only)' });
    }
    const dir = scope === 'global' ? GLOBAL_DIR : PROJECT_DIR;
    ensureDir(dir);
    const fpath = path.join(dir, `${name}.md`);
    if (fs.existsSync(fpath)) return res.status(409).json({ error: 'Skill already exists' });
    fs.writeFileSync(fpath, content);
    return res.json({ name, scope, content });
  }

  if (req.method === 'PUT') {
    const { name, scope = 'project', content = '' } = req.body;
    if (!name) return res.status(400).json({ error: 'Missing name' });
    const dir = scope === 'global' ? GLOBAL_DIR : PROJECT_DIR;
    ensureDir(dir);
    fs.writeFileSync(path.join(dir, `${name}.md`), content);
    return res.json({ name, scope, content });
  }

  if (req.method === 'DELETE') {
    const { name, scope = 'project' } = req.query;
    const fpath = skillPath(scope, name);
    if (fs.existsSync(fpath)) fs.unlinkSync(fpath);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
