import { readSchedules, writeSchedules } from '../../lib/datastore.js';
import { computeNextRun } from '../../lib/scheduleUtils.js';
import { uidSchedule } from '../../lib/utils.js';

function load() {
  const schedules = readSchedules();
  return { schedules: Array.isArray(schedules) ? schedules : [] };
}

function save(data) {
  writeSchedules(data.schedules || []);
}

export default function handler(req, res) {
  const data = load();

  if (req.method === 'GET') {
    return res.json(data.schedules);
  }

  if (req.method === 'POST') {
    const body = req.body;
    const entry = {
      id: uidSchedule(),
      name: body.name || 'Untitled schedule',
      prompt: body.prompt || '',
      projectId: body.projectId || '',
      projectName: body.projectName || '',
      schedule: body.schedule,
      allowedTools: body.allowedTools || [],
      agentIds: body.agentIds || [],
      enabled: true,
      lastRun: null,
      nextRun: computeNextRun(body.schedule)?.toISOString() || null,
      runCount: 0,
    };
    data.schedules.push(entry);
    save(data);
    return res.status(201).json(entry);
  }

  if (req.method === 'PUT') {
    const { id, ...updates } = req.body;
    let updated = null;
    data.schedules = data.schedules.map(s => {
      if (s.id !== id) return s;
      const merged = { ...s, ...updates };
      if (updates.schedule) {
        merged.nextRun = computeNextRun(updates.schedule)?.toISOString() || s.nextRun;
      }
      updated = merged;
      return merged;
    });
    save(data);
    return res.json(updated);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    data.schedules = data.schedules.filter(s => s.id !== id);
    save(data);
    return res.status(204).end();
  }

  res.status(405).end();
}
