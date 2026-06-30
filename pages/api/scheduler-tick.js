import { readSchedules, writeSchedules } from '../../lib/datastore.js';
import { computeNextRun } from '../../lib/scheduleUtils.js';

function load() {
  const schedules = readSchedules();
  return { schedules: Array.isArray(schedules) ? schedules : [] };
}

function save(data) {
  writeSchedules(data.schedules || []);
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
