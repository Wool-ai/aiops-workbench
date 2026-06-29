import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'mcp-config.json');

function load() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
  catch { return { mcpServers: {} }; }
}

function save(data) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

export default function handler(req, res) {
  if (req.method === 'GET') {
    return res.json(load());
  }

  if (req.method === 'PUT') {
    const { mcpServers } = req.body;
    if (!mcpServers || typeof mcpServers !== 'object') {
      return res.status(400).json({ error: 'Invalid mcpServers payload' });
    }
    const data = { mcpServers };
    save(data);
    return res.json(data);
  }

  res.status(405).end();
}
