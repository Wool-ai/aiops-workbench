import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import Avatar from './Avatar';
import { COLUMN_LABELS, PRIORITY_META } from '../lib/data';
import styles from '../styles/TaskCard.module.css';

export default function TaskCard({ task, col, onClick, showStatus = false, draggable = true }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { col },
    disabled: !draggable,
  });

  const priority = task.priority || 'medium';
  const pm = PRIORITY_META[priority];

  return (
    <div
      ref={setNodeRef}
      className={`${styles.card} ${styles['card_' + priority]} ${isDragging ? styles.dragging : ''}`}
      style={{ transform: CSS.Translate.toString(transform) }}
      onClick={onClick}
      {...attributes}
      {...(draggable ? listeners : {})}
    >
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
