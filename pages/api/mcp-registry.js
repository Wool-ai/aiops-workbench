const SMITHERY = 'https://registry.smithery.ai';

export default async function handler(req, res) {
  const { q = '', page = 1, detail } = req.query;

  try {
    if (detail) {
      // Fetch full server info including connections / configSchema
      const r = await fetch(`${SMITHERY}/servers/${encodeURIComponent(detail)}`, {
        headers: { Accept: 'application/json' },
      });
      if (!r.ok) return res.status(r.status).json({ error: 'Not found' });
      const data = await r.json();
      return res.json(data);
    }

    // Search
    const url = `${SMITHERY}/servers?q=${encodeURIComponent(q)}&page=${page}&pageSize=20`;
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) return res.status(r.status).json({ error: 'Smithery error' });
    const data = await r.json();
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
