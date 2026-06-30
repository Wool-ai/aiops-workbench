import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import Avatar from './Avatar';
import { COLUMN_LABELS, PRIORITY_META } from '../lib/data';
import styles from '../styles/TaskCard.module.css';

export default function TaskCard({ task, col, onClick, showStatus = false, draggable = true, selected = false, onSelect = null }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { col },
    disabled: !draggable,
  });

  const priority = task.priority || 'medium';
  const pm = PRIORITY_META[priority];

  function handleCheckboxClick(e) {
    e.stopPropagation();
    onSelect?.(task.id);
  }

  return (
    <div
      ref={setNodeRef}
      className={`${styles.card} ${styles['card_' + priority]} ${isDragging ? styles.dragging : ''} ${selected ? styles.selected : ''}`}
      style={{ transform: CSS.Translate.toString(transform) }}
      onClick={onClick}
      {...attributes}
      {...(draggable ? listeners : {})}
    >
      {onSelect && (
        <button
          className={`${styles.selectBox} ${selected ? styles.selectBoxChecked : ''}`}
          onClick={handleCheckboxClick}
          title={selected ? 'Deselect' : 'Select'}
        >
          {selected && (
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          )}
        </button>
      )}

      <div className={styles.name}>{task.name}</div>
      {task.desc && <div className={styles.desc}>{task.desc}</div>}
      <div className={styles.footer}>
        <div className={styles.assignee}>
          {task.assignee ? (
            <>
              <Avatar name={task.assignee} size={18} />
              <span className={styles.assigneeName}>{task.assignee.split(' ')[0]}</span>
            </>
          ) : (
            <span className={styles.unassigned}>Unassigned</span>
          )}
        </div>
        <div className={styles.footerRight}>
          <span
            className={styles.priorityBadge}
            style={{ color: pm.color, background: pm.bg }}
            title={`Priority: ${pm.label}`}
          >
            {pm.label}
          </span>
          {showStatus && (
            <span className={`${styles.statusBadge} ${styles['statusBadge_' + col]}`}>
              {COLUMN_LABELS[col]}
            </span>
          )}
          {task.subtasks?.length > 0 && (
            <div className={styles.subtaskBadge}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {task.subtasks.filter(s => s.done).length}/{task.subtasks.length}
            </div>
          )}
          {task.comments.length > 0 && (
            <div className={styles.commentCount}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              {task.comments.length}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
