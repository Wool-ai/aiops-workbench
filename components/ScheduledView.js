import { useState, useEffect, useRef } from 'react';
import { describeSchedule } from '../lib/scheduleUtils';
import styles from '../styles/ScheduledView.module.css';

const DEFAULT_TOOLS = [
  'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'LS',
  'WebFetch', 'WebSearch', 'TodoWrite', 'TodoRead',
];

const ALL_TOOLS = [
  { name: 'Bash',        desc: 'Run shell commands',    isDefault: true  },
  { name: 'Read',        desc: 'Read files',            isDefault: true  },
  { name: 'Write',       desc: 'Write files',           isDefault: true  },
  { name: 'Edit',        desc: 'Edit files',            isDefault: true  },
  { name: 'Glob',        desc: 'Find files by pattern', isDefault: true  },
  { name: 'Grep',        desc: 'Search file contents',  isDefault: true  },
  { name: 'LS',          desc: 'List directories',      isDefault: true  },
  { name: 'WebFetch',    desc: 'Fetch web pages',       isDefault: true  },
  { name: 'WebSearch',   desc: 'Search the web',        isDefault: true  },
  { name: 'TodoWrite',   desc: 'Write todo lists',      isDefault: true  },
  { name: 'TodoRead',    desc: 'Read todo lists',       isDefault: true  },
  { name: 'Agent',       desc: 'Spawn sub-agents',      isDefault: false },
  { name: 'NotebookEdit',desc: 'Edit Jupyter notebooks',isDefault: false },
];

const EMPTY_FORM = {
  name: '',
  prompt: '',
  projectId: '',
  projectName: '',
  schedule: { type: 'daily', time: '09:00', day: 'monday', intervalMinutes: 60 },
  allowedTools: [...DEFAULT_TOOLS],
  agentIds: [],
};

function formatRelative(iso) {
  if (!iso) return '—';
  const diff = new Date(iso) - Date.now();
  const abs = Math.abs(diff);
  const past = diff < 0;
  if (abs < 60_000) return past ? 'just now' : 'in <1m';
  if (abs < 3_600_000) {
    const m = Math.round(abs / 60_000);
    return past ? `${m}m ago` : `in ${m}m`;
  }
  if (abs < 86_400_000) {
    const h = Math.round(abs / 3_600_000);
    return past ? `${h}h ago` : `in ${h}h`;
  }
  const d = Math.round(abs / 86_400_000);
  return past ? `${d}d ago` : `in ${d}d`;
}

