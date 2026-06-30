import { useState, useEffect, useRef, useCallback } from 'react';
import Avatar from './Avatar';
import { COLUMN_LABELS, COLUMNS, ASSIGNEES, PRIORITY_ORDER, PRIORITY_META } from '../lib/data';
import styles from '../styles/TaskPanel.module.css';

const DEFAULT_TOOLS = [
  'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'LS',
  'WebFetch', 'WebSearch', 'TodoWrite', 'TodoRead',
];

const ALL_TOOLS = [
  { name: 'Bash',         isDefault: true  },
  { name: 'Read',         isDefault: true  },
  { name: 'Write',        isDefault: true  },
  { name: 'Edit',         isDefault: true  },
  { name: 'Glob',         isDefault: true  },
  { name: 'Grep',         isDefault: true  },
  { name: 'LS',           isDefault: true  },
  { name: 'WebFetch',     isDefault: true  },
  { name: 'WebSearch',    isDefault: true  },
  { name: 'TodoWrite',    isDefault: true  },
  { name: 'TodoRead',     isDefault: true  },
  { name: 'Agent',        isDefault: false },
  { name: 'NotebookEdit', isDefault: false },
];

export default function TaskPanel({ task, projectName, projectBuckets, onSave, onDelete, onClose, onRunWithAI, onGoToQueue, onOpenWorkspace }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [assignee, setAssignee] = useState('');
  const [col, setCol] = useState('todo');
  const [bucket, setBucket] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState('medium');
  const [comments, setComments] = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  const [subtaskInput, setSubtaskInput] = useState('');
  const [commentInput, setCommentInput] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [aiQueued, setAiQueued] = useState(false);
  const [showToolConfig, setShowToolConfig] = useState(false);
  const [allowedTools, setAllowedTools] = useState([...DEFAULT_TOOLS]);
  const [customToolInput, setCustomToolInput] = useState('');
  const [mcpServers, setMcpServers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [availableAgents, setAvailableAgents] = useState([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState([]);
  const nameRef = useRef(null);

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

  useEffect(() => {
    if (task) {
      setName(task.name || '');
      setDesc(task.desc || '');
      setAssignee(task.assignee || '');
      setCol(task.col || 'todo');
      setBucket(task.bucket || '');
      setDueDate(task.dueDate || '');
      setDueTime(task.dueTime || '');
      setPriority(task.priority || 'medium');
      setComments(task.comments || []);
      setSubtasks(task.subtasks || []);
      setSubtaskInput('');
      setShowDeleteConfirm(false);
      setShowToolConfig(false);
      setAllowedTools([...DEFAULT_TOOLS]);
      setCustomToolInput('');
      setSelectedTemplate('');
      setSelectedAgentIds([]);
    }
    setTimeout(() => nameRef.current?.focus(), 60);
  }, [task?.id]);

  // Sync status, assignee, bucket, and comments when task is updated externally
  useEffect(() => {
    if (!task) return;
    setCol(task.col || 'todo');
    setAssignee(task.assignee || '');
    setBucket(task.bucket || '');
    setComments(task.comments || []);
  }, [task?.col, task?.assignee, task?.bucket, task?.comments?.length]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        if (showDeleteConfirm) setShowDeleteConfirm(false);
        else onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showDeleteConfirm, onClose]);

  if (!task) return null;

  function handleSave() {
    onSave({ ...task, name: name.trim() || 'Untitled task', desc, assignee, col, bucket, dueDate, dueTime, priority, comments, subtasks });
  }

  function addSubtask() {
    const name = subtaskInput.trim();
    if (!name) return;
    setSubtasks(prev => [...prev, { id: 's' + Date.now(), name, done: false }]);
    setSubtaskInput('');
  }

  function toggleSubtask(id) {
    setSubtasks(prev => prev.map(s => s.id === id ? { ...s, done: !s.done } : s));
  }

  function deleteSubtask(id) {
    setSubtasks(prev => prev.filter(s => s.id !== id));
  }

  function handleRunWithAI() {
    if (!onRunWithAI || aiQueued) return;
    const updatedTask = { ...task, name: name.trim() || 'Untitled task', desc, assignee, col, bucket, dueDate, dueTime, priority, comments, subtasks };
    onSave(updatedTask);
    setAiQueued(true);
    const tpl = templates.find(t => t.id === selectedTemplate);
    onRunWithAI(updatedTask, allowedTools, tpl?.content || undefined, selectedAgentIds.length ? selectedAgentIds : undefined);
    setTimeout(() => setAiQueued(false), 3000);
  }

  function toggleTool(name) {
    setAllowedTools(prev => prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]);
  }
  function addCustomTool() {
    const name = customToolInput.trim();
    if (!name || allowedTools.includes(name)) { setCustomToolInput(''); return; }
    setAllowedTools(prev => [...prev, name]);
    setCustomToolInput('');
  }
  function removeCustomTool(name) {
    setAllowedTools(prev => prev.filter(t => t !== name));
  }

  function handleAddComment() {
    const txt = commentInput.trim();
    if (!txt) return;
    setComments(prev => [...prev, { author: 'You', text: txt, time: 'just now' }]);
    setCommentInput('');
  }

  return (
    <div className={styles.panel} role="dialog" aria-modal="true" aria-label={`Task: ${name}`}>
      <div className={styles.panelHeader}>
        <span className={styles.projectLabel}>{projectName}</span>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div className={styles.statusRow}>
        {COLUMNS.map(c => (
          <button
            key={c}
            className={`${styles.statusChip} ${col === c ? styles['active_' + c] : ''}`}
            onClick={() => setCol(c)}
          >
            {COLUMN_LABELS[c]}
          </button>
        ))}
      </div>

      <div className={styles.panelBody}>
        <div className={styles.field}>
          <label className={styles.label}>Task name</label>
          <input
            ref={nameRef}
            className={styles.input}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="What needs to be done?"
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Description</label>
          <textarea
            className={styles.textarea}
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Add more context..."
            rows={4}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>
            Subtasks
            {subtasks.length > 0 && (
              <span className={styles.subtaskProgress}>
                {subtasks.filter(s => s.done).length}/{subtasks.length}
              </span>
            )}
          </label>
          {subtasks.length > 0 && (
            <div className={styles.subtaskList}>
              {subtasks.map(s => (
                <div key={s.id} className={styles.subtaskItem}>
                  <button
                    type="button"
                    className={`${styles.subtaskCheck} ${s.done ? styles.subtaskCheckDone : ''}`}
                    onClick={() => toggleSubtask(s.id)}
                  >
                    {s.done && (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </button>
                  <span className={`${styles.subtaskName} ${s.done ? styles.subtaskNameDone : ''}`}>{s.name}</span>
                  <button
                    type="button"
                    className={styles.subtaskDel}
                    onClick={() => deleteSubtask(s.id)}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className={styles.subtaskAddRow}>
            <input
              className={styles.subtaskInput}
              value={subtaskInput}
              onChange={e => setSubtaskInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }}
              placeholder="Add a subtask…"
            />
            <button
              type="button"
              className={styles.subtaskAddBtn}
              onClick={addSubtask}
              disabled={!subtaskInput.trim()}
            >Add</button>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Assignee</label>
          <div className={styles.assigneeRow}>
            {assignee && <Avatar name={assignee} size={22} />}
            <select className={styles.select} value={assignee} onChange={e => setAssignee(e.target.value)}>
              <option value="">Unassigned</option>
              {ASSIGNEES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Priority</label>
          <div className={styles.priorityRow}>
            {PRIORITY_ORDER.map(p => {
              const pm = PRIORITY_META[p];
              return (
                <button
                  key={p}
                  type="button"
                  className={`${styles.priorityBtn} ${priority === p ? styles.priorityBtnActive : ''}`}
                  style={priority === p ? { '--p-color': pm.color, '--p-bg': pm.bg } : {}}
                  onClick={() => setPriority(p)}
                >
                  <span className={styles.priorityDot} style={{ background: pm.color }} />
                  {pm.label}
                </button>
              );
            })}
          </div>
        </div>

        {projectBuckets && projectBuckets.length > 0 && (
          <div className={styles.field}>
            <label className={styles.label}>Work Bucket</label>
            <div className={styles.bucketRow}>
              <select className={styles.select} value={bucket} onChange={e => setBucket(e.target.value)}>
                <option value="">No bucket</option>
                {projectBuckets.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              {bucket && onOpenWorkspace && (
                <button
                  type="button"
                  className={styles.bucketWorkspaceBtn}
                  onClick={() => onOpenWorkspace(bucket)}
                  title={`Open workspace for "${bucket}"`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                  Workspace
                </button>
              )}
            </div>
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.label}>Due date</label>
          <div className={styles.dueDateQuick}>
            {[
              { label: 'Today', days: 0 },
              { label: 'Tomorrow', days: 1 },
              { label: '+3 days', days: 3 },
              { label: 'Next week', days: 7 },
            ].map(({ label, days }) => {
              const d = new Date();
              d.setDate(d.getDate() + days);
              const val = d.toISOString().slice(0, 10);
              return (
                <button
                  key={label}
                  type="button"
                  className={`${styles.dueDateQuickBtn} ${dueDate === val ? styles.dueDateQuickBtnActive : ''}`}
                  onClick={() => setDueDate(val)}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className={styles.dueDateRow}>
            <input
              className={styles.input}
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
            <input
              className={styles.input}
              type="time"
              value={dueTime}
              onChange={e => setDueTime(e.target.value)}
              disabled={!dueDate}
              placeholder="Time"
            />
            {dueDate && (
              <button
                className={styles.clearDueBtn}
                onClick={() => { setDueDate(''); setDueTime(''); }}
                title="Clear due date"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className={styles.commentsSection}>
          <div className={styles.commentsTitle}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Comments
            {comments.length > 0 && <span className={styles.commentCount}>({comments.length})</span>}
          </div>

          <div className={styles.commentsList}>
            {comments.length === 0 ? (
              <p className={styles.noComments}>No comments yet.</p>
            ) : (
              comments.map((c, i) => {
                if (c.author === 'AI') {
                  return (
                    <div key={i} className={styles.aiComment}>
                      <div className={styles.aiCommentHeader}>
                        <div className={styles.aiCommentMeta}>
                          <span className={styles.aiCommentLabel}>AI</span>
                          {c.resultType && (
                            <span className={`${styles.aiCommentStatus} ${styles['aiCommentStatus_' + c.resultType]}`}>
                              {c.resultType === 'human_input' ? 'needs input' : c.resultType === 'permission_required' ? 'permission' : c.resultType}
                            </span>
                          )}
                        </div>
                        <span className={styles.aiCommentTime}>{c.time}</span>
                        {c.aiNotifId && onGoToQueue && (
                          <button className={styles.aiCommentQueueBtn} onClick={onGoToQueue}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
                              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
                            </svg>
                            View in Queue
                          </button>
                        )}
                      </div>
                      <div className={styles.aiCommentText}>{c.text}</div>
                    </div>
                  );
                }
                return (
                  <div key={i} className={styles.comment}>
                    <Avatar name={c.author} size={24} />
                    <div className={styles.commentBody}>
                      <div className={styles.commentMeta}>
                        <span className={styles.commentAuthor}>{c.author}</span>
                        <span className={styles.commentTime}>{c.time}</span>
                      </div>
                      <div className={styles.commentText}>{c.text}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className={styles.commentInputRow}>
            <input
              className={styles.commentInput}
              value={commentInput}
              onChange={e => setCommentInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddComment()}
              placeholder="Add a comment…"
            />
            <button className={styles.sendBtn} onClick={handleAddComment}>Send</button>
          </div>
        </div>
      </div>

      {onRunWithAI && (
        <div className={styles.aiSection}>
          <div className={styles.aiTopRow}>
            <button
              className={`${styles.aiBtn} ${aiQueued ? styles.aiBtnQueued : ''}`}
              onClick={handleRunWithAI}
              disabled={aiQueued}
            >
              {aiQueued ? (
                <>
                  <svg className={styles.aiSpinner} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Queued for AI…
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                  Run with AI
                </>
              )}
            </button>
            {templates.length > 0 && (
              <select
                className={styles.aiTemplateSelect}
                value={selectedTemplate}
                onChange={e => setSelectedTemplate(e.target.value)}
                title="Attach a prompt template"
              >
                <option value="">No template</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
            <span className={styles.aiHint}>Queue tab</span>
            <button
              type="button"
              className={`${styles.aiToolsToggle} ${selectedAgentIds.length ? styles.aiToolsToggleOn : ''}`}
              onClick={() => setShowToolConfig(v => !v)}
              title="Select agents"
              style={{ display: availableAgents.length ? undefined : 'none' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/>
              </svg>
              Agents
              {selectedAgentIds.length > 0 && (
                <span className={styles.aiToolsBadge}>{selectedAgentIds.length}</span>
              )}
            </button>
            <button
              type="button"
              className={`${styles.aiToolsToggle} ${showToolConfig ? styles.aiToolsToggleOn : ''}`}
              onClick={() => setShowToolConfig(v => !v)}
              title="Configure tool permissions"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
              </svg>
              Tools
              {allowedTools.length !== DEFAULT_TOOLS.length && (
                <span className={styles.aiToolsBadge}>{allowedTools.length}</span>
              )}
            </button>
          </div>

          {showToolConfig && (
            <div className={styles.aiToolConfig}>
              {availableAgents.length > 0 && (
                <>
                  <div className={styles.aiMcpLabel}>Agents {selectedAgentIds.length > 1 && <span style={{ color: 'var(--accent)', fontWeight: 400 }}>— {selectedAgentIds.length} selected (orchestration mode)</span>}</div>
                  <div className={styles.aiToolGrid}>
                    {availableAgents.map(agent => {
                      const checked = selectedAgentIds.includes(agent.id);
                      return (
                        <label
                          key={agent.id}
                          className={`${styles.aiToolChip} ${styles.aiToolChipMcp} ${checked ? styles.aiToolChipMcpOn : ''}`}
                          title={agent.description || agent.role}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => setSelectedAgentIds(prev =>
                              prev.includes(agent.id) ? prev.filter(id => id !== agent.id) : [...prev, agent.id]
                            )}
                          />
                          <span>{agent.name}</span>
                          <span className={styles.aiToolExtra}>{agent.role}</span>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
              <div className={styles.aiToolGrid}>
                {ALL_TOOLS.map(tool => {
                  const checked = allowedTools.includes(tool.name);
                  return (
                    <label
                      key={tool.name}
                      className={`${styles.aiToolChip} ${checked ? styles.aiToolChipOn : ''}`}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggleTool(tool.name)} />
                      <span>{tool.name}</span>
                      {!tool.isDefault && <span className={styles.aiToolExtra}>+</span>}
                    </label>
                  );
                })}
              </div>
              {mcpServers.length > 0 && (
                <>
                  <div className={styles.aiMcpLabel}>MCP Servers</div>
                  <div className={styles.aiToolGrid}>
                    {mcpServers.map(srv => {
                      const wildcard = `mcp__${srv}__*`;
                      const checked = allowedTools.includes(wildcard);
                      return (
                        <label
                          key={srv}
                          className={`${styles.aiToolChip} ${styles.aiToolChipMcp} ${checked ? styles.aiToolChipMcpOn : ''}`}
                        >
                          <input type="checkbox" checked={checked} onChange={() => toggleTool(wildcard)} />
                          <span>{srv}</span>
                          <span className={styles.aiToolExtra}>mcp</span>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
              {allowedTools.filter(t => !ALL_TOOLS.find(a => a.name === t) && !mcpServers.includes(t.replace(/^mcp__(.+)__\*$/, '$1'))).length > 0 && (
                <div className={styles.aiCustomTags}>
                  {allowedTools.filter(t => !ALL_TOOLS.find(a => a.name === t) && !mcpServers.includes(t.replace(/^mcp__(.+)__\*$/, '$1'))).map(name => (
                    <span key={name} className={styles.aiCustomTag}>
                      {name}
                      <button type="button" className={styles.aiCustomTagRemove} onClick={() => removeCustomTool(name)}>×</button>
                    </span>
                  ))}
                </div>
              )}
              <div className={styles.aiCustomRow}>
                <input
                  className={styles.aiCustomInput}
                  value={customToolInput}
                  onChange={e => setCustomToolInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTool(); } }}
                  placeholder="mcp__server__specific_tool or custom name…"
                />
                <button
                  type="button"
                  className={styles.aiCustomAdd}
                  onClick={addCustomTool}
                  disabled={!customToolInput.trim()}
                >Add</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className={styles.panelFooter}>
        {showDeleteConfirm ? (
          <div className={styles.deleteConfirm}>
            <span className={styles.deleteConfirmText}>Delete this task?</span>
            <button className={styles.deleteConfirmNo} onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
            <button className={styles.deleteConfirmYes} onClick={onDelete}>Yes, delete</button>
          </div>
        ) : (
          <>
            <button className={styles.deleteBtn} onClick={() => setShowDeleteConfirm(true)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
              Delete
            </button>
            <div className={styles.footerRight}>
              <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
              <button className={styles.saveBtn} onClick={handleSave}>Save task</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
