import { useState, useEffect, useRef } from 'react';
import Avatar from './Avatar';
import { COLUMN_LABELS, COLUMNS, ASSIGNEES } from '../lib/data';
import styles from '../styles/TaskModal.module.css';

export default function TaskModal({ task, projectName, projectBuckets, onSave, onDelete, onClose }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [assignee, setAssignee] = useState('');
  const [col, setCol] = useState('todo');
  const [bucket, setBucket] = useState('');
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    if (task) {
      setName(task.name || '');
      setDesc(task.desc || '');
      setAssignee(task.assignee || '');
      setCol(task.col || 'todo');
      setBucket(task.bucket || '');
      setComments(task.comments || []);
    }
    setTimeout(() => nameRef.current?.focus(), 60);
  }, [task]);

  if (!task) return null;

  function handleClose() {
    setShowDeleteConfirm(false);
    onClose();
  }

  function handleSave() {
    onSave({ ...task, name: name.trim() || 'Untitled task', desc, assignee, col, bucket, comments });
  }

  function handleAddComment() {
    const txt = commentInput.trim();
    if (!txt) return;
    const updated = [...comments, { author: 'You', text: txt, time: 'just now' }];
    setComments(updated);
    setCommentInput('');
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) handleClose();
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      if (showDeleteConfirm) setShowDeleteConfirm(false);
      else handleClose();
    }
  }

  return (
    <div className={styles.overlay} onClick={handleOverlayClick} onKeyDown={handleKeyDown}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label={`Task: ${name}`}>
        <div className={styles.header}>
          <div className={styles.projectLabel}>
            <span className={styles.projectName}>{projectName}</span>
          </div>
          <button className={styles.closeBtn} onClick={handleClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
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
            rows={3}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Assignee</label>
          <div className={styles.assigneeRow}>
            {assignee && <Avatar name={assignee} size={22} />}
            <select
              className={styles.select}
              value={assignee}
              onChange={e => setAssignee(e.target.value)}
            >
              <option value="">Unassigned</option>
              {ASSIGNEES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        {projectBuckets && projectBuckets.length > 0 && (
          <div className={styles.field}>
            <label className={styles.label}>Work Bucket</label>
            <select
              className={styles.select}
              value={bucket}
              onChange={e => setBucket(e.target.value)}
            >
              <option value="">No bucket</option>
              {projectBuckets.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        )}

        <div className={styles.commentsSection}>
          <div className={styles.commentsTitle}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
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

        <div className={styles.footer}>
          {showDeleteConfirm ? (
            <div className={styles.deleteConfirm}>
              <span className={styles.deleteConfirmText}>Delete this task?</span>
              <button className={styles.deleteConfirmNo} onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className={styles.deleteConfirmYes} onClick={onDelete}>Yes, delete</button>
            </div>
          ) : (
            <button className={styles.deleteBtn} onClick={() => setShowDeleteConfirm(true)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              Delete
            </button>
          )}
          <div className={styles.footerRight}>
            <button className={styles.cancelBtn} onClick={handleClose}>Cancel</button>
            <button className={styles.saveBtn} onClick={handleSave}>Save task</button>
          </div>
        </div>
      </div>
    </div>
  );
}
