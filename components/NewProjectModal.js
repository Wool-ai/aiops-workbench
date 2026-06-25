import { useState } from 'react';
import { PROJECT_COLORS } from '../lib/data';
import styles from '../styles/NewProjectModal.module.css';

export default function NewProjectModal({ onSave, onClose }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);

  function handleSave() {
    if (!name.trim()) return;
    onSave({ name: name.trim(), color });
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="New project">
        <div className={styles.header}>
          <span className={styles.title}>New project</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Project name</label>
          <input
            className={styles.input}
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Mobile App Redesign"
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Color</label>
          <div className={styles.colorPicker}>
            {PROJECT_COLORS.map(c => (
              <button
                key={c}
                className={styles.colorDot}
                style={{
                  background: c,
                  boxShadow: color === c ? `0 0 0 2px var(--bg), 0 0 0 4px ${c}` : 'none',
                }}
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={!name.trim()}>
            Create project
          </button>
        </div>
      </div>
    </div>
  );
}
