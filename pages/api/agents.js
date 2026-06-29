import fs from 'fs';
import path from 'path';

const FILE = path.join(process.cwd(), 'agents.json');

function uid() {
  return 'ag' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return []; }
}

function save(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

export default function handler(req, res) {
  if (req.method === 'GET') {
    return res.json(load());
  }

  if (req.method === 'POST') {
    const { name, description = '', role = 'custom', model = 'claude-sonnet-4-6', systemPrompt = '', allowedTools = [], useMcp = true } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const agents = load();
    const agent = { id: uid(), name, description, role, model, systemPrompt, allowedTools, useMcp, createdAt: new Date().toISOString() };
    agents.push(agent);
    save(agents);
    return res.status(201).json(agent);
  }

  if (req.method === 'PUT') {
    const { id, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const agents = load().map(a => a.id === id ? { ...a, ...updates } : a);
    save(agents);
    return res.json(agents.find(a => a.id === id));
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    save(load().filter(a => a.id !== id));
    return res.json({ ok: true });
  }

  res.status(405).end();
}
