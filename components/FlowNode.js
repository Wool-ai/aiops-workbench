import { Handle, Position } from '@xyflow/react';
import { PRIORITY_META, COLUMN_LABELS } from '../lib/data';
import Avatar from './Avatar';
import styles from '../styles/FlowNode.module.css';

export default function FlowNode({ data }) {
  const { task, nodeStatus } = data;

  if (!task) {
    return (
      <div className={styles.card}>
        <span className={styles.missing}>Task not found</span>
      </div>
    );
  }

  const priority = task.priority || 'medium';
  const pm = PRIORITY_META[priority];
  const execStatus = nodeStatus?.status;

  return (
    <div className={`${styles.card} ${styles['card_' + priority]} ${execStatus === 'running' ? styles.cardRunning : ''} ${execStatus === 'done' ? styles.cardDone : ''}`}>
      <Handle type="target" position={Position.Top} className={styles.handle} />

      <div className={styles.name}>{task.name}</div>

      {task.desc && (
        <div className={styles.desc}>{task.desc}</div>
      )}

      <div className={styles.footer}>
        <div className={styles.assignee}>
          {task.assignee ? (
            <>
              <Avatar name={task.assignee} size={16} />
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
          >
            {pm.label}
          </span>

          <span className={`${styles.statusBadge} ${styles['statusBadge_' + task.col]}`}>
            {COLUMN_LABELS[task.col] || task.col}
          </span>

          {execStatus && (
            <span className={`${styles.execBadge} ${styles['exec_' + execStatus]}`}>
              {execStatus === 'pending' && '○ Pending'}
              {execStatus === 'running' && '⟳ Running'}
              {execStatus === 'done'    && '✓ Done'}
              {execStatus === 'skipped' && '— Skip'}
            </span>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className={styles.handle} />
    </div>
  );
}
