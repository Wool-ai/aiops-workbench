import { useState, useEffect, useRef } from 'react';
import { ASSIGNEES } from '../lib/data';
import styles from '../styles/DailyView.module.css';

const HOUR_START = 6;
const HOUR_END = 22;
const HOUR_H = 72;
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);

function fmtHour(h) {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function toKey(d) { return d.toISOString().slice(0, 10); }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function sameDay(a, b) { return toKey(a) === toKey(b); }
function isWeekend(d) { const w = d.getDay(); return w === 0 || w === 6; }

function occursOn(task, date) {
  if (task.days === 'both') return true;
  if (task.days === 'weekend') return isWeekend(date);
  return !isWeekend(date);
}

function doneOn(task, date) {
  return (task.completedDates || []).includes(toKey(date));
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// ── Task edit panel ──────────────────────────────────────────────────────────

function TaskEditPanel({ task, onSave, onDelete, onClose }) {
  const isNew = !task.id;
  const [form, setForm] = useState({
    name: task.name || '',
    desc: task.desc || '',
    time: task.time || '09:00',
    days: task.days || 'weekday',
    assignee: task.assignee || '',
  });

  const setF = k => e => setForm(f => ({ ...f, [k]: typeof e === 'string' ? e : e.target.value }));

  function handleSave() {
    if (!form.name.trim()) return;
    onSave({ ...task, ...form, id: task.id || ('dt' + Date.now()) });
  }

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.editPanel}>
        <div className={styles.epHead}>
          <span className={styles.epTitle}>{isNew ? 'New recurring task' : 'Edit recurring task'}</span>
          <button className={styles.epClose} onClick={onClose} aria-label="Close">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className={styles.epBody}>
          <div className={styles.fg}>
            <label className={styles.fl}>Task name</label>
            <input
              className={styles.fi}
              value={form.name}
              onChange={setF('name')}
              placeholder="e.g. Morning standup"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose(); }}
            />
          </div>

          <div className={styles.fg}>
            <label className={styles.fl}>Description</label>
            <textarea
              className={styles.ft}
              value={form.desc}
              onChange={setF('desc')}
              placeholder="Optional notes…"
              rows={2}
            />
          </div>

          <div className={styles.frow}>
            <div className={styles.fg}>
              <label className={styles.fl}>Time</label>
              <input className={styles.fi} type="time" value={form.time} onChange={setF('time')} />
            </div>
            <div className={styles.fg}>
              <label className={styles.fl}>Assignee</label>
              <select className={styles.fsel} value={form.assignee} onChange={setF('assignee')}>
                <option value="">Unassigned</option>
                <option value="AI">AI (Claude)</option>
                {ASSIGNEES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          <div className={styles.fg}>
            <label className={styles.fl}>Recurs on</label>
            <div className={styles.dayPicker}>
              {[['weekday','Weekdays'],['weekend','Weekends'],['both','Every day']].map(([v, l]) => (
                <button
                  key={v}
                  className={`${styles.dayOpt} ${form.days === v ? styles.dayOptOn : ''}`}
                  onClick={() => setForm(f => ({ ...f, days: v }))}
                >{l}</button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.epFoot}>
          {!isNew && <button className={styles.delBtn} onClick={onDelete}>Delete</button>}
          <div className={styles.spacer} />
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={!form.name.trim()}>
            {isNew ? 'Add task' : 'Save'}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Calendar task chip ────────────────────────────────────────────────────────

function CalendarChip({ task, date, onEdit, onToggle, onRunAI }) {
  const done = doneOn(task, date);
  const isAI = task.assignee === 'AI';

  return (
    <div className={`${styles.chip} ${isAI ? styles.chipAI : styles.chipHuman} ${done ? styles.chipDone : ''}`}>
      <button
        className={`${styles.chipDot} ${done ? styles.chipDotDone : ''}`}
        onClick={e => { e.stopPropagation(); onToggle(task, date); }}
        title={done ? 'Mark undone' : 'Mark done'}
      >
        {done && (
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
      </button>

      <div className={styles.chipContent} onClick={() => onEdit(task)}>
        <span className={styles.chipName}>{task.name}</span>
        <div className={styles.chipMeta}>
          {task.assignee && (
            <span className={`${styles.chipAssignee} ${isAI ? styles.chipAssigneeAI : ''}`}>
              {isAI && (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M17.66 6.34l1.42-1.42"/>
                </svg>
              )}
              {task.assignee}
            </span>
          )}
          <span className={styles.chipTime}>{task.time}</span>
        </div>
      </div>

      {isAI && !done && onRunAI && (
        <button
          className={styles.chipRun}
          onClick={e => { e.stopPropagation(); onRunAI(); }}
          title="Run with AI now"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        </button>
      )}
    </div>
  );
}

// ── Main DailyView ────────────────────────────────────────────────────────────

export default function DailyView({ dailyTasks = [], onSave, onDelete, onToggleDone, onRunWithAI }) {
  const todayBase = new Date();
  todayBase.setHours(0, 0, 0, 0);

  const [date, setDate] = useState(todayBase);
  const [editing, setEditing] = useState(null);
  const [nowPx, setNowPx] = useState(null);
  const [search, setSearch] = useState('');
  const gridRef = useRef(null);
  const scrolledRef = useRef(false);

  function calcNow() {
    const n = new Date();
    const mins = n.getHours() * 60 + n.getMinutes();
    const px = ((mins - HOUR_START * 60) / 60) * HOUR_H;
    return px >= 0 && px <= HOURS.length * HOUR_H ? px : null;
  }

  useEffect(() => {
    setNowPx(calcNow());
    const iv = setInterval(() => setNowPx(calcNow()), 60_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    scrolledRef.current = false;
  }, [date]);

  useEffect(() => {
    if (scrolledRef.current || !gridRef.current) return;
    const px = calcNow();
    if (px !== null) {
      gridRef.current.scrollTop = Math.max(0, px - 120);
      scrolledRef.current = true;
    }
  });

  const isToday = sameDay(date, todayBase);
  const weekend = isWeekend(date);

  const q = search.trim().toLowerCase();
  const matchSearch = t => !q || t.name.toLowerCase().includes(q) || (t.desc || '').toLowerCase().includes(q);

  const dayTasks = dailyTasks.filter(t => occursOn(t, date) && matchSearch(t));
  const doneTodayCount = dayTasks.filter(t => doneOn(t, date)).length;

  const byHour = {};
  for (const t of dayTasks) {
    const h = t.time ? parseInt(t.time, 10) : 9;
    (byHour[h] || (byHour[h] = [])).push(t);
  }

  const weekdayList = dailyTasks.filter(t => (t.days === 'weekday' || t.days === 'both') && matchSearch(t));
  const weekendList = dailyTasks.filter(t => (t.days === 'weekend' || t.days === 'both') && matchSearch(t));

  const dateLabel = `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;

  function goToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setDate(d);
  }

  return (
    <div className={styles.shell}>
      {/* ── Left: task list ── */}
      <aside className={styles.aside}>
        <div className={styles.asideHead}>
          <span className={styles.asideTitle}>Recurring Tasks</span>
          <button className={styles.addBtn} onClick={() => setEditing({})}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New
          </button>
        </div>

        <div className={styles.searchBar}>
          <input
            className={styles.searchInput}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tasks…"
            aria-label="Search daily tasks"
          />
          {search && (
            <button className={styles.clearSearch} onClick={() => setSearch('')} aria-label="Clear search">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        <div className={styles.asideScroll}>
          {[['weekday','Weekdays',weekdayList],['weekend','Weekends',weekendList]].map(([key, label, list]) => (
            <div key={key} className={styles.asideGroup}>
              <div className={styles.groupHead}>
                <span className={styles.groupLabel}>{label}</span>
                <span className={styles.groupCount}>{list.length}</span>
              </div>
              {list.length === 0 ? (
                <div className={styles.groupEmpty}>No tasks yet</div>
              ) : list.map(task => {
                const done = doneOn(task, date);
                const isAI = task.assignee === 'AI';
                return (
                  <div
                    key={task.id}
                    className={`${styles.tlRow} ${done ? styles.tlRowDone : ''}`}
                    onClick={() => setEditing(task)}
                  >
                    <button
                      className={`${styles.tlDot} ${done ? styles.tlDotDone : ''}`}
                      onClick={e => { e.stopPropagation(); onToggleDone(task, date); }}
                    >
                      {done && (
                        <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </button>
                    <div className={styles.tlInfo}>
                      <span className={styles.tlName}>{task.name}</span>
                      {task.assignee && (
                        <span className={`${styles.tlAssignee} ${isAI ? styles.tlAssigneeAI : ''}`}>
                          {task.assignee}
                        </span>
                      )}
                    </div>
                    <span className={styles.tlTime}>{task.time}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </aside>

      {/* ── Right: calendar ── */}
      <div className={styles.cal}>
        <div className={styles.calHead}>
          <div className={styles.dateNav}>
            <button className={styles.navArrow} onClick={() => setDate(d => addDays(d, -1))} title="Previous day">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <div className={styles.dateInfo}>
              <span className={styles.dateStr}>{dateLabel}</span>
              {!isToday && (
                <button className={styles.todayLink} onClick={goToday}>Today</button>
              )}
            </div>
            <button className={styles.navArrow} onClick={() => setDate(d => addDays(d, 1))} title="Next day">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>

          <div className={styles.calHeadRight}>
            <span className={`${styles.dayKind} ${weekend ? styles.dayKindWe : styles.dayKindWd}`}>
              {weekend ? 'Weekend' : 'Weekday'}
            </span>
            <span className={styles.dayStat}>
              {doneTodayCount}/{dayTasks.length} done
            </span>
          </div>
        </div>

        <div className={styles.calGrid} ref={gridRef}>
          <div className={styles.calInner}>
            {/* Current time line */}
            {isToday && nowPx !== null && (
              <div className={styles.nowLine} style={{ top: nowPx }}>
                <div className={styles.nowDot} />
                <div className={styles.nowBar} />
              </div>
            )}

            {HOURS.map(h => (
              <div key={h} className={styles.hourRow} style={{ minHeight: HOUR_H }}>
                <div className={styles.hourLabel}>{fmtHour(h)}</div>
                <div className={styles.hourSlot}>
                  {(byHour[h] || []).map(task => (
                    <CalendarChip
                      key={task.id}
                      task={task}
                      date={date}
                      onEdit={setEditing}
                      onToggle={onToggleDone}
                      onRunAI={task.assignee === 'AI' ? () => onRunWithAI(task) : null}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Edit panel ── */}
      {editing !== null && (
        <TaskEditPanel
          task={editing}
          onSave={t => { onSave(t); setEditing(null); }}
          onDelete={() => { if (editing.id) onDelete(editing.id); setEditing(null); }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
