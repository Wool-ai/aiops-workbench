import styles from '../styles/FlowActivityFeed.module.css';

function toolCategory(name) {
  if (name === 'Bash') return 'bash';
  if (name === 'WebSearch' || name === 'WebFetch') return 'web';
  if (name === 'Read' || name === 'Write' || name === 'Edit' || name === 'Glob' || name === 'Grep' || name === 'LS') return 'file';
  if (name.startsWith('mcp__')) return 'mcp';
  if (name === 'ToolSearch') return 'search';
  return 'default';
}

const CAT_COLOR = {
  bash:    'var(--danger)',
  web:     'var(--accent)',
  file:    'var(--done-c)',
  mcp:     'var(--review-c)',
  search:  'var(--text3)',
  default: 'var(--border2)',
};

function ToolIcon({ name, size = 11 }) {
  const cat = toolCategory(name);
  const s = size;
  if (cat === 'bash') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
    </svg>
  );
  if (cat === 'web') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
  if (cat === 'file') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  );
  if (cat === 'mcp') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
  );
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

export default function FlowActivityFeed({ notif, compact = false }) {
  if (!notif) return null;

  const tools = notif.toolHistory || [];
  const streamText = notif.streamText?.trim() || '';

  const displayTools = compact ? tools.slice(-5) : tools.slice(-10);

  return (
    <div className={`${styles.feed} ${compact ? styles.feedCompact : ''}`}>
      {tools.length > 0 ? (
        <div className={styles.toolFeed}>
          {displayTools.map((tool, i, arr) => {
            const isActive = i === arr.length - 1;
            const cat = toolCategory(tool);
            const color = CAT_COLOR[cat];
            const label = tool
              .replace(/^mcp__aiops__/, '')
              .replace(/^mcp__\w+__/, '')
              .replace(/_/g, ' ');
            return (
              <div
                key={i}
                className={`${styles.toolItem} ${isActive ? styles.toolItemActive : styles.toolItemDone}`}
                style={{ '--tool-color': color }}
              >
                <span className={styles.toolIcon}>
                  {isActive ? (
                    <svg className={styles.spinIcon} width={compact ? 8 : 9} height={compact ? 8 : 9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                  ) : (
                    <svg width={compact ? 8 : 9} height={compact ? 8 : 9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </span>
                <span className={styles.toolIconCat}>
                  <ToolIcon name={tool} size={compact ? 9 : 10} />
                </span>
                <span className={styles.toolLabel}>{label}</span>
              </div>
            );
          })}
          {tools.length > displayTools.length && (
            <span className={styles.toolOverflow}>+{tools.length - displayTools.length} more</span>
          )}
        </div>
      ) : (
        <div className={styles.idle}>
          <svg className={styles.spinIcon} width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          Starting…
        </div>
      )}

      {streamText && (
        <div className={`${styles.streamText} ${compact ? styles.streamTextCompact : ''}`}>
          {streamText}
        </div>
      )}
    </div>
  );
}
