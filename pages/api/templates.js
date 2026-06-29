import fs from 'fs';
import path from 'path';

const FILE = path.join(process.cwd(), 'templates.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return []; }
}

function save(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function uid() {
  return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export default function handler(req, res) {
  if (req.method === 'GET') {
    return res.json(load());
  }

  if (req.method === 'POST') {
    const { name, description = '', content } = req.body;
    if (!name || !content) return res.status(400).json({ error: 'name and content required' });
    const templates = load();
    const tpl = { id: uid(), name, description, content, createdAt: new Date().toISOString() };
    templates.push(tpl);
    save(templates);
    return res.json(tpl);
  }

  if (req.method === 'PUT') {
    const { id, name, description, content } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const templates = load().map(t => t.id === id ? { ...t, name, description, content } : t);
    save(templates);
    return res.json(templates.find(t => t.id === id));
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    const templates = load().filter(t => t.id !== id);
    save(templates);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
