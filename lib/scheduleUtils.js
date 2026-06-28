const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function computeNextRun(schedule, from = new Date()) {
  if (!schedule) return null;

  if (schedule.type === 'interval') {
    return new Date(from.getTime() + schedule.intervalMinutes * 60_000);
  }

  if (schedule.type === 'daily') {
    const [h, m] = (schedule.time || '09:00').split(':').map(Number);
    const next = new Date(from);
    next.setSeconds(0, 0);
    next.setHours(h, m);
    if (next <= from) next.setDate(next.getDate() + 1);
    return next;
  }

  if (schedule.type === 'weekly') {
    const [h, m] = (schedule.time || '09:00').split(':').map(Number);
    const targetDay = DAYS.indexOf(schedule.day || 'monday');
    const next = new Date(from);
    next.setSeconds(0, 0);
    next.setHours(h, m);
    let daysUntil = (targetDay - next.getDay() + 7) % 7;
    if (daysUntil === 0 && next <= from) daysUntil = 7;
    next.setDate(next.getDate() + daysUntil);
    return next;
  }

  return null;
}

export function describeSchedule(schedule) {
  if (!schedule) return '';
  if (schedule.type === 'interval') {
    const m = schedule.intervalMinutes;
    if (m < 60) return `Every ${m} minute${m !== 1 ? 's' : ''}`;
    const h = m / 60;
    if (Number.isInteger(h)) return `Every ${h} hour${h !== 1 ? 's' : ''}`;
    const hrs = Math.floor(h);
    const mins = m % 60;
    return `Every ${hrs}h ${mins}m`;
  }
  if (schedule.type === 'daily') return `Daily at ${schedule.time}`;
  if (schedule.type === 'weekly') {
    const day = schedule.day ? schedule.day.charAt(0).toUpperCase() + schedule.day.slice(1) : 'Monday';
    return `Weekly on ${day} at ${schedule.time}`;
  }
  return '';
}