function ScheduleForm({ initial, projects, onSave, onCancel, headerless }) {
  const initForm = f => ({
    ...EMPTY_FORM,
    ...f,
    allowedTools: f?.allowedTools?.length ? f.allowedTools : [...DEFAULT_TOOLS],
  });

  const [form, setForm] = useState(initForm(initial));
  const [customToolInput, setCustomToolInput] = useState('');
  const [mcpServers, setMcpServers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [availableAgents, setAvailableAgents] = useState([]);

  // Reset when switching between new/edit
  useEffect(() => { setForm(initForm(initial)); setCustomToolInput(''); }, [initial]);

  useEffect(() => {
    fetch('/api/mcp-servers')
      .then(r => r.json())
      .then(d => setMcpServers(Object.keys(d.mcpServers || {})))
      .catch(() => {});
    fetch('/api/templates')
      .then(r => r.json())
      .then(d => setTemplates(Array.isArray(d) ? d : []))
      .catch(() => {});
    fetch('/api/agents')
      .then(r => r.json())
      .then(d => setAvailableAgents(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }
  function setSchedule(key, val) { setForm(f => ({ ...f, schedule: { ...f.schedule, [key]: val } })); }
  function toggleTool(name) {
    setForm(f => {
      const has = f.allowedTools.includes(name);
      return { ...f, allowedTools: has ? f.allowedTools.filter(t => t !== name) : [...f.allowedTools, name] };
    });
  }
  function addCustomTool() {
    const name = customToolInput.trim();
    if (!name || form.allowedTools.includes(name)) { setCustomToolInput(''); return; }
    setForm(f => ({ ...f, allowedTools: [...f.allowedTools, name] }));
    setCustomToolInput('');
  }
  function removeCustomTool(name) {
    setForm(f => ({ ...f, allowedTools: f.allowedTools.filter(t => t !== name) }));
  }

  function handleProject(e) {
    const id = e.target.value;
    const proj = projects.find(p => p.id === id);
    setForm(f => ({ ...f, projectId: id, projectName: proj?.name || '' }));
  }

  function submit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.prompt.trim()) return;
    onSave(form);
  }

  const { schedule } = form;
  const isEditing = !!initial;

  return (
    <form className={styles.form} onSubmit={submit}>
      {!headerless && (
        <div className={styles.formHeader}>
          <span className={styles.formTitle}>{isEditing ? 'Edit schedule' : 'New schedule'}</span>
          {onCancel && (
            <button type="button" className={styles.formCloseBtn} onClick={onCancel} title="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
      )}

      <div className={styles.formFields}>
        <div className={styles.formField}>
          <label className={styles.label}>Name</label>
          <input
            className={styles.input}
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="e.g. Daily standup summary"
            required
          />
        </div>

        <div className={styles.formField}>
          <div className={styles.promptLabelRow}>
            <label className={styles.label}>Task prompt</label>
            {templates.length > 0 && (
              <select
                className={styles.templateSelect}
                defaultValue=""
                onChange={e => {
                  const tpl = templates.find(t => t.id === e.target.value);
                  if (tpl) set('prompt', tpl.content);
                  e.target.value = '';
                }}
              >
                <option value="" disabled>Insert template…</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
          </div>
          <textarea
            className={styles.textarea}
            value={form.prompt}
            onChange={e => set('prompt', e.target.value)}
            placeholder="Describe what AI should do on each run…"
            rows={5}
            required
          />
        </div>

        <div className={styles.formField}>
          <label className={styles.label}>Project (optional)</label>
          <select className={styles.select} value={form.projectId} onChange={handleProject}>
            <option value="">No project</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className={styles.formField}>
          <label className={styles.label}>Schedule type</label>
          <select
            className={styles.select}
            value={schedule.type}
            onChange={e => setSchedule('type', e.target.value)}
          >
            <option value="interval">Repeating interval</option>
            <option value="daily">Daily at a time</option>
            <option value="weekly">Weekly on a day</option>
          </select>
        </div>

        {schedule.type === 'interval' && (
          <div className={styles.formField}>
            <label className={styles.label}>Every (minutes)</label>
            <div className={styles.inlineRow}>
              <input
                type="number"
                className={styles.input}
                min={5}
                max={10080}
                value={schedule.intervalMinutes}
                onChange={e => setSchedule('intervalMinutes', Number(e.target.value))}
              />
              <span className={styles.inlineHint}>min</span>
            </div>
          </div>
        )}

        {schedule.type === 'weekly' && (
          <div className={styles.formField}>
            <label className={styles.label}>Day of week</label>
            <select
              className={styles.select}
              value={schedule.day}
              onChange={e => setSchedule('day', e.target.value)}
            >
              {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(d => (
                <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
              ))}
            </select>
          </div>
        )}

        {(schedule.type === 'daily' || schedule.type === 'weekly') && (
          <div className={styles.formField}>
            <label className={styles.label}>Time</label>
            <input
              type="time"
              className={styles.input}
              value={schedule.time}
              onChange={e => setSchedule('time', e.target.value)}
            />
          </div>
        )}

        {availableAgents.length > 0 && (
          <div className={styles.formField}>
            <label className={styles.label}>
              Agents
              {(form.agentIds || []).length > 1 && <span className={styles.agentOrchestratorNote}> — orchestration mode</span>}
            </label>
            <div className={styles.toolsGrid}>
              {availableAgents.map(agent => {
                const checked = (form.agentIds || []).includes(agent.id);
                return (
                  <label
                    key={agent.id}
                    className={`${styles.toolChk} ${styles.toolChkMcp} ${checked ? styles.toolChkMcpOn : ''}`}
                    title={agent.description || agent.role}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const ids = form.agentIds || [];
                        setForm(f => ({
                          ...f,
                          agentIds: ids.includes(agent.id) ? ids.filter(id => id !== agent.id) : [...ids, agent.id],
                        }));
                      }}
                    />
                    <span className={styles.toolChkName}>{agent.name}</span>
                    <span className={styles.toolChkExtra}>{agent.role}</span>
                  </label>
                );
              })}
            </div>
            <span className={styles.toolsHint}>
              Select one agent to run it directly, or multiple agents to enable orchestration mode where the first agent coordinates the rest.
            </span>
          </div>
        )}

        <div className={styles.formField}>
          <label className={styles.label}>Tool permissions</label>
          <div className={styles.toolsGrid}>
            {ALL_TOOLS.map(tool => {
              const checked = form.allowedTools.includes(tool.name);
              return (
                <label
                  key={tool.name}
                  className={`${styles.toolChk} ${checked ? styles.toolChkOn : ''}`}
                  title={tool.desc}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleTool(tool.name)}
                  />
                  <span className={styles.toolChkName}>{tool.name}</span>
                  {!tool.isDefault && <span className={styles.toolChkExtra}>+</span>}
                </label>
              );
            })}
          </div>
          {mcpServers.length > 0 && (
            <>
              <span className={styles.mcpSectionLabel}>MCP Servers</span>
              <div className={styles.toolsGrid}>
                {mcpServers.map(srv => {
                  const wildcard = `mcp__${srv}__*`;
                  const checked = form.allowedTools.includes(wildcard);
                  return (
                    <label
                      key={srv}
                      className={`${styles.toolChk} ${styles.toolChkMcp} ${checked ? styles.toolChkMcpOn : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTool(wildcard)}
                      />
                      <span className={styles.toolChkName}>{srv}</span>
                      <span className={styles.toolChkExtra}>mcp</span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
          {/* Custom tool tags for specific tool names not in the grids above */}
          {form.allowedTools.filter(t => !ALL_TOOLS.find(a => a.name === t) && !mcpServers.includes(t.replace(/^mcp__(.+)__\*$/, '$1'))).length > 0 && (
            <div className={styles.customTagsRow}>
              {form.allowedTools.filter(t => !ALL_TOOLS.find(a => a.name === t) && !mcpServers.includes(t.replace(/^mcp__(.+)__\*$/, '$1'))).map(name => (
                <span key={name} className={styles.customTag}>
                  {name}
                  <button
                    type="button"
                    className={styles.customTagRemove}
                    onClick={() => removeCustomTool(name)}
                    title={`Remove ${name}`}
                  >×</button>
                </span>
              ))}
            </div>
          )}
          <div className={styles.customToolRow}>
            <input
              className={styles.customToolInput}
              value={customToolInput}
              onChange={e => setCustomToolInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTool(); } }}
              placeholder="mcp__server__specific_tool or custom name…"
            />
            <button
              type="button"
              className={styles.customToolAdd}
              onClick={addCustomTool}
              disabled={!customToolInput.trim()}
            >Add</button>
          </div>
          <span className={styles.toolsHint}>
            {form.allowedTools.length} tool{form.allowedTools.length !== 1 ? 's' : ''} allowed
          </span>
        </div>
      </div>

      <div className={styles.formActions}>
        <button type="submit" className={styles.saveBtn}>
          {isEditing ? 'Save changes' : 'Create schedule'}
        </button>
        {onCancel && !headerless && (
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
        )}
      </div>
    </form>
  );
}

function ScheduleCard({ schedule, active, onSelect, onToggle, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      className={`${styles.card} ${active ? styles.cardActive : ''} ${!schedule.enabled ? styles.cardDisabled : ''}`}
      onClick={() => onSelect(schedule)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onSelect(schedule)}
    >
      <div className={styles.cardTop}>
        <div className={styles.cardInfo}>
          <span className={styles.cardName}>{schedule.name}</span>
          <span className={styles.cardFreq}>{describeSchedule(schedule.schedule)}</span>
        </div>
        <div className={styles.cardBadges} onClick={e => e.stopPropagation()}>
          <button
            className={`${styles.togglePill} ${schedule.enabled ? styles.pillOn : styles.pillOff}`}
            onClick={() => onToggle(schedule)}
            title={schedule.enabled ? 'Pause' : 'Enable'}
          >
            {schedule.enabled ? 'On' : 'Off'}
          </button>
          {confirmDelete ? (
            <span className={styles.deleteConfirm}>
              <button className={styles.deleteYes} onClick={() => onDelete(schedule.id)}>Delete</button>
              <button className={styles.deleteNo} onClick={() => setConfirmDelete(false)}>No</button>
            </span>
          ) : (
            <button className={styles.iconBtn} onClick={() => setConfirmDelete(true)} title="Delete">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      <p className={styles.cardPrompt}>{schedule.prompt}</p>

      <div className={styles.cardMeta}>
        {schedule.projectName && (
          <span className={styles.metaTag}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            {schedule.projectName}
          </span>
        )}
        <span className={styles.metaItem}>Next <strong>{formatRelative(schedule.nextRun)}</strong></span>
        {schedule.lastRun && <span className={styles.metaItem}>Last <strong>{formatRelative(schedule.lastRun)}</strong></span>}
        <span className={styles.metaItem}>Runs <strong>{schedule.runCount || 0}</strong></span>
      </div>
    </div>
  );
}

const RUN_TYPE_META = {
  completed:          { label: 'Completed',         color: 'var(--done-c)',    bg: 'var(--done-bg)' },
  issue:              { label: 'Issue',              color: 'var(--review-c)',  bg: 'var(--review-bg)' },
  human_input:        { label: 'Needs input',        color: 'var(--inprog-c)', bg: 'var(--inprog-bg)' },
  permission_required:{ label: 'Needs approval',     color: 'var(--mcp-c)',          bg: 'var(--mcp-bg)' },
  processing:         { label: 'Running…',           color: 'var(--text3)',     bg: 'var(--surface3)' },
};

function RunHistory({ runs, onApproveRetry }) {
  if (runs.length === 0) {
    return (
      <div className={styles.runsEmpty}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.25 }}>
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
          <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
        </svg>
        No runs yet — this schedule hasn't fired.
      </div>
    );
  }

  return (
    <div className={styles.runsList}>
      {runs.map(run => {
        const meta = RUN_TYPE_META[run.type] || RUN_TYPE_META.issue;
        const isBlocked = run.type === 'permission_required' || run.type === 'human_input';
        return (
          <div key={run.id} className={styles.runEntry}>
            <div className={styles.runHeader}>
              <span
                className={styles.runBadge}
                style={{ color: meta.color, background: meta.bg }}
              >
                {run.type === 'processing' && (
                  <svg className={styles.runSpinner} width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                )}
                {meta.label}
              </span>
              <span className={styles.runTime}>
                {new Date(run.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {run.type === 'processing' ? (
              <div className={styles.runProcessing}>
                {(run.toolHistory || []).length > 0 ? (
                  <div className={styles.runToolFeed}>
                    {(run.toolHistory || []).slice(-6).map((tool, i, arr) => {
                      const isActive = i === arr.length - 1;
                      const label = tool.replace(/^mcp__\w+__/, '').replace(/_/g, ' ');
                      return (
                        <div key={i} className={`${styles.runToolItem} ${isActive ? styles.runToolActive : styles.runToolDone}`}>
                          {isActive ? (
                            <svg className={styles.runSpinner} width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
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
                  <span className={styles.runIdle}>
                    <svg className={styles.runSpinner} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    AI is processing…
                  </span>
                )}
                {run.streamText?.trim() && (
                  <pre className={styles.runStreamText}>{run.streamText.trim()}</pre>
                )}
              </div>
            ) : run.message ? (
              <pre className={styles.runOutput}>{run.message}</pre>
            ) : null}

            {run.deniedOperations && run.deniedOperations.length > 0 && (
              <div className={styles.runDenied}>
                <span className={styles.runDeniedLabel}>Blocked operations:</span>
                {run.deniedOperations.map((op, i) => (
                  <span key={i} className={styles.runDeniedOp}>{op.tool}{op.input ? ` — ${JSON.stringify(op.input).slice(0, 60)}` : ''}</span>
                ))}
              </div>
            )}

            {isBlocked && onApproveRetry && (
              <button className={styles.runApproveBtn} onClick={() => onApproveRetry(run)}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Approve &amp; retry
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ScheduledView({ projects, notifications = [], selectedProjectId = '', onApproveRetry }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState(null); // null | 'new' | schedule object (editing)
  const [tab, setTab] = useState('logs'); // 'edit' | 'logs'
  const [saveError, setSaveError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/schedules')
      .then(r => { if (!r.ok) throw new Error('Failed to load schedules'); return r.json(); })
      .then(s => { setSchedules(s); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function selectCard(schedule) {
    const alreadyOpen = panel && panel !== 'new' && panel.id === schedule.id;
    if (alreadyOpen) { setPanel(null); return; }
    setPanel(schedule);
    setTab('edit');
    setSaveError(null);
  }

  async function handleSave(form) {
    setSaveError(null);
    try {
      if (panel && panel !== 'new') {
        const res = await fetch('/api/schedules', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: panel.id, ...form }),
        });
        if (!res.ok) throw new Error(`Save failed (${res.status})`);
        const updated = await res.json();
        setSchedules(prev => prev.map(s => s.id === updated.id ? updated : s));
        setPanel(updated);
        setTab('logs');
      } else {
        const res = await fetch('/api/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error(`Save failed (${res.status})`);
        const created = await res.json();
        setSchedules(prev => [created, ...prev]);
        setPanel(created);
        setTab('logs');
      }
    } catch (err) {
      setSaveError(err.message || 'Failed to save schedule');
    }
  }

  async function handleToggle(schedule) {
    try {
      const res = await fetch('/api/schedules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: schedule.id, enabled: !schedule.enabled }),
      });
      if (!res.ok) throw new Error(`Toggle failed (${res.status})`);
      const updated = await res.json();
      setSchedules(prev => prev.map(s => s.id === updated.id ? updated : s));
      if (panel && panel !== 'new' && panel.id === updated.id) setPanel(updated);
    } catch (err) {
      setSaveError(err.message || 'Failed to update schedule');
    }
  }

  async function handleDelete(id) {
    try {
      const res = await fetch(`/api/schedules?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setSchedules(prev => prev.filter(s => s.id !== id));
      if (panel && panel !== 'new' && panel.id === id) setPanel(null);
    } catch (err) {
      setSaveError(err.message || 'Failed to delete schedule');
    }
  }

  const q = search.trim().toLowerCase();
  const visibleSchedules = schedules.filter(s => {
    if (selectedProjectId && s.projectId !== selectedProjectId) return false;
    if (q && !s.name.toLowerCase().includes(q) && !(s.prompt || '').toLowerCase().includes(q)) return false;
    return true;
  });

  const activeCount = visibleSchedules.filter(s => s.enabled).length;

  // Runs for the selected schedule — all non-processing first, then processing
  const selectedRuns = panel && panel !== 'new'
    ? notifications
        .filter(n => n.scheduled && n.scheduleId === panel.id)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    : [];

  const isNew = panel === 'new';
  const isEditing = panel && !isNew;

  return (
    <div className={styles.root}>
      {/* ── Left column: list ── */}
      <div className={styles.listCol}>
        <div className={styles.listHeader}>
          <div className={styles.listHeaderLeft}>
            <span className={styles.listTitle}>Schedules</span>
            {visibleSchedules.length > 0 && (
              <span className={styles.listCount}>{visibleSchedules.length}</span>
            )}
            {activeCount > 0 && (
              <span className={styles.activeChip}>{activeCount} active</span>
            )}
          </div>
          <button className={styles.newBtn} onClick={() => { setPanel('new'); setTab('edit'); }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New
          </button>
        </div>

        <div className={styles.searchBar}>
          <input
            className={styles.searchInput}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search schedules…"
            aria-label="Search schedules"
          />
          {search && (
            <button className={styles.clearSearch} onClick={() => setSearch('')} aria-label="Clear search">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        {loading ? (
          <div className={styles.listEmpty}>Loading…</div>
        ) : schedules.length === 0 ? (
          <div className={styles.listEmpty}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="8 14 11 17 16 12"/>
            </svg>
            No schedules yet
            <button className={styles.emptyCreateBtn} onClick={() => { setPanel('new'); setTab('edit'); }}>Create your first</button>
          </div>
        ) : visibleSchedules.length === 0 ? (
          <div className={styles.listEmpty}>No schedules match your search.</div>
        ) : (
          <div className={styles.list}>
            {visibleSchedules.map(s => (
              <ScheduleCard
                key={s.id}
                schedule={s}
                active={isEditing && panel.id === s.id}
                onSelect={selectCard}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Right column: tabbed panel ── */}
      <div className={styles.formCol}>
        {!panel ? (
          <div className={styles.formPlaceholder}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.2 }}>
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="8 14 11 17 16 12"/>
            </svg>
            <span>Select a schedule to view its logs, or create a new one</span>
          </div>
        ) : (
          <div className={styles.panelWrap}>
            {/* Panel header with tabs */}
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>
                {isNew ? 'New schedule' : panel.name}
              </span>
              <div className={styles.panelRight}>
                {!isNew && (
                  <div className={styles.tabs}>
                    <button
                      type="button"
                      className={`${styles.tab} ${tab === 'logs' ? styles.tabActive : ''}`}
                      onClick={() => setTab('logs')}
                    >
                      Logs
                      {selectedRuns.length > 0 && (
                        <span className={styles.tabCount}>{selectedRuns.length}</span>
                      )}
                    </button>
                    <button
                      type="button"
                      className={`${styles.tab} ${tab === 'edit' ? styles.tabActive : ''}`}
                      onClick={() => setTab('edit')}
                    >
                      Edit
                    </button>
                  </div>
                )}
                <button type="button" className={styles.formCloseBtn} onClick={() => setPanel(null)} title="Close">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Error banner */}
            {saveError && (
              <div style={{ padding: '8px 16px', background: 'var(--danger-glow)', borderBottom: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0 }}>
                <span>{saveError}</span>
                <button type="button" onClick={() => setSaveError(null)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>✕</button>
              </div>
            )}

            {/* Tab content */}
            {(isNew || tab === 'edit') ? (
              <ScheduleForm
                initial={isNew ? null : panel}
                projects={projects}
                onSave={handleSave}
                onCancel={() => setPanel(null)}
                headerless
              />
            ) : (
              <RunHistory runs={selectedRuns} onApproveRetry={onApproveRetry} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
