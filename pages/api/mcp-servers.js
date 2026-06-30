import fs from 'fs';
import path from 'path';

const MCPJUNGLE_URL = process.env.MCPJUNGLE_URL || 'http://localhost:8080';
const CONFIG_FILE = path.join(process.cwd(), 'mcp-config.json');

function readLocalConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
  catch { return { mcpServers: {} }; }
}

// Normalize a MCPJungle server object to the shape the rest of the app expects
function normalize(s) {
  const base = { _enabled: s.enabled !== false, _transport: s.transport || '', _description: s.description || '' };
  if (s.transport === 'stdio') {
    return { command: s.command || '', args: s.args || [], env: s.env || {}, ...base };
  }
  return { type: 'sse', url: s.url || '', ...base };
}

async function jungle(path, options) {
  return fetch(`${MCPJUNGLE_URL}${path}`, {
    signal: AbortSignal.timeout(4000),
    ...options,
  });
}

export default async function handler(req, res) {

  // ── GET: list servers from MCPJungle ──────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const r = await jungle('/api/v0/servers');
      if (!r.ok) throw new Error(`MCPJungle ${r.status}`);
      const body = await r.json();
      const list = Array.isArray(body) ? body : (body.servers || []);
      const mcpServers = {};
      for (const s of list) mcpServers[s.name] = normalize(s);
      return res.json({ mcpServers, connected: true });
    } catch {
      // Fallback: return local mcp-config entries (minus internal ones)
      const local = readLocalConfig();
      const mcpServers = {};
      for (const [k, v] of Object.entries(local.mcpServers || {})) {
        if (k !== 'aiops' && k !== 'mcpjungle') mcpServers[k] = v;
      }
      return res.json({ mcpServers, connected: false });
    }
  }

  // ── POST: register a server with MCPJungle ────────────────────────────────
  if (req.method === 'POST') {
    const { name, transport, url, command, args, description, bearerToken, env } = req.body;
    if (!name?.trim() || !transport) {
      return res.status(400).json({ error: 'name and transport are required' });
    }
    const body = { name: name.trim(), transport, description: description || '' };
    if (transport === 'stdio') {
      body.command = command || '';
      body.args = Array.isArray(args) ? args : String(args || '').split(/\s+/).filter(Boolean);
      const envObj = env && typeof env === 'object' ? env : {};
      if (Object.keys(envObj).length) body.env = envObj;
    } else {
      body.url = url || '';
      if (bearerToken?.trim()) body.bearer_token = bearerToken.trim();
    }
    try {
      const r = await jungle('/api/v0/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        return res.status(r.status).json({ error: txt || 'MCPJungle registration failed' });
      }
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── DELETE ?name=: deregister a server ────────────────────────────────────
  if (req.method === 'DELETE') {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'name query param required' });
    try {
      const r = await jungle(`/api/v0/servers/${encodeURIComponent(name)}`, { method: 'DELETE' });
      if (!r.ok) return res.status(r.status).json({ error: 'Deregistration failed' });
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── PATCH: enable / disable a server ─────────────────────────────────────
  if (req.method === 'PATCH') {
    const { name, action } = req.body; // action: 'enable' | 'disable'
    if (!name || !['enable', 'disable'].includes(action)) {
      return res.status(400).json({ error: 'name and action (enable|disable) required' });
    }
    try {
      const r = await jungle(`/api/v0/servers/${encodeURIComponent(name)}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!r.ok) return res.status(r.status).json({ error: `${action} failed` });
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
}
