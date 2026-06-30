import { useState, useEffect } from 'react';
import AgentTaskExecutor from './AgentTaskExecutor';
import styles from '../styles/AgentsView.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const MODELS = [
  { id: 'claude-sonnet-4-6',          label: 'Sonnet 4.6',  note: 'Fast · balanced' },
  { id: 'claude-opus-4-8',            label: 'Opus 4.8',    note: 'Most capable'    },
  { id: 'claude-haiku-4-5-20251001',  label: 'Haiku 4.5',   note: 'Fastest · cheap' },
];

const ROLES = [
  { id: 'planner',    label: 'Planner',    color: '#60a5fa', desc: 'Breaks down complex tasks into ordered subtasks and delegates to other agents' },
  { id: 'researcher', label: 'Researcher', color: '#a78bfa', desc: 'Gathers context — reads files, searches the web, inspects codebases'           },
  { id: 'executor',   label: 'Executor',   color: '#4ade80', desc: 'Does the actual work — writes code, edits files, runs shell commands'           },
  { id: 'reviewer',   label: 'Reviewer',   color: '#fb923c', desc: 'Validates output, checks quality, and flags issues before completion'           },
  { id: 'custom',     label: 'Custom',     color: '#94a3b8', desc: 'Fully custom role with your own system prompt'                                  },
];

const ROLE_PROMPTS = {
  planner: `You are a meticulous task planner. Your job is to:
1. Analyze the given task carefully
2. Break it into clear, ordered subtasks with defined acceptance criteria
3. Identify which subtasks can run in parallel
4. Delegate each subtask to the appropriate specialized agent using the Agent tool
5. Collect and synthesize results from all agents
6. Report the overall outcome

Do not do implementation work yourself — plan and orchestrate only.`,

  researcher: `You are a thorough research agent. Your job is to:
1. Read all relevant files using Read, Glob, and Grep tools
2. Search the web for additional context if needed with WebSearch and WebFetch
3. Inspect the codebase structure and understand existing patterns
4. Summarize your findings clearly for the executing agent

Do not make any changes — research and report only.`,

  executor: `You are a precise implementation agent. Your job is to:
1. Receive a clear brief from the planner or orchestrator
2. Implement exactly what is specified using Bash, Write, Edit tools
3. Follow existing code patterns and conventions
4. Verify your changes compile or run correctly
5. Report exactly what was changed

Focus on correctness and completeness.`,

  reviewer: `You are a strict quality reviewer. Your job is to:
1. Read the changes made by the executor
2. Check for bugs, edge cases, and security issues
3. Verify the implementation matches the original requirements
4. Check code style and consistency with the codebase
5. Either approve the work or list specific issues that need fixing

Be thorough and direct. Flag any issue, no matter how small.`,

  custom: '',
};

const DEFAULT_TOOLS = ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'LS', 'WebFetch', 'WebSearch', 'TodoWrite', 'TodoRead'];
const ALL_TOOLS = [
  { name: 'Bash' }, { name: 'Read' }, { name: 'Write' }, { name: 'Edit' },
  { name: 'Glob' }, { name: 'Grep' }, { name: 'LS' }, { name: 'WebFetch' },
  { name: 'WebSearch' }, { name: 'TodoWrite' }, { name: 'TodoRead' },
  { name: 'Agent' }, { name: 'NotebookEdit' },
];

// ── Role badge ────────────────────────────────────────────────────────────────

function RoleBadge({ role }) {
  const r = ROLES.find(x => x.id === role) || ROLES[ROLES.length - 1];
  return (
    <span className={styles.roleBadge} style={{ '--role-color': r.color }}>
      {r.label}
    </span>
  );
}

// ── Agent form ────────────────────────────────────────────────────────────────

const EMPTY = {
  name: '', description: '', role: 'executor', model: 'claude-sonnet-4-6',
  systemPrompt: '', allowedTools: [...DEFAULT_TOOLS], useMcp: true,
};

function AgentForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(() => initial ? { ...EMPTY, ...initial } : { ...EMPTY });
  const [mcpServers, setMcpServers] = useState([]);
  const [customToolInput, setCustomToolInput] = useState('');

  useEffect(() => {
    fetch('/api/mcp-servers').then(r => r.json())
      .then(d => setMcpServers(Object.keys(d.mcpServers || {})))
      .catch(() => {});
  }, []);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function setRole(role) {
    setForm(f => ({
      ...f,
      role,
      systemPrompt: f.systemPrompt && f.systemPrompt !== ROLE_PROMPTS[f.role]
        ? f.systemPrompt
        : ROLE_PROMPTS[role] || '',
    }));
  }

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

  function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave({ ...form, name: form.name.trim() });
  }

  const customTools = form.allowedTools.filter(t =>
    !ALL_TOOLS.find(a => a.name === t) && !mcpServers.includes(t.replace(/^mcp__(.+)__\*$/, '$1'))
  );

  return (
    <form className={styles.agentForm} onSubmit={submit}>
      {/* Name + model */}
      <div className={styles.formRow}>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Name</label>
          <input className={styles.formInput} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Code Executor" required />
        </div>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Model</label>
          <select className={styles.formSelect} value={form.model} onChange={e => set('model', e.target.value)}>
            {MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.label} — {m.note}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Description */}
      <div className={styles.formField}>
        <label className={styles.formLabel}>Description</label>
        <input className={styles.formInput} value={form.description} onChange={e => set('description', e.target.value)} placeholder="What this agent specializes in…" />
      </div>

      {/* Role */}
      <div className={styles.formField}>
        <label className={styles.formLabel}>Role</label>
        <div className={styles.roleGrid}>
          {ROLES.map(r => (
            <button
              key={r.id}
              type="button"
              className={`${styles.roleBtn} ${form.role === r.id ? styles.roleBtnOn : ''}`}
              style={{ '--role-color': r.color }}
              onClick={() => setRole(r.id)}
              title={r.desc}
            >
              {r.label}
            </button>
          ))}
        </div>
        <span className={styles.formHint}>{ROLES.find(r => r.id === form.role)?.desc}</span>
      </div>

      {/* System prompt */}
      <div className={styles.formField} style={{ flex: 1 }}>
        <label className={styles.formLabel}>System prompt</label>
        <textarea
          className={styles.promptArea}
          value={form.systemPrompt}
          onChange={e => set('systemPrompt', e.target.value)}
          placeholder="Instructions that define this agent's behavior and focus…"
          spellCheck={false}
        />
      </div>

      {/* Tools */}
      <div className={styles.formField}>
        <label className={styles.formLabel}>Allowed tools</label>
        <div className={styles.toolGrid}>
          {ALL_TOOLS.map(tool => {
            const checked = form.allowedTools.includes(tool.name);
            return (
              <label key={tool.name} className={`${styles.toolChip} ${checked ? styles.toolChipOn : ''}`}>
                <input type="checkbox" checked={checked} onChange={() => toggleTool(tool.name)} />
                <span>{tool.name}</span>
              </label>
            );
          })}
        </div>

        {mcpServers.length > 0 && (
          <>
            <div className={styles.toolSectionLabel}>MCP Servers</div>
            <div className={styles.toolGrid}>
              {mcpServers.map(srv => {
                const wildcard = `mcp__${srv}__*`;
                const checked = form.allowedTools.includes(wildcard);
                return (
                  <label key={srv} className={`${styles.toolChip} ${styles.toolChipMcp} ${checked ? styles.toolChipMcpOn : ''}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleTool(wildcard)} />
                    <span>{srv}</span>
                    <span className={styles.toolChipExtra}>mcp</span>
                  </label>
                );
              })}
            </div>
          </>
        )}

        {customTools.length > 0 && (
          <div className={styles.customTags}>
            {customTools.map(name => (
              <span key={name} className={styles.customTag}>
                {name}
                <button type="button" className={styles.customTagRemove} onClick={() => removeCustomTool(name)}>×</button>
              </span>
            ))}
          </div>
        )}

        <div className={styles.customRow}>
          <input
            className={styles.customInput}
            value={customToolInput}
            onChange={e => setCustomToolInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTool(); } }}
            placeholder="custom tool name…"
          />
          <button type="button" className={styles.customAdd} onClick={addCustomTool} disabled={!customToolInput.trim()}>Add</button>
        </div>

        <div className={styles.mcpToggleRow}>
          <label className={styles.mcpToggle}>
            <input type="checkbox" checked={form.useMcp} onChange={e => set('useMcp', e.target.checked)} />
            <span>Auto-include MCP server wildcards</span>
          </label>
        </div>
      </div>

      <div className={styles.formActions}>
        <button type="submit" className={styles.saveBtn}>{initial ? 'Save changes' : 'Create agent'}</button>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function AgentsView({ projects = [] }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState(null); // null | 'new' | agent object
  const [selectedTab, setSelectedTab] = useState('configure');

  function reload() {
    fetch('/api/agents').then(r => r.json())
      .then(d => { setAgents(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { reload(); }, []);

  async function handleSave(payload) {
    if (panel !== 'new' && panel?.id) {
      await fetch('/api/agents', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: panel.id, ...payload }),
      });
    } else {
      await fetch('/api/agents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    reload();
    setPanel(null);
  }

  async function handleDelete(agent) {
    if (!confirm(`Delete agent "${agent.name}"?`)) return;
    await fetch(`/api/agents?id=${agent.id}`, { method: 'DELETE' });
    reload();
  }

  const isEditing = panel && panel !== 'new';
  const showForm = !!panel;

  return (
    <div className={styles.root}>
      {/* ── Agent list ── */}
      <div className={styles.listCol}>
        <div className={styles.listHeader}>
          <div className={styles.listHeaderLeft}>
            <span className={styles.listTitle}>AI Agents</span>
            {agents.length > 0 && <span className={styles.countBadge}>{agents.length}</span>}
          </div>
          <button className={styles.newBtn} onClick={() => setPanel('new')}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New agent
          </button>
        </div>

        <div className={styles.listBody}>
          {loading ? (
            <div className={styles.empty}><span>Loading…</span></div>
          ) : agents.length === 0 ? (
            <div className={styles.empty}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.2 }}>
                <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/>
                <circle cx="19" cy="19" r="3"/><line x1="19" y1="16" x2="19" y2="22"/><line x1="16" y1="19" x2="22" y2="19"/>
              </svg>
              <span>No agents yet</span>
              <button className={styles.emptyBtn} onClick={() => setPanel('new')}>Create your first agent</button>
            </div>
          ) : (
            agents.map(agent => (
              <div
                key={agent.id}
                className={`${styles.agentCard} ${panel?.id === agent.id ? styles.agentCardActive : ''}`}
                onClick={() => { setPanel(agent); setSelectedTab('configure'); }}
              >
                <div className={styles.agentCardTop}>
                  <RoleBadge role={agent.role} />
                  <span className={styles.agentCardName}>{agent.name}</span>
                  <span className={styles.agentCardModel}>{MODELS.find(m => m.id === agent.model)?.label || agent.model}</span>
                </div>
                {agent.description && (
                  <p className={styles.agentCardDesc}>{agent.description}</p>
                )}
                <div className={styles.agentCardFooter}>
                  <span className={styles.agentCardTools}>{agent.allowedTools.length} tools</span>
                  <button
                    className={styles.deleteBtn}
                    onClick={e => { e.stopPropagation(); handleDelete(agent); }}
                    title="Delete"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Form panel ── */}
      {showForm && (
        <div className={styles.formPanel}>
          <div className={styles.formPanelHeader}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <span className={styles.formPanelTitle}>
                {isEditing ? `Edit "${panel.name}"` : 'New agent'}
              </span>
              {isEditing && (
                <div className={styles.tabSwitcher}>
                  <button
                    className={`${styles.tab} ${selectedTab === 'configure' ? styles.tabActive : ''}`}
                    onClick={() => setSelectedTab('configure')}
                  >
                    Configure
                  </button>
                  <button
                    className={`${styles.tab} ${selectedTab === 'run' ? styles.tabActive : ''}`}
                    onClick={() => setSelectedTab('run')}
                  >
                    Run Tasks
                  </button>
                </div>
              )}
            </div>
            <button className={styles.formPanelClose} onClick={() => setPanel(null)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div className={styles.formPanelBody}>
            {selectedTab === 'configure' ? (
              <AgentForm
                initial={isEditing ? panel : null}
                onSave={handleSave}
                onCancel={() => setPanel(null)}
              />
            ) : (
              <AgentTaskExecutor
                agentId={panel.id}
                agentName={panel.name}
                projects={projects}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
