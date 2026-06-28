import fs from 'fs';
import path from 'path';
import { computeNextRun } from '../../lib/scheduleUtils';

const FILE = path.join(process.cwd(), 'schedules.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return { schedules: [] }; }
}

function save(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

// Returns schedules that are due now, and advances their nextRun.
export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const data = load();
  const now = new Date();
  const due = [];

  data.schedules = data.schedules.map(s => {
    if (!s.enabled || !s.nextRun) return s;
    if (new Date(s.nextRun) > now) return s;
    due.push(s);
    return {
      ...s,
      lastRun: now.toISOString(),
      nextRun: computeNextRun(s.schedule, now)?.toISOString() || null,
      runCount: (s.runCount || 0) + 1,
    };
  });

  if (due.length > 0) save(data);

  res.json({ due });
}
