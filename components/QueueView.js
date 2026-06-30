import { useState, useEffect } from 'react';
import styles from '../styles/QueueView.module.css';

function inlineFormat(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

function SimpleMarkdown({ text }) {
  if (!text) return null;
  const elements = [];
  let i = 0;
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (t.startsWith('### ')) {
      elements.push(<div key={i} className={styles.mdH3}>{t.slice(4)}</div>);
    } else if (t.startsWith('## ')) {
      elements.push(<div key={i} className={styles.mdH2}>{t.slice(3)}</div>);
    } else if (t.startsWith('# ')) {
      elements.push(<div key={i} className={styles.mdH1}>{t.slice(2)}</div>);
    } else if (t.startsWith('- ') || t.startsWith('* ')) {
      elements.push(
        <div key={i} className={styles.mdLi}>
          <span className={styles.mdBullet}>•</span>
          <span>{inlineFormat(t.slice(2))}</span>
        </div>
      );
    } else if (t === '---' || t === '***') {
      elements.push(<hr key={i} className={styles.mdHr} />);
    } else if (t === '') {
      elements.push(<div key={i} className={styles.mdSpacer} />);
    } else {
      elements.push(<div key={i} className={styles.mdP}>{inlineFormat(t)}</div>);
    }
    i++;
  }
  return <div className={styles.mdBody}>{elements}</div>;
}

// ── Log parsing ──────────────────────────────────────────────────────────────

function toolInputSummary(name, input) {
  if (!input) return null;
  if (name === 'Bash') return input.command?.slice(0, 200);
  if (name === 'WebSearch') return `"${input.query}"`;
  if (name === 'WebFetch') return input.url?.slice(0, 140);
  if (name === 'Read') return input.file_path;
  if (name === 'Write' || name === 'Edit') return input.file_path;
  if (name === 'ToolSearch') return `"${input.query}"`;
  const s = JSON.stringify(input);
  return s.length > 160 ? s.slice(0, 160) + '…' : s;
}

function toolCategory(name) {
  if (name === 'Bash') return 'bash';
  if (name === 'WebSearch' || name === 'WebFetch') return 'web';
  if (name === 'Read' || name === 'Write' || name === 'Edit' || name === 'Glob' || name === 'Grep' || name === 'LS') return 'file';
  if (name.startsWith('mcp__aiops__')) return 'mcp';
  if (name.startsWith('mcp__')) return 'mcp';
  if (name === 'ToolSearch') return 'search';
  return 'default';
}

