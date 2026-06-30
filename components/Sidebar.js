import { useState, useEffect } from 'react';
import styles from '../styles/Sidebar.module.css';

const THEMES = [
  { id: 'blue',  label: 'Blue',      swatch: '#2cb7d3' },
  { id: 'purple', label: 'Purple',   swatch: '#c084fc' },
  { id: 'green', label: 'Green',     swatch: '#4fffb0' },
  { id: 'yellow', label: 'Yellow',   swatch: '#fbbf24' },
  { id: 'orange', label: 'Orange',   swatch: '#ff8c42' },
  { id: 'dark',  label: 'Dark',      swatch: '#9898b8' },
  { id: 'white', label: 'Light',     swatch: '#2563eb' },
];

// ── Icon library ──────────────────────────────────────────────────────────────

const Icons = {
  dashboard: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="8" rx="1.5"/>
      <rect x="13" y="3" width="8" height="5" rx="1.5"/>
      <rect x="13" y="11" width="8" height="10" rx="1.5"/>
      <rect x="3" y="14" width="8" height="7" rx="1.5"/>
    </svg>
  ),
  board: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="5.5" height="18" rx="1.5"/>
      <rect x="9.25" y="3" width="5.5" height="12" rx="1.5"/>
      <rect x="16.5" y="3" width="5.5" height="7" rx="1.5"/>
    </svg>
  ),
  backlog: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5h11"/>
      <path d="M9 12h11"/>
      <path d="M9 19h11"/>
      <rect x="3" y="3.5" width="3" height="3" rx="0.75" fill="currentColor" stroke="none"/>
      <rect x="3" y="10.5" width="3" height="3" rx="0.75" fill="currentColor" stroke="none"/>
      <rect x="3" y="17.5" width="3" height="3" rx="0.75" fill="currentColor" stroke="none"/>
    </svg>
  ),
  queue: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-6l-2 3H10l-2-3H2"/>
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
    </svg>
  ),
  reminders: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  scheduled: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <polyline points="12 7 12 12 15.5 14.5"/>
      <line x1="12" y1="3" x2="12" y2="1"/>
      <line x1="12" y1="23" x2="12" y2="21"/>
      <line x1="3" y1="12" x2="1" y2="12"/>
      <line x1="23" y1="12" x2="21" y2="12"/>
    </svg>
  ),
  daily: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <line x1="12" y1="2" x2="12" y2="4"/>
      <line x1="12" y1="20" x2="12" y2="22"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="2" y1="12" x2="4" y2="12"/>
      <line x1="20" y1="12" x2="22" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  ),
  agents: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.5 8.5 23 9.5 17.5 14.5 19 22 12 18.5 5 22 6.5 14.5 1 9.5 8.5 8.5 12 2"/>
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/>
    </svg>
  ),
  skills: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  ),
  mcp: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="14" height="14" rx="2"/>
      <rect x="9" y="9" width="6" height="6" rx="1"/>
      <line x1="9" y1="2" x2="9" y2="5"/>
      <line x1="15" y1="2" x2="15" y2="5"/>
      <line x1="9" y1="19" x2="9" y2="22"/>
      <line x1="15" y1="19" x2="15" y2="22"/>
      <line x1="2" y1="9" x2="5" y2="9"/>
      <line x1="2" y1="15" x2="5" y2="15"/>
      <line x1="19" y1="9" x2="22" y2="9"/>
      <line x1="19" y1="15" x2="22" y2="15"/>
    </svg>
  ),
  artifacts: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  flows: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="5" r="2.5"/>
      <circle cx="19" cy="5" r="2.5"/>
      <circle cx="5" cy="19" r="2.5"/>
      <circle cx="19" cy="19" r="2.5"/>
      <line x1="7.5" y1="5" x2="16.5" y2="5"/>
      <line x1="5" y1="7.5" x2="5" y2="16.5"/>
      <line x1="7.5" y1="19" x2="16.5" y2="19"/>
      <line x1="16.5" y1="7" x2="7.5" y2="17"/>
    </svg>
  ),
};

