const MCPJUNGLE_URL = process.env.MCPJUNGLE_URL || 'http://localhost:8080';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { q = '' } = req.query;

  try {
    const r = await fetch(`${MCPJUNGLE_URL}/api/v0/tools`, {
      signal: AbortSignal.timeout(4000),
      headers: { Accept: 'application/json' },
    });
    if (!r.ok) return res.status(r.status).json({ tools: [], error: `MCPJungle returned ${r.status}` });
    const body = await r.json();
    const tools = Array.isArray(body) ? body : (body.tools || []);
    const filtered = q
      ? tools.filter(t =>
          (t.name || '').toLowerCase().includes(q.toLowerCase()) ||
          (t.description || '').toLowerCase().includes(q.toLowerCase())
        )
      : tools;
    return res.json({ tools: filtered, total: filtered.length });
  } catch (e) {
    return res.status(500).json({ tools: [], error: e.message });
  }
}