function ToolIcon({ name, size = 13 }) {
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
  if (cat === 'search') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

function parseLog(raw) {
  const lines = raw.split('\n');
  const meta = {};
  const events = [];
  let inSection = 'header';
  const resultMeta = {};

  for (const line of lines) {
    // Section headers
    const secMatch = line.match(/^===\s+(.+?)\s+===$/);
    if (secMatch) {
      const sec = secMatch[1].toLowerCase();
      if (sec.includes('prompt')) { inSection = 'prompt'; continue; }
      if (sec.includes('result') && !sec.includes('tool')) { inSection = 'result'; continue; }
      if (sec.includes('fallback') || sec.includes('stderr') || sec.includes('raw')) { inSection = 'other'; continue; }
      inSection = 'header';
      continue;
    }

    // JSON event lines — processed before section gating because Claude stream
    // events appear inside the 'prompt' section (no explicit end marker) and
    // would otherwise be skipped by the prompt-section continue below.
    if (line.startsWith('{')) {
      try {
        const ev = JSON.parse(line);

        if (ev.type === 'assistant' && ev.message?.content) {
          for (const block of ev.message.content) {
            if (block.type === 'tool_use') {
              events.push({ kind: 'tool_call', id: block.id, name: block.name, input: block.input });
            }
            if (block.type === 'text' && block.text?.trim()) {
              const t = block.text.trim();
              if (!/^\{"type"\s*:\s*"(completed|issue|human_input)"/.test(t)) {
                events.push({ kind: 'text', content: t });
              }
            }
          }
        }

        if (ev.type === 'user' && ev.message?.content) {
          for (const block of ev.message.content) {
            if (block.type === 'tool_result') {
              const content = Array.isArray(block.content)
                ? block.content.map(c => c.text || '').join('\n')
                : String(block.content || '');
              events.push({ kind: 'tool_result', toolUseId: block.tool_use_id, content });
            }
          }
        }

        if (ev.type === 'result') {
          if (ev.total_cost_usd != null) resultMeta.cost = `$${ev.total_cost_usd.toFixed(5)}`;
          if (ev.duration_ms != null) resultMeta.duration = `${(ev.duration_ms / 1000).toFixed(1)}s`;
          if (ev.num_turns != null) resultMeta.turns = ev.num_turns;
          if (ev.modelUsage) {
            const models = Object.keys(ev.modelUsage);
            resultMeta.model = models.map(m => m.replace('claude-', '').replace(/-\d{8}$/, '')).join(', ');
            resultMeta.inputTokens = models.reduce((s, m) => s + (ev.modelUsage[m].inputTokens || 0) + (ev.modelUsage[m].cacheReadInputTokens || 0), 0);
            resultMeta.outputTokens = models.reduce((s, m) => s + (ev.modelUsage[m].outputTokens || 0), 0);
          }
        }
      } catch {}
      continue; // don't let JSON lines fall through to section processing
    }

    if (inSection === 'header') {
      const m = line.match(/^(ID|Task|Project|Timestamp|Mode|Agents|Allowed tools)[:\s]+(.+)/);
      if (m) meta[m[1]] = m[2].trim();
      continue;
    }

    if (inSection === 'prompt' || inSection === 'other') continue;

    if (inSection === 'result') {
      if (line.startsWith('Type:')) resultMeta.type = line.replace(/^Type:\s*/, '').trim();
      if (line.startsWith('Message:')) resultMeta.message = line.replace(/^Message:\s*/, '').trim();
    }
  }

  // Attach tool results to their call
  const callById = {};
  for (const ev of events) if (ev.kind === 'tool_call') callById[ev.id] = ev;
  for (const ev of events) {
    if (ev.kind === 'tool_result' && callById[ev.toolUseId]) {
      callById[ev.toolUseId].result = ev.content;
    }
  }

  return {
    meta,
    events: events.filter(e => e.kind === 'tool_call' || e.kind === 'text'),
    result: resultMeta,
  };
}

// ── Log tool entry component ──────────────────────────────────────────────────

const CAT_COLOR = {
  bash:    'var(--danger)',
  web:     'var(--accent)',
  file:    'var(--done-c)',
  mcp:     'var(--review-c)',
  search:  'var(--text3)',
  default: 'var(--border2)',
};

function LogToolEntry({ ev, index, total }) {
  const [expanded, setExpanded] = useState(false);
  const cat = toolCategory(ev.name);
  const color = CAT_COLOR[cat];
  const shortName = ev.name
    .replace(/^mcp__aiops__/, '')
    .replace(/^mcp__\w+__/, '')
    .replace(/_/g, ' ');
  const summary = toolInputSummary(ev.name, ev.input);
  const hasResult = ev.result && ev.result.trim().length > 0;
  const resultText = (ev.result || '').trim();
  const resultPreview = resultText.slice(0, 600);
  const resultTruncated = resultText.length > 600;
  const isLast = index === total - 1;

  return (
    <div className={`${styles.logEntry} ${isLast ? styles.logEntryLast : ''}`}>
      {/* Timeline dot + connector line */}
      <div className={styles.logEntryTrack}>
        <span className={styles.logEntryDot} style={{ background: color, boxShadow: `0 0 0 2px color-mix(in srgb, ${color} 20%, transparent)` }} />
        {!isLast && <span className={styles.logEntryLine} />}
      </div>

      {/* Content */}
      <div className={styles.logEntryBody}>
        <div
          className={`${styles.logEntryHeader} ${hasResult ? styles.logEntryHeaderClickable : ''}`}
          onClick={() => hasResult && setExpanded(e => !e)}
        >
          <span className={styles.logEntryIconWrap} style={{ color }}>
            <ToolIcon name={ev.name} size={12} />
          </span>
          <span className={styles.logEntryName}>{shortName}</span>
          {summary && <span className={styles.logEntryInput}>{summary}</span>}
          <span className={styles.logEntryIndex}>#{index + 1}</span>
          {hasResult && (
            <svg
              className={`${styles.logEntryChevron} ${expanded ? styles.logEntryChevronOpen : ''}`}
              width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          )}
        </div>

        {expanded && hasResult && (
          <div className={styles.logEntryResult}>
            <pre className={styles.logEntryResultPre}>{resultPreview}{resultTruncated ? '\n\n… truncated' : ''}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Log viewer ────────────────────────────────────────────────────────────────

const TYPE_META_LOG = {
  completed:    { label: 'Completed',    color: 'var(--done-c)',    bg: 'var(--done-bg)' },
  issue:        { label: 'Issue',        color: 'var(--danger)',    bg: 'var(--danger-glow)' },
  human_input:  { label: 'Needs Input',  color: 'var(--review-c)', bg: 'var(--review-bg)' },
};

function LogViewer({ logFile }) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    if (!open || raw !== null) return;
    setLoading(true);
    fetch(`/api/log?file=${encodeURIComponent(logFile)}`)
      .then(r => r.json())
      .then(d => { setRaw(d.content ?? null); setError(d.error ?? null); })
      .catch(() => setError('Failed to fetch log'))
      .finally(() => setLoading(false));
  }, [open, logFile, raw]);

  const parsed = raw ? parseLog(raw) : null;
  const toolCount = parsed ? parsed.events.filter(e => e.kind === 'tool_call').length : 0;
  const resultInfo = parsed ? TYPE_META_LOG[parsed.result.type] : null;

  return (
    <div className={styles.logViewer}>
      <button className={styles.logToggle} onClick={() => setOpen(o => !o)}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points={open ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/>
        </svg>
        {open ? 'Hide' : 'View'} execution log
        {!open && toolCount > 0 && (
          <span className={styles.logToolCount}>{toolCount} tool{toolCount !== 1 ? 's' : ''}</span>
        )}
        {!open && parsed?.result.cost && (
          <span className={styles.logCostChip}>{parsed.result.cost}</span>
        )}
      </button>

      {open && (
        <div className={styles.logBody}>
          {loading && (
            <div className={styles.logLoading}>
              <svg className={styles.spinIcon} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Loading log…
            </div>
          )}
          {error && <div className={styles.logError}>{error}</div>}

          {parsed && !showRaw && (
            <div className={styles.logParsed}>

              {/* Header bar */}
              <div className={styles.logHeader}>
                <div className={styles.logHeaderLeft}>
                  {parsed.meta['Task'] && (
                    <span className={styles.logHeaderTask}>{parsed.meta['Task'].replace(/^"|"$/g, '')}</span>
                  )}
                  {parsed.meta['Timestamp'] && (
                    <span className={styles.logHeaderTime}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                      {new Date(parsed.meta['Timestamp']).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  )}
                </div>
                <div className={styles.logHeaderRight}>
                  {parsed.result.model && (
                    <span className={styles.logMetaChip}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                      </svg>
                      {parsed.result.model}
                    </span>
                  )}
                  {parsed.result.turns != null && (
                    <span className={styles.logMetaChip}>{parsed.result.turns} turns</span>
                  )}
                  {parsed.result.duration && (
                    <span className={styles.logMetaChip}>{parsed.result.duration}</span>
                  )}
                </div>
              </div>

              {/* Tool call timeline */}
              {parsed.events.length > 0 && (
                <div className={styles.logTimeline}>
                  {parsed.events.map((ev, i) => {
                    const toolEvents = parsed.events.filter(e => e.kind === 'tool_call');
                    const toolIndex = toolEvents.indexOf(ev);
                    return ev.kind === 'tool_call' ? (
                      <LogToolEntry key={i} ev={ev} index={toolIndex} total={toolEvents.length} />
                    ) : (
                      <div key={i} className={styles.logTextBlock}>
                        <SimpleMarkdown text={ev.content} />
                      </div>
                    );
                  })}
                </div>
              )}

              {parsed.events.length === 0 && !loading && (
                <div className={styles.logEmpty}>No tool activity recorded</div>
              )}

              {/* Result footer */}
              {(parsed.result.type || parsed.result.cost) && (
                <div
                  className={styles.logResultFooter}
                  style={resultInfo ? { borderLeftColor: resultInfo.color } : {}}
                >
                  <div className={styles.logResultTop}>
                    {resultInfo && (
                      <span className={styles.logResultBadge} style={{ color: resultInfo.color, background: resultInfo.bg }}>
                        {parsed.result.type === 'completed' ? (
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        ) : parsed.result.type === 'issue' ? (
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        ) : (
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        )}
                        {resultInfo.label}
                      </span>
                    )}
                    {parsed.result.message && (
                      <span className={styles.logResultMsg}>{parsed.result.message}</span>
                    )}
                  </div>
                  <div className={styles.logResultStats}>
                    {parsed.result.inputTokens > 0 && (
                      <span className={styles.logStat}>
                        <span className={styles.logStatLabel}>in</span>
                        {parsed.result.inputTokens.toLocaleString()}
                      </span>
                    )}
                    {parsed.result.outputTokens > 0 && (
                      <span className={styles.logStat}>
                        <span className={styles.logStatLabel}>out</span>
                        {parsed.result.outputTokens.toLocaleString()}
                      </span>
                    )}
                    {parsed.result.cost && (
                      <span className={styles.logStatCost}>{parsed.result.cost}</span>
                    )}
                  </div>
                </div>
              )}

              <button className={styles.logRawToggle} onClick={() => setShowRaw(true)}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                </svg>
                view raw log
              </button>
            </div>
          )}

          {(showRaw || (parsed && parsed.events.length === 0 && !loading && !error)) && raw && (
            <div className={styles.logRawWrap}>
              {showRaw && (
                <button className={styles.logRawToggle} onClick={() => setShowRaw(false)}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
                  </svg>
                  back to summary
                </button>
              )}
              <pre className={styles.logPre}>{raw}</pre>
            </div>
          )}
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

const ARTIFACT_TYPE_COLOR = {
  text:     { color: 'var(--artifact-text-c)', bg: 'var(--artifact-text-bg)' },
  markdown: { color: 'var(--artifact-markdown-c)', bg: 'var(--artifact-markdown-bg)'  },
  code:     { color: 'var(--artifact-code-c)', bg: 'var(--artifact-code-bg)'  },
  json:     { color: 'var(--artifact-json-c)', bg: 'var(--artifact-json-bg)'  },
};

function NotifCard({ notif, onMarkRead, onDismiss, onReply, onApproveRetry, onOpenTask, onOpenWorkspace, onNavigateArtifacts }) {
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
        {notif.scheduled && (
          <span className={styles.scheduledBadge}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="8 14 11 17 16 12"/>
            </svg>
            Scheduled
          </span>
        )}
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
        <div className={styles.processingMsg}>
          {(notif.toolHistory || []).length > 0 ? (
            <div className={styles.toolActivityFeed}>
              {(notif.toolHistory || []).slice(-8).map((tool, i, arr) => {
                const isActive = i === arr.length - 1;
                const label = tool
                  .replace(/^mcp__aiops__/, '')
                  .replace(/^mcp__\w+__/, '')
                  .replace(/_/g, ' ');
                return (
                  <div key={i} className={`${styles.toolActivityItem} ${isActive ? styles.toolActivityActive : styles.toolActivityDone}`}>
                    {isActive ? (
                      <svg className={styles.spinIcon} width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                    ) : (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                    <span>{label}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <span className={styles.processingIdle}>
              <svg className={styles.spinIcon} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              AI is processing this task…
            </span>
          )}
          {notif.streamText?.trim() && (
            <div className={styles.streamText}>{notif.streamText.trim()}</div>
          )}
        </div>
      ) : (
        <div className={styles.message}>
          <SimpleMarkdown text={notif.message} />
        </div>
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

      {/* Artifact chips — shown when MCP produced new artifacts */}
      {notif.newArtifacts?.length > 0 && (
        <div className={styles.artifactChips}>
          <span className={styles.artifactChipsLabel}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            Artifacts
          </span>
          {notif.newArtifacts.map(a => {
            const tm = ARTIFACT_TYPE_COLOR[a.type] || ARTIFACT_TYPE_COLOR.text;
            return (
              <button
                key={a.id}
                className={styles.artifactChip}
                onClick={() => onNavigateArtifacts && onNavigateArtifacts(notif.projectId)}
                title={`View artifact: ${a.name}`}
              >
                <span className={styles.artifactChipType} style={{ background: tm.bg, color: tm.color }}>
                  {a.type === 'markdown' ? 'MD' : a.type === 'code' ? (a.lang || 'code') : a.type.toUpperCase()}
                </span>
                <span className={styles.artifactChipName}>{a.name}</span>
              </button>
            );
          })}
        </div>
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
          {/* Fall-back "View artifacts" for old notifs without newArtifacts detail */}
          {!notif.newArtifacts?.length && (notif.artifactsAdded || notif.artifactId) && notif.projectId && notif.projectId !== 'daily' && (
            <button className={styles.openTaskBtn} onClick={() => onNavigateArtifacts ? onNavigateArtifacts(notif.projectId) : onOpenWorkspace?.(notif.projectId)}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              View artifacts
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

export default function QueueView({ notifications, selectedProjectId = '', onMarkRead, onDismiss, onReply, onApproveRetry, onOpenTask, onOpenWorkspace, onNavigateArtifacts }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const q = search.trim().toLowerCase();

  const visible = notifications.filter(n => {
    if (filter !== 'all' && n.type !== filter) return false;
    if (selectedProjectId && n.projectId !== selectedProjectId) return false;
    if (q) {
      const inTask = (n.taskName || '').toLowerCase().includes(q);
      const inProject = (n.projectName || '').toLowerCase().includes(q);
      const inMsg = (n.message || '').toLowerCase().includes(q);
      if (!inTask && !inProject && !inMsg) return false;
    }
    return true;
  });

  const projectFiltered = selectedProjectId
    ? notifications.filter(n => n.projectId === selectedProjectId)
    : notifications;

  const unreadByType = {
    all: projectFiltered.filter(n => !n.read).length,
    permission_required: projectFiltered.filter(n => !n.read && n.type === 'permission_required').length,
    human_input: projectFiltered.filter(n => !n.read && n.type === 'human_input').length,
    issue: projectFiltered.filter(n => !n.read && n.type === 'issue').length,
    completed: projectFiltered.filter(n => !n.read && n.type === 'completed').length,
  };

  return (
    <div className={styles.queue}>
      {/* Search */}
      <div className={styles.searchBar}>
        <input
          className={styles.searchInput}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search tasks, projects, messages…"
          aria-label="Search queue"
        />
        {search && (
          <button className={styles.clearSearch} onClick={() => setSearch('')} aria-label="Clear search">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

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
              onOpenWorkspace={onOpenWorkspace}
              onNavigateArtifacts={onNavigateArtifacts}
            />
          ))}
        </div>
      )}
    </div>
  );
}
