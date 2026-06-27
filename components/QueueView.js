import { useState, useEffect } from 'react';
import styles from '../styles/QueueView.module.css';

function LogViewer({ logFile }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || content !== null) return;
    setLoading(true);
    fetch(`/api/log?file=${encodeURIComponent(logFile)}`)
      .then(r => r.json())
      .then(d => { setContent(d.content ?? null); setError(d.error ?? null); })
      .catch(() => setError('Failed to fetch log'))
      .finally(() => setLoading(false));
  }, [open, logFile, content]);

  return (
    <div className={styles.logViewer}>
      <button className={styles.logToggle} onClick={() => setOpen(o => !o)}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points={open ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/>
        </svg>
        {open ? 'Hide' : 'View'} execution log
        <span className={styles.logFileName}>{logFile}</span>
      </button>

      {open && (
        <div className={styles.logBody}>
          {loading && <span className={styles.logLoading}>Loading…</span>}
          {error && <span className={styles.logError}>{error}</span>}
          {content && <pre className={styles.logPre}>{content}</pre>}
        </div>
      )}
    </div>
  );
}

const TYPE_META = {
  processing: {
    label: 'Processing…',
    icon: (
      <svg className={styles.spinIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
    ),
  },
  completed: {
    label: 'Completed',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
  },
  issue: {
    label: 'Issue',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
  },
  human_input: {
    label: 'Needs Input',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  permission_required: {
    label: 'Needs Permission',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    ),
  },
};

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'permission_required', label: 'Needs Permission' },
  { id: 'human_input', label: 'Needs Input' },
  { id: 'issue', label: 'Issues' },
  { id: 'completed', label: 'Completed' },
];

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ToolInputSummary({ tool, input }) {
  if (tool === 'Bash') {
    return <span className={styles.opDetail}><span className={styles.opLabel}>$</span> {input.command}</span>;
  }
  if (tool === 'Write' || tool === 'Edit') {
    return <span className={styles.opDetail}><span className={styles.opLabel}>{tool === 'Write' ? 'write' : 'edit'}</span> {input.file_path}</span>;
  }
  if (tool === 'Read') {
    return <span className={styles.opDetail}><span className={styles.opLabel}>read</span> {input.file_path}</span>;
  }
  return <span className={styles.opDetail}>{JSON.stringify(input).slice(0, 120)}</span>;
}