const VIEWS = [
  // ── Workspace
  { id: 'dashboard', label: 'Dashboard', icon: Icons.dashboard, group: 'workspace' },
  { id: 'board',     label: 'Board',     icon: Icons.board,     group: 'workspace' },
  { id: 'backlog',   label: 'Backlog',   icon: Icons.backlog,   group: 'workspace' },
  { id: 'daily',     label: 'Daily',     icon: Icons.daily,     group: 'workspace' },
  { id: 'artifacts', label: 'Artifacts', icon: Icons.artifacts, group: 'workspace' },
  { id: 'flows',     label: 'Flows',     icon: Icons.flows,     group: 'workspace' },
  // ── Automation
  { id: 'queue',     label: 'AI Queue',  icon: Icons.queue,     group: 'auto' },
  { id: 'reminders', label: 'Reminders', icon: Icons.reminders, group: 'auto' },
  { id: 'scheduled', label: 'Scheduled', icon: Icons.scheduled, group: 'auto' },
  // ── Config
  { id: 'agents',    label: 'Agents',    icon: Icons.agents,    group: 'config' },
  { id: 'skills',    label: 'Skills',    icon: Icons.skills,    group: 'config' },
  { id: 'mcp',       label: 'MCP',       icon: Icons.mcp,       group: 'config' },
];

const GROUPS = ['workspace', 'auto', 'config'];

// ── Component ─────────────────────────────────────────────────────────────────

export default function Sidebar({ activeView, onViewChange, queueUnread = 0, remindersOverdue = 0 }) {
  const [activeTheme, setActiveTheme] = useState('blue');

  useEffect(() => {
    const saved = localStorage.getItem('aiops-theme') || 'blue';
    setActiveTheme(saved);
    document.documentElement.dataset.theme = saved;
  }, []);

  function applyTheme(id) {
    setActiveTheme(id);
    localStorage.setItem('aiops-theme', id);
    document.documentElement.dataset.theme = id;
  }

  return (
    <nav className={styles.sidebar}>
      {/* ── Logo ── */}
      <div className={styles.logo}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <polygon points="12 2 22 7 22 17 12 22 2 17 2 7" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          <polygon points="12 6 18 9.5 18 16.5 12 20 6 16.5 6 9.5" fill="currentColor" opacity="0.15" stroke="none"/>
          <line x1="12" y1="2" x2="12" y2="22" stroke="currentColor" strokeWidth="1.5" opacity="0.4"/>
          <line x1="2" y1="7" x2="22" y2="17" stroke="currentColor" strokeWidth="1.5" opacity="0.4"/>
          <line x1="22" y1="7" x2="2" y2="17" stroke="currentColor" strokeWidth="1.5" opacity="0.4"/>
          <circle cx="12" cy="12" r="2" fill="currentColor"/>
        </svg>
      </div>

      {/* ── Nav groups ── */}
      <div className={styles.nav}>
        {GROUPS.map((group, gi) => {
          const groupViews = VIEWS.filter(v => v.group === group);
          return (
            <div key={group} className={styles.navGroup}>
              {gi > 0 && <div className={styles.groupDivider} />}
              {groupViews.map(v => {
                const hasBadge = (v.id === 'queue' && queueUnread > 0) || (v.id === 'reminders' && remindersOverdue > 0);
                const badgeCount = v.id === 'queue' ? queueUnread : remindersOverdue;
                const isDanger = v.id === 'reminders';
                return (
                  <button
                    key={v.id}
                    className={`${styles.navBtn} ${activeView === v.id ? styles.navBtnActive : ''}`}
                    onClick={() => onViewChange(v.id)}
                    data-label={v.label}
                  >
                    <span className={styles.iconWrap}>
                      {v.icon}
                      {hasBadge && (
                        <span className={`${styles.badge} ${isDanger ? styles.badgeDanger : ''}`}>
                          {badgeCount > 9 ? '9+' : badgeCount}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── Theme picker ── */}
      <div className={styles.themePicker}>
        {THEMES.map(t => (
          <button
            key={t.id}
            className={`${styles.themeDot} ${activeTheme === t.id ? styles.themeDotActive : ''}`}
            style={{ '--dot-color': t.swatch }}
            onClick={() => applyTheme(t.id)}
            title={t.label}
          />
        ))}
      </div>
    </nav>
  );
}
