import { useState } from 'react';
import styles from '../styles/RemindersView.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDatetime(dt) {
  if (!dt) return { label: 'No date', time: '', overdue: false };
  const d   = new Date(dt);
  const now = new Date();
  const today    = new Date(now); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const dDay     = new Date(d);    dDay.setHours(0, 0, 0, 0);

  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const overdue = d < now;

  if (+dDay < +today) {
    const days = Math.round((+today - +dDay) / 86400000);
    return { label: days === 1 ? 'Yesterday' : `${days}d ago`, time, overdue };
  }
  if (+dDay === +today)     return { label: 'Today',    time, overdue };
  if (+dDay === +tomorrow)  return { label: 'Tomorrow', time, overdue: false };
  const label = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return { label, time, overdue: false };
}

function localDatetimeValue(isoOrDatetime) {
  if (!isoOrDatetime) return '';
  const d = new Date(isoOrDatetime);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Edit panel ────────────────────────────────────────────────────────────────

function ReminderEditPanel({ reminder, projects, onSave, onDelete, onClose }) {
  const isNew = !reminder.id;
  const [form, setForm] = useState({
    title:     reminder.title     || '',
    note:      reminder.note      || '',
    datetime:  reminder.datetime  ? localDatetimeValue(reminder.datetime) : '',
    projectId: reminder.projectId || '',
    taskId:    reminder.taskId    || '',
  });

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const projectTasks = form.projectId
    ? (projects.find(p => p.id === form.projectId)?.tasks || [])
    : [];

  function handleSave() {
    if (!form.title.trim() || !form.datetime) return;
    onSave({
      ...reminder,
      ...form,
      title: form.title.trim(),
      datetime: new Date(form.datetime).toISOString(),
      id: reminder.id || ('rem' + Date.now()),
      done: reminder.done || false,
    });
  }

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.editPanel}>
        <div className={styles.epHead}>
          <span className={styles.epTitle}>{isNew ? 'New reminder' : 'Edit reminder'}</span>
          <button className={styles.epClose} onClick={onClose}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className={styles.epBody}>
          <div className={styles.fg}>
            <label className={styles.fl}>Title</label>
            <input
              className={styles.fi}
              value={form.title}
              onChange={set('title')}
              placeholder="What do you need to remember?"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose(); }}
            />
          </div>

          <div className={styles.fg}>
            <label className={styles.fl}>Date &amp; time</label>
            <input
              className={styles.fi}
              type="datetime-local"
              value={form.datetime}
              onChange={set('datetime')}
            />
          </div>

          <div className={styles.fg}>
            <label className={styles.fl}>Note</label>
            <textarea
              className={styles.ft}
              value={form.note}
              onChange={set('note')}
              placeholder="Optional note…"
              rows={2}
            />
          </div>

          <div className={styles.fg}>
            <label className={styles.fl}>Link to project (optional)</label>
            <select className={styles.fsel} value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value, taskId: '' }))}>
              <option value="">No project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {projectTasks.length > 0 && (
            <div className={styles.fg}>
              <label className={styles.fl}>Link to task (optional)</label>
              <select className={styles.fsel} value={form.taskId} onChange={set('taskId')}>
                <option value="">No specific task</option>
                {projectTasks.map(t => <option key={t.id} value={t.id}>{t.name || 'Untitled'}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className={styles.epFoot}>
          {!isNew && <button className={styles.delBtn} onClick={onDelete}>Delete</button>}
          <div className={styles.spacer} />
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={!form.title.trim() || !form.datetime}>
            {isNew ? 'Add reminder' : 'Save'}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Reminder card ─────────────────────────────────────────────────────────────

function ReminderCard({ reminder, projects, onToggleDone, onEdit, onDelete }) {
  const { label, time, overdue } = fmtDatetime(reminder.datetime);
  const project = reminder.projectId ? projects.find(p => p.id === reminder.projectId) : null;
  const task    = project && reminder.taskId
    ? project.tasks.find(t => t.id === reminder.taskId)
    : null;

  return (
    <div className={`${styles.card} ${reminder.done ? styles.cardDone : ''} ${overdue && !reminder.done ? styles.cardOverdue : ''}`}>
      <button
        className={`${styles.check} ${reminder.done ? styles.checkDone : ''} ${overdue && !reminder.done ? styles.checkOverdue : ''}`}
        onClick={() => onToggleDone(reminder.id)}
        title={reminder.done ? 'Mark undone' : 'Mark done'}
      >
        {reminder.done && (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
      </button>

      <div className={styles.cardBody} onClick={() => onEdit(reminder)}>
        <div className={styles.cardTitle}>{reminder.title}</div>

        <div className={styles.cardMeta}>
          <span className={`${styles.dateChip} ${overdue && !reminder.done ? styles.dateChipOverdue : ''}`}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            {label} {time && `· ${time}`}
          </span>

          {project && (
            <span className={styles.projectChip}>
              {project.name}{task ? ` › ${task.name}` : ''}
            </span>
          )}
        </div>

        {reminder.note && <div className={styles.cardNote}>{reminder.note}</div>}
      </div>

      <button className={styles.deleteBtn} onClick={() => onDelete(reminder.id)} title="Delete">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

const FILTERS = [
  { id: 'all',      label: 'All' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'overdue',  label: 'Overdue' },
  { id: 'done',     label: 'Done' },
];

export default function RemindersView({ reminders = [], projects = [], selectedProjectId = '', onSave, onDelete, onToggleDone }) {
  const [filter, setFilter]   = useState('all');
  const [editing, setEditing] = useState(null);
  const [search, setSearch]   = useState('');

  const now = new Date();
  const q = search.trim().toLowerCase();

  const projectFiltered = selectedProjectId
    ? reminders.filter(r => r.projectId === selectedProjectId)
    : reminders;

  const counts = {
    all:      projectFiltered.length,
    upcoming: projectFiltered.filter(r => !r.done && new Date(r.datetime) >= now).length,
    overdue:  projectFiltered.filter(r => !r.done && new Date(r.datetime) <  now).length,
    done:     projectFiltered.filter(r =>  r.done).length,
  };

  const visible = projectFiltered
    .filter(r => {
      if (filter === 'upcoming' && (r.done || new Date(r.datetime) < now)) return false;
      if (filter === 'overdue'  && (r.done || new Date(r.datetime) >= now)) return false;
      if (filter === 'done'     && !r.done) return false;
      if (q) {
        const inTitle = r.title.toLowerCase().includes(q);
        const inNote  = (r.note || '').toLowerCase().includes(q);
        if (!inTitle && !inNote) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return new Date(a.datetime) - new Date(b.datetime);
    });

  return (
    <div className={styles.view}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          Reminders
        </div>
        <button className={styles.newBtn} onClick={() => setEditing({})}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New reminder
        </button>
      </div>

      <div className={styles.searchBar}>
        <input
          className={styles.searchInput}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search reminders…"
          aria-label="Search reminders"
        />
        {search && (
          <button className={styles.clearSearch} onClick={() => setSearch('')} aria-label="Clear search">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      <div className={styles.filters}>
        {FILTERS.map(f => (
          <button
            key={f.id}
            className={`${styles.filterBtn} ${filter === f.id ? styles.filterActive : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
            {counts[f.id] > 0 && (
              <span className={`${styles.badge} ${f.id === 'overdue' ? styles.badgeOverdue : ''}`}>
                {counts[f.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className={styles.empty}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.2 }}>
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span>
            {filter === 'all' ? 'No reminders yet.' : `No ${filter} reminders.`}
          </span>
        </div>
      ) : (
        <div className={styles.list}>
          {visible.map(r => (
            <ReminderCard
              key={r.id}
              reminder={r}
              projects={projects}
              onToggleDone={onToggleDone}
              onEdit={setEditing}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {editing !== null && (
        <ReminderEditPanel
          reminder={editing}
          projects={projects}
          onSave={r => { onSave(r); setEditing(null); }}
          onDelete={() => { if (editing.id) onDelete(editing.id); setEditing(null); }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
