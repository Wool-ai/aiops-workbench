import { readAgents, writeAgents } from '../../lib/datastore.js';
import { uidAgent } from '../../lib/utils.js';

export default function handler(req, res) {
  if (req.method === 'GET') {
    return res.json(readAgents());
  }

  if (req.method === 'POST') {
    const { name, description = '', role = 'custom', model = 'claude-sonnet-4-6', systemPrompt = '', allowedTools = [], useMcp = true } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const agents = readAgents();
    const agent = { id: uidAgent(), name, description, role, model, systemPrompt, allowedTools, useMcp, createdAt: new Date().toISOString() };
    agents.push(agent);
    writeAgents(agents);
    return res.status(201).json(agent);
  }

  if (req.method === 'PUT') {
    const { id, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const agents = readAgents().map(a => a.id === id ? { ...a, ...updates } : a);
    writeAgents(agents);
    return res.json(agents.find(a => a.id === id));
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    writeAgents(readAgents().filter(a => a.id !== id));
    return res.json({ ok: true });
  }

  res.status(405).end();
}
