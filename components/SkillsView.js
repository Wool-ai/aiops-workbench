import { useState, useEffect, useRef } from 'react';
import styles from '../styles/SkillsView.module.css';

// ── Shared helpers ────────────────────────────────────────────────────────────

function ScopeBadge({ scope }) {
  return (
    <span className={scope === 'global' ? styles.badgeGlobal : styles.badgeProject}>
      {scope === 'global' ? 'global' : 'project'}
    </span>
  );
}

function EmptyState({ icon, message, action, onAction }) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}>{icon}</span>
      <span>{message}</span>
      {action && <button className={styles.emptyBtn} onClick={onAction}>{action}</button>}
    </div>
  );
}

// ── Skill editor ──────────────────────────────────────────────────────────────

const SKILL_PLACEHOLDERS = [
  'Describe what this skill does and how Claude should behave...',
  'Example:\nAnalyze the current task carefully.\nBreak it into subtasks.\nFor each subtask, use the appropriate tools...',
].join('\n\n');

function SkillForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || '');
  const [scope, setScope] = useState(initial?.scope || 'project');
  const [content, setContent] = useState(initial?.content || '');
  const [error, setError] = useState('');
  const isEditing = !!initial;

  function submit(e) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    if (!/^[a-zA-Z0-9_-]+$/.test(name.trim())) { setError('Name can only contain letters, numbers, hyphens, and underscores'); return; }
    if (!content.trim()) { setError('Content is required'); return; }
    setError('');
    onSave({ name: name.trim(), scope, content });
  }

  return (
    <form className={styles.editorForm} onSubmit={submit}>
      {!isEditing && (
        <div className={styles.formRow}>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Skill name</label>
            <input
              className={styles.formInput}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. analyze-task"
              required
            />
            <span className={styles.formHint}>Invoked as <code>/{name || 'skill-name'}</code> in Claude Code</span>
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Scope</label>
            <div className={styles.scopeToggle}>
              {['project', 'global'].map(s => (
                <button
                  key={s}
                  type="button"
                  className={`${styles.scopeBtn} ${scope === s ? styles.scopeBtnOn : ''}`}
                  onClick={() => setScope(s)}
                >{s}</button>
              ))}
            </div>
            <span className={styles.formHint}>
              {scope === 'project' ? '.claude/commands/ in this project' : '~/.claude/commands/ across all projects'}
            </span>
          </div>
        </div>
      )}

      <div className={styles.formField} style={{ flex: 1 }}>
        <label className={styles.formLabel}>Prompt / instructions</label>
        <textarea
          className={styles.contentArea}
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={SKILL_PLACEHOLDERS}
          spellCheck={false}
        />
      </div>

      {error && <div className={styles.formError}>{error}</div>}

      <div className={styles.formActions}>
        <button type="submit" className={styles.saveBtn}>{isEditing ? 'Save changes' : 'Create skill'}</button>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

// ── Skills tab ────────────────────────────────────────────────────────────────

function SkillsTab({ onEdit }) {
  const [data, setData] = useState({ project: [], global: [] });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  function reload() {
    fetch('/api/skills')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { reload(); }, []);

  async function handleSave(payload) {
    const method = editTarget ? 'PUT' : 'POST';
    await fetch('/api/skills', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    reload();
    setCreating(false);
    setEditTarget(null);
  }

  async function handleDelete(skill) {
    if (!confirm(`Delete skill "/${skill.name}"?`)) return;
    await fetch(`/api/skills?name=${skill.name}&scope=${skill.scope}`, { method: 'DELETE' });
    reload();
  }

  const all = [...data.project, ...data.global];

  if (creating || editTarget) {
    return (
      <div className={styles.editorPanel}>
        <div className={styles.editorHeader}>
          <span className={styles.editorTitle}>
            {editTarget ? `Edit /${editTarget.name}` : 'New skill'}
          </span>
          <button className={styles.editorClose} onClick={() => { setCreating(false); setEditTarget(null); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <SkillForm
          initial={editTarget || undefined}
          onSave={handleSave}
          onCancel={() => { setCreating(false); setEditTarget(null); }}
        />
      </div>
    );
  }

  if (loading) return <div className={styles.empty}><span>Loading…</span></div>;

  if (all.length === 0) {
    return (
      <EmptyState
        icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.25 }}><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>}
        message="No skills yet — create your first custom Claude Code command"
        action="Create skill"
        onAction={() => setCreating(true)}
      />
    );
  }

  return (
    <div className={styles.listPane}>
      <div className={styles.listActions}>
        <button className={styles.newBtn} onClick={() => setCreating(true)}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New skill
        </button>
      </div>

      {[{ label: 'Project skills', items: data.project, scope: 'project' }, { label: 'Global skills', items: data.global, scope: 'global' }].map(group => (
        group.items.length > 0 && (
          <div key={group.scope} className={styles.group}>
            <div className={styles.groupLabel}>{group.label}</div>
            {group.items.map(skill => (
              <div key={skill.name} className={styles.skillCard}>
                <div className={styles.skillCardLeft}>
                  <div className={styles.skillNameRow}>
                    <ScopeBadge scope={skill.scope} />
                    <span className={styles.skillName}>/{skill.name}</span>
                  </div>
                  <p className={styles.skillPreview}>{skill.content.split('\n')[0].slice(0, 120)}</p>
                </div>
                <div className={styles.skillActions}>
                  <button className={styles.editBtn} onClick={() => setEditTarget(skill)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Edit
                  </button>
                  <button className={styles.deleteBtn} onClick={() => handleDelete(skill)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/>
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ))}
    </div>
  );
}

// ── Template editor ───────────────────────────────────────────────────────────

function TemplateForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [content, setContent] = useState(initial?.content || '');
  const [error, setError] = useState('');

  function submit(e) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    if (!content.trim()) { setError('Content is required'); return; }
    setError('');
    onSave({ name: name.trim(), description: description.trim(), content });
  }

  return (
    <form className={styles.editorForm} onSubmit={submit}>
      <div className={styles.formRow}>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Template name</label>
          <input className={styles.formInput} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Code review" required />
        </div>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Description (optional)</label>
          <input className={styles.formInput} value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description" />
        </div>
      </div>

      <div className={styles.formField} style={{ flex: 1 }}>
        <label className={styles.formLabel}>Prompt content</label>
        <textarea
          className={styles.contentArea}
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={'Write the reusable prompt that will be injected when this template is used...\n\nYou can reference {{task.name}}, {{project.name}}, {{bucket}} placeholders.'}
          spellCheck={false}
        />
      </div>

      {error && <div className={styles.formError}>{error}</div>}

      <div className={styles.formActions}>
        <button type="submit" className={styles.saveBtn}>{initial ? 'Save changes' : 'Create template'}</button>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

// ── Templates tab ─────────────────────────────────────────────────────────────

function TemplatesTab() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  function reload() {
    fetch('/api/templates')
      .then(r => r.json())
      .then(d => { setTemplates(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { reload(); }, []);

  async function handleSave(payload) {
    if (editTarget) {
      await fetch('/api/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editTarget.id, ...payload }),
      });
    } else {
      await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    reload();
    setCreating(false);
    setEditTarget(null);
  }

  async function handleDelete(tpl) {
    if (!confirm(`Delete template "${tpl.name}"?`)) return;
    await fetch(`/api/templates?id=${tpl.id}`, { method: 'DELETE' });
    reload();
  }

  if (creating || editTarget) {
    return (
      <div className={styles.editorPanel}>
        <div className={styles.editorHeader}>
          <span className={styles.editorTitle}>{editTarget ? `Edit "${editTarget.name}"` : 'New template'}</span>
          <button className={styles.editorClose} onClick={() => { setCreating(false); setEditTarget(null); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <TemplateForm
          initial={editTarget || undefined}
          onSave={handleSave}
          onCancel={() => { setCreating(false); setEditTarget(null); }}
        />
      </div>
    );
  }

  if (loading) return <div className={styles.empty}><span>Loading…</span></div>;

  if (templates.length === 0) {
    return (
      <EmptyState
        icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.25 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>}
        message="No templates yet — save reusable prompts to attach to any task or schedule"
        action="Create template"
        onAction={() => setCreating(true)}
      />
    );
  }

  return (
    <div className={styles.listPane}>
      <div className={styles.listActions}>
        <button className={styles.newBtn} onClick={() => setCreating(true)}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New template
        </button>
      </div>

      <div className={styles.group}>
        {templates.map(tpl => (
          <div key={tpl.id} className={styles.templateCard}>
            <div className={styles.templateCardLeft}>
              <span className={styles.templateName}>{tpl.name}</span>
              {tpl.description && <span className={styles.templateDesc}>{tpl.description}</span>}
              <p className={styles.templatePreview}>{tpl.content.slice(0, 160)}{tpl.content.length > 160 ? '…' : ''}</p>
            </div>
            <div className={styles.skillActions}>
              <button className={styles.editBtn} onClick={() => setEditTarget(tpl)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Edit
              </button>
              <button className={styles.deleteBtn} onClick={() => handleDelete(tpl)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/>
                </svg>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Root view ─────────────────────────────────────────────────────────────────

export default function SkillsView() {
  const [tab, setTab] = useState('skills');

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>Skills &amp; Templates</span>
        </div>
        <div className={styles.tabBar}>
          <button className={`${styles.tabBtn} ${tab === 'skills' ? styles.tabBtnOn : ''}`} onClick={() => setTab('skills')}>
            Skills
          </button>
          <button className={`${styles.tabBtn} ${tab === 'templates' ? styles.tabBtnOn : ''}`} onClick={() => setTab('templates')}>
            Templates
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {tab === 'skills' ? <SkillsTab /> : <TemplatesTab />}
      </div>
    </div>
  );
}
