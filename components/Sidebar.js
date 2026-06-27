import { useState, useEffect } from 'react';
import styles from '../styles/Sidebar.module.css';

const THEMES = [
  { id: 'blue',  label: 'Blue',       swatch: 'linear-gradient(135deg, #070b12 50%, #2cb7d3 50%)' },
  { id: 'green', label: 'Green',      swatch: 'linear-gradient(135deg, #070b12 50%, #4fffb0 50%)' },
  { id: 'dark',  label: 'Pure Dark',  swatch: 'linear-gradient(135deg, #050507 50%, #9898b8 50%)' },
  { id: 'white', label: 'Light',      swatch: 'linear-gradient(135deg, #eef1f7 50%, #2563eb 50%)' },
];

const VIEWS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" rx="1"/>
        <rect x="14" y="3" width="7" height="5" rx="1"/>
        <rect x="14" y="12" width="7" height="9" rx="1"/>
        <rect x="3" y="16" width="7" height="5" rx="1"/>
      </svg>
    ),
  },
  {
    id: 'board',
    label: 'Board',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="5" height="18" rx="1"/>
        <rect x="10" y="3" width="5" height="11" rx="1"/>
        <rect x="17" y="3" width="4" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    id: 'backlog',
    label: 'Backlog',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"/>
        <line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/>
        <circle cx="3" cy="6" r="1.2" fill="currentColor" stroke="none"/>
        <circle cx="3" cy="12" r="1.2" fill="currentColor" stroke="none"/>
        <circle cx="3" cy="18" r="1.2" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    id: 'queue',
    label: 'Queue',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
      </svg>
    ),
  },
  {
    id: 'reminders',
    label: 'Reminders',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
  {
    id: 'daily',
    label: 'Daily',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <line x1="8" y1="14" x2="8" y2="14" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="12" y1="14" x2="12" y2="14" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="8" y1="18" x2="8" y2="18" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="12" y1="18" x2="12" y2="18" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="16" y1="14" x2="16" y2="14" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export default function Sidebar({ activeView, onViewChange, queueUnread = 0, remindersOverdue = 0 }) {
  const [activeTheme, setActiveTheme] = useState('blue');

  useEffect(() => {
    const saved = localStorage.getItem('aiops-theme') || 'blue';
    setActiveTheme(saved);
  }, []);

  function applyTheme(id) {
    setActiveTheme(id);
    localStorage.setItem('aiops-theme', id);
    document.documentElement.dataset.theme = id;
  }

  return (
    <nav className={styles.sidebar}>
      <div className={styles.logoMark}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="18"/>
          <rect x="14" y="3" width="7" height="10"/>
          <rect x="14" y="17" width="7" height="4"/>
        </svg>
      </div>

      <div className={styles.divider} />

      <div className={styles.nav}>
        {VIEWS.map(v => (
          <button
            key={v.id}
            className={`${styles.navBtn} ${activeView === v.id ? styles.active : ''}`}
            onClick={() => onViewChange(v.id)}
            title={v.label}
          >
            <span className={styles.iconWrap}>
              {v.icon}
              {v.id === 'queue' && queueUnread > 0 && (
                <span className={styles.badge}>{queueUnread > 9 ? '9+' : queueUnread}</span>
              )}
              {v.id === 'reminders' && remindersOverdue > 0 && (
                <span className={`${styles.badge} ${styles.badgeDanger}`}>{remindersOverdue > 9 ? '9+' : remindersOverdue}</span>
              )}
            </span>
          </button>
        ))}
      </div>

      <div className={styles.themePicker}>
        {THEMES.map(t => (
          <button
            key={t.id}
            className={`${styles.themeSwatch} ${activeTheme === t.id ? styles.themeSwatchActive : ''}`}
            style={{ background: t.swatch }}
            onClick={() => applyTheme(t.id)}
            title={t.label}
          />
        ))}
      </div>
    </nav>
  );
}
