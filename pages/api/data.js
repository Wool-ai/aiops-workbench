import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data.json');

export default function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      res.status(200).json(JSON.parse(raw));
    } catch {
      res.status(200).json({ projects: [] });
    }
    return;
  }

  if (req.method === 'PUT') {
    try {
      const existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '{}');
      const merged = {
        ...existing,
        ...(req.body.projects !== undefined && { projects: req.body.projects }),
        ...(req.body.notifications !== undefined && { notifications: req.body.notifications }),
        ...(req.body.dailyTasks !== undefined && { dailyTasks: req.body.dailyTasks }),
        ...(req.body.reminders !== undefined && { reminders: req.body.reminders }),
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(merged, null, 2), 'utf8');
      res.status(200).json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
    return;
  }

  res.status(405).end();
}
