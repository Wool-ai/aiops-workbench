import { useState } from 'react';
import { COLUMNS, COLUMN_LABELS, PRIORITY_ORDER, PRIORITY_META, ASSIGNEES } from '../lib/data';
import styles from '../styles/BulkActionBar.module.css';

export default function BulkActionBar({ count, onStatus, onPriority, onAssignee, onDelete, onClear }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleStatus(e) {
    const v = e.target.value;
    e.target.value = '';
    if (v) onStatus(v);
  }
  function handlePriority(e) {
    const v = e.target.value;
    e.target.value = '';
    if (v) onPriority(v);
  }
  function handleAssignee(e) {
    const v = e.target.value;
    e.target.value = '';
    onAssignee(v); // empty string = unassigned, which is valid
  }

  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <button className={styles.clearBtn} onClick={onClear} title="Clear selection">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <span className={styles.count}>{count} task{count !== 1 ? 's' : ''} selected</span>
      </div>

      <div className={styles.divider} />

      <div className={styles.actions}>
        <select className={styles.actionSelect} defaultValue="" onChange={handleStatus}>
          <option value="" disabled>Set status…</option>
          {COLUMNS.map(c => (
            <option key={c} value={c}>{COLUMN_LABELS[c]}</option>
          ))}
        </select>

        <select className={styles.actionSelect} defaultValue="" onChange={handlePriority}>
          <option value="" disabled>Set priority…</option>
          {PRIORITY_ORDER.map(p => (
            <option key={p} value={p}>{PRIORITY_META[p].label}</option>
          ))}
        </select>

        <select className={styles.actionSelect} defaultValue="__none__" onChange={handleAssignee}>
          <option value="__none__" disabled>Reassign…</option>
          <option value="">Unassigned</option>
          {ASSIGNEES.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        {confirmDelete ? (
          <div className={styles.deleteConfirmRow}>
            <span className={styles.deleteMsg}>Delete {count} task{count !== 1 ? 's' : ''}?</span>
            <button className={styles.deleteYes} onClick={() => { setConfirmDelete(false); onDelete(); }}>
              Yes, delete
            </button>
            <button className={styles.deleteNo} onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button className={styles.deleteBtn} onClick={() => setConfirmDelete(true)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
