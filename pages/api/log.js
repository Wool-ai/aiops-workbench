import fs from 'fs';
import path from 'path';

const LOG_DIR = '/Users/<user>/Desktop/ai/ai-logs';

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { file } = req.query;

  // Sanitise: filename only, no path traversal
  if (!file || /[/\\.]/.test(file.replace(/\.log$/, ''))) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const logPath = path.join(LOG_DIR, file.endsWith('.log') ? file : file + '.log');

  try {
    const content = fs.readFileSync(logPath, 'utf8');
    res.status(200).json({ content });
  } catch {
    res.status(404).json({ error: 'Log not found' });
  }
}
