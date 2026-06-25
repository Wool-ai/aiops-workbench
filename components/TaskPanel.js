import { useState, useEffect, useRef } from 'react';
import Avatar from './Avatar';
import { COLUMN_LABELS, COLUMNS, ASSIGNEES, PRIORITY_ORDER, PRIORITY_META } from '../lib/data';
import styles from '../styles/TaskPanel.module.css';

export default function TaskPanel({ task, projectName, projectBuckets, onSave, onDelete, onClose, onRunWithAI }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [assignee, setAssignee] = useState('');
  const [col, setCol] = useState('todo');
  const [bucket, setBucket] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState('medium');
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [aiQueued, setAiQueued] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    if (task) {
      setName(task.name || '');
      setDesc(task.desc || '');
      setAssignee(task.assignee || '');
      setCol(task.col || 'todo');
      setBucket(task.bucket || '');
      setDueDate(task.dueDate || '');
      setDueTime(task.dueTime || '');
      setPriority(task.priority || 'medium');
      setComments(task.comments || []);
      setShowDeleteConfirm(false);
    }
    setTimeout(() => nameRef.current?.focus(), 60);
  }, [task?.id]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        if (showDeleteConfirm) setShowDeleteConfirm(false);
        else onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showDeleteConfirm, onClose]);

  if (!task) return null;

  function handleSave() {
    onSave({ ...task, name: name.trim() || 'Untitled task', desc, assignee, col, bucket, dueDate, dueTime, priority, comments });
  }

  function handleRunWithAI() {
    if (!onRunWithAI || aiQueued) return;
    // Save first so AI sees latest task state
    const updatedTask = { ...task, name: name.trim() || 'Untitled task', desc, assignee, col, bucket, dueDate, dueTime, priority, comments };
    onSave(updatedTask);
    setAiQueued(true);
    onRunWithAI(updatedTask);
    setTimeout(() => setAiQueued(false), 3000);
  }

  function handleAddComment() {
    const txt = commentInput.trim();
    if (!txt) return;
    setComments(prev => [...prev, { author: 'You', text: txt, time: 'just now' }]);
    setCommentInput('');
  }

  return (
    <div className={styles.panel} role="dialog" aria-modal="true" aria-label={`Task: ${name}`}>
      <div className={styles.panelHeader}>
        <span className={styles.projectLabel}>{projectName}</span>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div className={styles.statusRow}>
        {COLUMNS.map(c => (
          <button
            key={c}
            className={`${styles.statusChip} ${col === c ? styles['active_' + c] : ''}`}
            onClick={() => setCol(c)}
          >
            {COLUMN_LABELS[c]}
          </button>
        ))}
      </div>

      <div className={styles.panelBody}>
        <div className={styles.field}>
          <label className={styles.label}>Task name</label>
          <input
            ref={nameRef}
            className={styles.input}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="What needs to be done?"
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Description</label>
          <textarea
            className={styles.textarea}
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Add more context..."
            rows={4}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Assignee</label>
          <div className={styles.assigneeRow}>
            {assignee && <Avatar name={assignee} size={22} />}
            <select className={styles.select} value={assignee} onChange={e => setAssignee(e.target.value)}>
              <option value="">Unassigned</option>
              {ASSIGNEES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Priority</label>
          <div className={styles.priorityRow}>
            {PRIORITY_ORDER.map(p => {
              const pm = PRIORITY_META[p];
              return (
                <button
                  key={p}
                  type="button"
                  className={`${styles.priorityBtn} ${priority === p ? styles.priorityBtnActive : ''}`}
                  style={priority === p ? { '--p-color': pm.color, '--p-bg': pm.bg } : {}}
                  onClick={() => setPriority(p)}
                >
                  <span className={styles.priorityDot} style={{ background: pm.color }} />
                  {pm.label}
                </button>
              );
            })}
          </div>
        </div>

        {projectBuckets && projectBuckets.length > 0 && (
          <div className={styles.field}>
            <label className={styles.label}>Work Bucket</label>
            <select className={styles.select} value={bucket} onChange={e => setBucket(e.target.value)}>
              <option value="">No bucket</option>
              {projectBuckets.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.label}>Due date</label>
          <div className={styles.dueDateRow}>
            <input
              className={styles.input}
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
            <input
              className={styles.input}
              type="time"
              value={dueTime}
              onChange={e => setDueTime(e.target.value)}
              disabled={!dueDate}
              placeholder="Time"
            />
            {dueDate && (
              <button
                className={styles.clearDueBtn}
                onClick={() => { setDueDate(''); setDueTime(''); }}
                title="Clear due date"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className={styles.commentsSection}>
          <div className={styles.commentsTitle}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Comments
            {comments.length > 0 && <span className={styles.commentCount}>({comments.length})</span>}
          </div>

          <div className={styles.commentsList}>
            {comments.length === 0 ? (
              <p className={styles.noComments}>No comments yet.</p>
            ) : (
              comments.map((c, i) => (
                <div key={i} className={styles.comment}>
                  <Avatar name={c.author} size={24} />
                  <div className={styles.commentBody}>
                    <div className={styles.commentMeta}>
                      <span className={styles.commentAuthor}>{c.author}</span>
                      <span className={styles.commentTime}>{c.time}</span>
                    </div>
                    <div className={styles.commentText}>{c.text}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className={styles.commentInputRow}>
            <input
              className={styles.commentInput}
              value={commentInput}
              onChange={e => setCommentInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddComment()}
              placeholder="Add a comment…"
            />
            <button className={styles.sendBtn} onClick={handleAddComment}>Send</button>
          </div>
        </div>
      </div>

      {onRunWithAI && (
        <div className={styles.aiSection}>
          <button
            className={`${styles.aiBtn} ${aiQueued ? styles.aiBtnQueued : ''}`}
            onClick={handleRunWithAI}
            disabled={aiQueued}
          >
            {aiQueued ? (
              <>
                <svg className={styles.aiSpinner} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Queued for AI…
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                Run with AI
              </>
            )}
          </button>
          <span className={styles.aiHint}>AI will analyze and report back in the Queue tab</span>
        </div>
      )}

      <div className={styles.panelFooter}>
        {showDeleteConfirm ? (
          <div className={styles.deleteConfirm}>
            <span className={styles.deleteConfirmText}>Delete this task?</span>
            <button className={styles.deleteConfirmNo} onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
            <button className={styles.deleteConfirmYes} onClick={onDelete}>Yes, delete</button>
          </div>
        ) : (
          <>
            <button className={styles.deleteBtn} onClick={() => setShowDeleteConfirm(true)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
              Delete
            </button>
            <div className={styles.footerRight}>
              <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
              <button className={styles.saveBtn} onClick={handleSave}>Save task</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