function NotifCard({ notif, onMarkRead, onDismiss, onReply, onApproveRetry, onOpenTask }) {
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [approving, setApproving] = useState(false);
  const meta = TYPE_META[notif.type] || TYPE_META.completed;

  async function handleApprove() {
    setApproving(true);
    await onApproveRetry(notif);
    setApproving(false);
  }

  function handleReply() {
    if (!replyText.trim()) return;
    onReply(notif, replyText.trim());
    setReplyText('');
    setReplying(false);
  }

  return (
    <div className={`${styles.card} ${notif.read ? styles.cardRead : ''} ${styles['card_' + notif.type]}`}>
      {/* Card header */}
      <div className={styles.cardHeader}>
        <span className={`${styles.typeBadge} ${styles['badge_' + notif.type]}`}>
          {meta.icon}
          {meta.label}
        </span>
        <div className={styles.cardMeta}>
          {notif.projectName && (
            <span className={styles.breadcrumb}>
              {notif.projectName}
              {notif.bucket && <><span className={styles.sep}>›</span>{notif.bucket}</>}
            </span>
          )}
          <span className={styles.timestamp}>{timeAgo(notif.timestamp)}</span>
        </div>
      </div>

      {/* Task name */}
      <div className={styles.taskName}>{notif.taskName || 'Unnamed task'}</div>

      {/* AI message */}
      {notif.type === 'processing' ? (
        <div className={styles.processingMsg}>AI is processing this task…</div>
      ) : (
        <div className={styles.message}>{notif.message}</div>
      )}

      {/* Thread (prior replies) */}
      {notif.thread && notif.thread.length > 0 && (
        <div className={styles.thread}>
          {notif.thread.map((entry, i) => (
            <div key={i} className={`${styles.threadEntry} ${styles['thread_' + entry.from]}`}>
              <span className={styles.threadFrom}>{entry.from === 'human' ? 'You' : 'AI'}</span>
              <span className={styles.threadText}>{entry.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Permission denials */}
      {notif.type === 'permission_required' && notif.deniedOperations?.length > 0 && (
        <div className={styles.deniedOps}>
          <div className={styles.deniedOpsTitle}>Blocked operations</div>
          {notif.deniedOperations.map((op, i) => (
            <div key={i} className={styles.deniedOp}>
              <span className={`${styles.toolBadge} ${styles['tool_' + op.tool]}`}>{op.tool}</span>
              <ToolInputSummary tool={op.tool} input={op.input} />
            </div>
          ))}
          {!notif.read && (
            <button
              className={styles.approveBtn}
              onClick={handleApprove}
              disabled={approving}
            >
              {approving ? (
                <>
                  <svg className={styles.spinIcon} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Retrying…
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Approve & Retry
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Reply area for human_input */}
      {notif.type === 'human_input' && !notif.read && (
        replying ? (
          <div className={styles.replyArea}>
            <textarea
              className={styles.replyInput}
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); } if (e.key === 'Escape') setReplying(false); }}
              placeholder="Type your reply… (Enter to send)"
              rows={2}
              autoFocus
            />
            <div className={styles.replyActions}>
              <button className={styles.cancelReplyBtn} onClick={() => setReplying(false)}>Cancel</button>
              <button className={styles.sendReplyBtn} onClick={handleReply} disabled={!replyText.trim()}>
                Send reply
              </button>
            </div>
          </div>
        ) : (
          <button className={styles.replyTrigger} onClick={() => setReplying(true)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Reply to AI
          </button>
        )
      )}

      {/* Execution log */}
      {notif.logFile && notif.type !== 'processing' && (
        <LogViewer logFile={notif.logFile} />
      )}

      {/* Footer actions */}
      {notif.type !== 'processing' && (
        <div className={styles.cardFooter}>
          {!notif.read && (
            <button className={styles.markReadBtn} onClick={() => onMarkRead(notif.id)}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Mark as read
            </button>
          )}
          {onOpenTask && notif.taskId && notif.projectId !== 'daily' && (
            <button className={styles.openTaskBtn} onClick={() => onOpenTask(notif.taskId, notif.projectId)}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
              Open Task
            </button>
          )}
          <button className={styles.dismissBtn} onClick={() => onDismiss(notif.id)}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

export default function QueueView({ notifications, onMarkRead, onDismiss, onReply, onApproveRetry, onOpenTask }) {
  const [filter, setFilter] = useState('all');

  const visible = notifications.filter(n =>
    filter === 'all' || n.type === filter || (filter === 'all' && n.type === 'processing')
  );

  const unreadByType = {
    all: notifications.filter(n => !n.read).length,
    permission_required: notifications.filter(n => !n.read && n.type === 'permission_required').length,
    human_input: notifications.filter(n => !n.read && n.type === 'human_input').length,
    issue: notifications.filter(n => !n.read && n.type === 'issue').length,
    completed: notifications.filter(n => !n.read && n.type === 'completed').length,
  };

  return (
    <div className={styles.queue}>
      {/* Filter tabs */}
      <div className={styles.filters}>
        {notifications.filter(n => !n.read && n.type !== 'processing').length > 0 && (
          <button
            className={styles.markAllReadBtn}
            onClick={() => notifications.filter(n => !n.read).forEach(n => onMarkRead(n.id))}
          >
            Mark all read
          </button>
        )}
        {FILTERS.map(f => (
          <button
            key={f.id}
            className={`${styles.filterBtn} ${filter === f.id ? styles.filterActive : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
            {unreadByType[f.id] > 0 && (
              <span className={styles.filterBadge}>{unreadByType[f.id]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Notification list */}
      {visible.length === 0 ? (
        <div className={styles.empty}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.25 }}>
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span>{filter === 'all' ? 'No notifications yet. Run a task with AI to get started.' : `No ${FILTERS.find(f => f.id === filter)?.label.toLowerCase()} notifications.`}</span>
        </div>
      ) : (
        <div className={styles.list}>
          {visible.map(notif => (
            <NotifCard
              key={notif.id}
              notif={notif}
              onMarkRead={onMarkRead}
              onDismiss={onDismiss}
              onReply={onReply}
              onApproveRetry={onApproveRetry}
              onOpenTask={onOpenTask}
            />
          ))}
        </div>
      )}
    </div>
  );
}
