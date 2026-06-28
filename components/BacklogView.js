import { useState, useEffect, useRef } from 'react';
import Avatar from './Avatar';
import { COLUMN_LABELS, COLUMNS, PRIORITY_META } from '../lib/data';
import styles from '../styles/BacklogView.module.css';

/* ── Status chip with custom dropdown ─────────── */

function StatusChip({ col, onChange }) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });
  const chipRef = useRef(null);
  const dropRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e) {
      if (!chipRef.current?.contains(e.target) && !dropRef.current?.contains(e.target)) {
        setOpen(false);
      }
    }
    function onEsc(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  function handleToggle(e) {
    e.stopPropagation();
    if (!open && chipRef.current) {
      const rect = chipRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 5, left: rect.left });
    }
    setOpen(o => !o);
  }

  return (
    <div className={styles.statusChipWrap} onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
      <button
        ref={chipRef}
        className={`${styles.statusChip} ${styles['status_' + col]} ${open ? styles.statusChipOpen : ''}`}
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={styles.statusDot} />
        {COLUMN_LABELS[col]}
        <svg className={`${styles.statusChevron} ${open ? styles.statusChevronOpen : ''}`} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div ref={dropRef} className={styles.statusDropdown} style={{ top: dropPos.top, left: dropPos.left }} role="listbox">
          {COLUMNS.map(c => (
            <button
              key={c}
              role="option"
              aria-selected={c === col}
              className={`${styles.statusOption} ${c === col ? styles.statusOptionActive : ''}`}
              onClick={() => { onChange(c); setOpen(false); }}
            >
              <span className={`${styles.statusOptionDot} ${styles['optionDot_' + c]}`} />
              <span className={`${styles.statusOptionLabel} ${styles['optionLabel_' + c]}`}>{COLUMN_LABELS[c]}</span>
              {c === col && (
                <svg className={styles.checkIcon} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Priority chip ────────────────────────────── */

function PriorityChip({ priority }) {
  const p = priority || 'medium';
  const pm = PRIORITY_META[p];
  return (
    <span className={styles.priorityChip} style={{ color: pm.color, background: pm.bg }}>
      {pm.label}
    </span>
  );
}

/* ── Bucket section (collapsible) ─────────────── */

function BucketSection({ label, tasks, projectId, onTaskClick, onStatusChange, isUncategorized, onOpenWorkspace }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={styles.bucketSection}>
      <div className={styles.bucketHeader}>
        <button
          className={styles.bucketToggle}
          onClick={() => setCollapsed(c => !c)}
          aria-expanded={!collapsed}
        >
          <svg
            className={`${styles.bucketChevron} ${collapsed ? styles.bucketChevronCollapsed : ''}`}
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
          {isUncategorized ? (
            <span className={styles.bucketNameMuted}>{label}</span>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={styles.bucketIcon}>
                <path d="M22 12H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
              </svg>
              <span className={styles.bucketName}>{label}</span>
            </>
          )}
          <span className={styles.bucketCount}>{tasks.length}</span>
          <div className={styles.bucketRule} />
        </button>
        {!isUncategorized && onOpenWorkspace && (
          <button className={styles.bucketWorkspaceBtn} onClick={() => onOpenWorkspace(label)} title={`Workspace: ${label}`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
        )}
      </div>

      {!collapsed && (
        <div className={styles.bucketTasks}>
          {tasks.map(task => (
            <div
              key={task.id}
              className={styles.taskRow}
              onClick={() => onTaskClick(task, projectId)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && onTaskClick(task, projectId)}
            >
              <div className={`${styles.cell} ${styles.colName}`}>
                <span className={styles.taskName}>
                  {task.name || <em className={styles.untitled}>Untitled task</em>}
                </span>
                {task.desc && <span className={styles.taskDesc}>{task.desc}</span>}
              </div>
              <div className={`${styles.cell} ${styles.colPriority}`}>
                <PriorityChip priority={task.priority} />
              </div>
              <div className={`${styles.cell} ${styles.colStatus}`}>
                <StatusChip col={task.col} onChange={newCol => onStatusChange(task, projectId, newCol)} />
              </div>
              <div className={`${styles.cell} ${styles.colAssignee}`}>
                {task.assignee ? (
                  <span className={styles.assigneeCell}>
                    <Avatar name={task.assignee} size={18} />
                    <span className={styles.assigneeName}>{task.assignee}</span>
                  </span>
                ) : (
                  <span className={styles.none}>Unassigned</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Add bucket inline form ───────────────────── */

function AddBucketRow({ onAdd }) {
  const [active, setActive] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  function open() {
    setActive(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  }

  function submit() {
    const name = value.trim();
    if (name) onAdd(name);
    setValue('');
    setActive(false);
  }

  function cancel() {
    setValue('');
    setActive(false);
  }

  if (!active) {
    return (
      <button className={styles.addBucketTrigger} onClick={open}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Add bucket
      </button>
    );
  }

  return (
    <div className={styles.addBucketForm}>
      <input
        ref={inputRef}
        className={styles.addBucketInput}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') cancel(); }}
        placeholder="Bucket name…"
      />
      <button className={styles.addBucketSave} onClick={submit}>Add</button>
      <button className={styles.addBucketCancel} onClick={cancel}>Cancel</button>
    </div>
  );
}

/* ── Main export ──────────────────────────────── */

function groupByBucket(buckets, tasks) {
  const groups = [];
  for (const b of buckets) {
    const matched = tasks.filter(t => t.bucket === b);
    if (matched.length > 0) groups.push({ bucket: b, tasks: matched, isUncategorized: false });
  }
  const uncat = tasks.filter(t => !t.bucket || !buckets.includes(t.bucket));
  if (uncat.length > 0) groups.push({ bucket: 'No bucket', tasks: uncat, isUncategorized: true });
  return groups;
}

export default function BacklogView({ displayProjects, projects, onTaskClick, onAddTask, onStatusChange, onAddBucket, isFiltered, onOpenWorkspace }) {
  const anyTasks = displayProjects.some(p => p.tasks.length > 0);

  if (!anyTasks) {
    return (
      <div className={styles.empty}>
        {isFiltered ? 'No tasks match your filters.' : 'No tasks yet. Create a project and add tasks to get started.'}
      </div>
    );
  }

  return (
    <div className={styles.backlog}>
      {displayProjects.map((displayProject) => {
        const project = projects.find(p => p.id === displayProject.id);
        if (!project) return null;
        const tasks = displayProject.tasks;
        const hasBuckets = project.buckets && project.buckets.length > 0;
        const bucketGroups = hasBuckets ? groupByBucket(project.buckets, tasks) : null;

        return (
          <div key={project.id} className={styles.projectGroup}>
            {/* Project header */}
            <div className={styles.groupHeader}>
              <div className={styles.groupLeft}>
                <span className={styles.groupDot} style={{ background: project.color, boxShadow: `0 0 6px ${project.color}` }} />
                <span className={styles.groupName}>{project.name}</span>
                <span className={styles.groupCount}>{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
              </div>
              <div className={styles.groupActions}>
                {onOpenWorkspace && (
                  <button className={styles.workspaceBtn} onClick={() => onOpenWorkspace(project, null)} title="Project Workspace">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    Workspace
                  </button>
                )}
                {!isFiltered && (
                  <button className={styles.addTaskBtn} onClick={() => onAddTask(project.id)}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add task
                  </button>
                )}
              </div>
            </div>

            {/* Body */}
            {tasks.length === 0 ? (
              <div className={styles.groupEmpty}>
                {isFiltered ? 'No matches in this project.' : (
                  <button className={styles.groupEmptyBtn} onClick={() => onAddTask(project.id)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add a task
                  </button>
                )}
              </div>
            ) : hasBuckets ? (
              /* ── Bucket-grouped view ── */
              <div className={styles.bucketedBody}>
                {/* Column headings */}
                <div className={`${styles.colHeadings} ${styles.colHeadingsBucketed}`}>
                  <span className={`${styles.colHead} ${styles.colName}`}>Task</span>
                  <span className={`${styles.colHead} ${styles.colPriority}`}>Priority</span>
                  <span className={`${styles.colHead} ${styles.colStatus}`}>Status</span>
                  <span className={`${styles.colHead} ${styles.colAssignee}`}>Assignee</span>
                </div>
                {bucketGroups.map(({ bucket, tasks: bTasks, isUncategorized }) => (
                  <BucketSection
                    key={bucket}
                    label={bucket}
                    tasks={bTasks}
                    projectId={project.id}
                    onTaskClick={onTaskClick}
                    onStatusChange={onStatusChange}
                    isUncategorized={isUncategorized}
                    onOpenWorkspace={onOpenWorkspace ? (bucketName) => onOpenWorkspace(project, bucketName) : null}
                  />
                ))}
                {!isFiltered && (
                  <div className={styles.addBucketRow}>
                    <AddBucketRow onAdd={name => onAddBucket(project.id, name)} />
                  </div>
                )}
              </div>
            ) : (
              /* ── Flat view (no buckets) ── */
              <>
                <div className={styles.colHeadings}>
                  <span className={`${styles.colHead} ${styles.colName}`}>Task</span>
                  <span className={`${styles.colHead} ${styles.colPriority}`}>Priority</span>
                  <span className={`${styles.colHead} ${styles.colStatus}`}>Status</span>
                  <span className={`${styles.colHead} ${styles.colAssignee}`}>Assignee</span>
                </div>
                <div className={styles.taskList}>
                  {tasks.map(task => (
                    <div
                      key={task.id}
                      className={styles.taskRow}
                      onClick={() => onTaskClick(task, project.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && onTaskClick(task, project.id)}
                    >
                      <div className={`${styles.cell} ${styles.colName}`}>
                        <span className={styles.taskName}>
                          {task.name || <em className={styles.untitled}>Untitled task</em>}
                        </span>
                        {task.desc && <span className={styles.taskDesc}>{task.desc}</span>}
                      </div>
                      <div className={`${styles.cell} ${styles.colPriority}`}>
                        <PriorityChip priority={task.priority} />
                      </div>
                      <div className={`${styles.cell} ${styles.colStatus}`}>
                        <StatusChip col={task.col} onChange={newCol => onStatusChange(task, project.id, newCol)} />
                      </div>
                      <div className={`${styles.cell} ${styles.colAssignee}`}>
                        {task.assignee ? (
                          <span className={styles.assigneeCell}>
                            <Avatar name={task.assignee} size={18} />
                            <span className={styles.assigneeName}>{task.assignee}</span>
                          </span>
                        ) : (
                          <span className={styles.none}>Unassigned</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {!isFiltered && (
                  <div className={styles.addBucketRow}>
                    <AddBucketRow onAdd={name => onAddBucket(project.id, name)} />
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
