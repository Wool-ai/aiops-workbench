import { useState, useEffect, useRef } from 'react';
import styles from '../styles/WorkspaceModal.module.css';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const TYPE_LABELS = { text: 'Text', markdown: 'Markdown', code: 'Code', json: 'JSON' };
const TYPE_COLORS = {
  text:     { bg: 'var(--artifact-text-bg)', color: 'var(--artifact-text-c)' },
  markdown: { bg: 'var(--artifact-markdown-bg)',  color: 'var(--artifact-markdown-c)' },
  code:     { bg: 'var(--artifact-code-bg)',  color: 'var(--artifact-code-c)' },
  json:     { bg: 'var(--artifact-json-bg)',  color: 'var(--artifact-json-c)' },
};

export default function WorkspaceModal({ project, bucketName, initialTab, onClose, onArtifactChange }) {
  const [tab, setTab] = useState(initialTab || 'instructions');

  // workspace state
  const [instructions, setInstructions] = useState('');
  const [files, setFiles] = useState([]);
  const [projectDir, setProjectDir] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [wsError, setWsError] = useState(null);
  const fileInputRef = useRef(null);

  // artifacts state
  const [artifacts, setArtifacts] = useState([]);
  const [artLoading, setArtLoading] = useState(false);
  const [artError, setArtError] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | artifact object
  const [artForm, setArtForm] = useState({ name: '', type: 'text', lang: '', content: '' });
  const [artSaving, setArtSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    loadWorkspace();
  }, [project.id, bucketName]);

  const artifactCount = project.artifacts?.length ?? 0;
  useEffect(() => {
    if (tab === 'artifacts') loadArtifacts();
  }, [tab, project.id, artifactCount]);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function loadWorkspace() {
    setLoading(true);
    setWsError(null);
    try {
      const params = new URLSearchParams({ projectId: project.id });
      if (bucketName) params.set('bucketName', bucketName);
      const res = await fetch(`/api/workspace?${params}`);
      const data = await res.json();
      setInstructions(data.instructions || '');
      setFiles(data.files || []);
      setProjectDir(data.projectDir || '');
    } catch {
      setWsError('Failed to load workspace');
    } finally {
      setLoading(false);
    }
  }

  async function loadArtifacts() {
    setArtLoading(true);
    setArtError(null);
    try {
      const res = await fetch(`/api/artifacts?projectId=${project.id}`);
      const data = await res.json();
      setArtifacts(data.artifacts || []);
    } catch {
      setArtError('Failed to load artifacts');
    } finally {
      setArtLoading(false);
    }
  }

  async function saveInstructions() {
    setSaving(true);
    setWsError(null);
    try {
      await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, bucketName, instructions }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setWsError('Failed to save instructions');
    } finally {
      setSaving(false);
    }
  }

  async function deleteFile(filename) {
    try {
      const params = new URLSearchParams({ projectId: project.id, filename });
      if (bucketName) params.set('bucketName', bucketName);
      await fetch(`/api/workspace?${params}`, { method: 'DELETE' });
      setFiles(prev => prev.filter(f => f.name !== filename));
    } catch {
      setWsError('Failed to delete file');
    }
  }

  async function handleFileSelect(e) {
    const selected = Array.from(e.target.files);
    if (!selected.length) return;
    setUploading(true);
    setWsError(null);
    for (const file of selected) {
      try {
        const contentBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const res = await fetch('/api/workspace-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: project.id, bucketName, filename: file.name, contentBase64 }),
        });
        if (!res.ok) {
          const d = await res.json();
          setWsError(d.error || 'Upload failed');
          continue;
        }
        const data = await res.json();
        setFiles(prev => {
          const without = prev.filter(f => f.name !== data.filename);
          return [...without, { name: data.filename, size: data.size, mtime: Date.now() }];
        });
      } catch {
        setWsError(`Failed to upload ${file.name}`);
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function openNew() {
    setArtForm({ name: '', type: 'text', lang: '', content: '' });
    setEditing('new');
    setArtError(null);
  }

  function openEdit(artifact) {
    setArtForm({ name: artifact.name, type: artifact.type, lang: artifact.lang || '', content: artifact.content });
    setEditing(artifact);
    setArtError(null);
  }

  function cancelEdit() {
    setEditing(null);
    setArtError(null);
  }

  async function saveArtifact() {
    if (!artForm.name.trim()) { setArtError('Name is required'); return; }
    setArtSaving(true);
    setArtError(null);
    try {
      if (editing === 'new') {
        const res = await fetch('/api/artifacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: project.id, ...artForm }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create');
        setArtifacts(prev => [...prev, data.artifact]);
      } else {
        const res = await fetch('/api/artifacts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: project.id, artifactId: editing.id, ...artForm }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update');
        setArtifacts(prev => prev.map(a => a.id === editing.id ? data.artifact : a));
      }
      onArtifactChange?.();
      setEditing(null);
    } catch (err) {
      setArtError(err.message);
    } finally {
      setArtSaving(false);
    }
  }

  async function confirmDelete(artifactId) {
    try {
      const res = await fetch(`/api/artifacts?projectId=${project.id}&artifactId=${artifactId}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setArtifacts(prev => prev.filter(a => a.id !== artifactId));
      onArtifactChange?.();
      setDeleteConfirm(null);
      if (editing && editing !== 'new' && editing.id === artifactId) setEditing(null);
    } catch (err) {
      setArtError(err.message);
    }
  }

  const contentPlaceholder =
    artForm.type === 'code'     ? '# paste or write your code here…' :
    artForm.type === 'json'     ? '{\n  \n}' :
    artForm.type === 'markdown' ? '## Title\n\n…' :
                                  'Write your notes, summary, or output here…';

  return (
    <div className={styles.backdrop} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.projectDot} style={{ background: project.color }} />
            <div>
              <div className={styles.title}>
                Workspace — {project.name}{bucketName ? <><span style={{ opacity: 0.4, margin: '0 5px' }}>›</span>{bucketName}</> : ''}
              </div>
              {projectDir && <div className={styles.dirPath}>{projectDir}</div>}
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'instructions' ? styles.tabActive : ''}`} onClick={() => setTab('instructions')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </svg>
            Instructions
          </button>
          <button className={`${styles.tab} ${tab === 'files' ? styles.tabActive : ''}`} onClick={() => setTab('files')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            Files
            {files.length > 0 && <span className={styles.fileBadge}>{files.length}</span>}
          </button>
          <button className={`${styles.tab} ${tab === 'artifacts' ? styles.tabActive : ''}`} onClick={() => setTab('artifacts')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            Artifacts
            {artifacts.length > 0 && <span className={styles.fileBadge}>{artifacts.length}</span>}
          </button>
        </div>

        {/* ── Instructions tab ── */}
        {tab === 'instructions' && (loading ? (
          <div className={styles.loadingState}>
            <svg className={styles.spinIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            Loading workspace…
          </div>
        ) : (
          <div className={styles.body}>
            <p className={styles.hint}>
              These instructions are injected into every AI task prompt for this project. Include tech stack, conventions, file structure, or anything the AI should know upfront.
            </p>
            <textarea
              className={styles.instructionsEditor}
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              placeholder={`# ${project.name} — AI Instructions\n\n## Tech stack\n...\n\n## Conventions\n...\n\n## Important files\n...`}
              spellCheck={false}
            />
            {wsError && <div className={styles.error}>{wsError}</div>}
            <div className={styles.footer}>
              <span className={styles.charCount}>{instructions.length} chars</span>
              <button className={styles.saveBtn} onClick={saveInstructions} disabled={saving}>
                {saved ? (
                  <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Saved</>
                ) : saving ? 'Saving…' : 'Save instructions'}
              </button>
            </div>
          </div>
        ))}

        {/* ── Files tab ── */}
        {tab === 'files' && (loading ? (
          <div className={styles.loadingState}>
            <svg className={styles.spinIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            Loading workspace…
          </div>
        ) : (
          <div className={styles.body}>
            <p className={styles.hint}>
              Files here are listed in the AI prompt so it can read them with its tools. Drop in code, docs, or any reference material.
            </p>
            {files.length === 0 ? (
              <div className={styles.emptyFiles}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.25 }}>
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                <span>No files yet. Upload files below or drop them into<br/><code>{projectDir}</code></span>
              </div>
            ) : (
              <div className={styles.fileList}>
                {files.map(f => (
                  <div key={f.name} className={styles.fileRow}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, flexShrink: 0 }}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <span className={styles.fileName}>{f.name}</span>
                    <span className={styles.fileSize}>{formatSize(f.size)}</span>
                    <button className={styles.deleteFileBtn} onClick={() => deleteFile(f.name)} title="Remove file">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            {wsError && <div className={styles.error}>{wsError}</div>}
            <div className={styles.footer}>
              <span className={styles.charCount}>Max 2 MB per file</span>
              <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileSelect} />
              <button className={styles.uploadBtn} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? (
                  <><svg className={styles.spinIcon} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Uploading…</>
                ) : (
                  <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Upload files</>
                )}
              </button>
            </div>
          </div>
        ))}

        {/* ── Artifacts tab ── */}
        {tab === 'artifacts' && (artLoading ? (
          <div className={styles.loadingState}>
            <svg className={styles.spinIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            Loading artifacts…
          </div>
        ) : editing ? (
          /* ── Editor pane ── */
          <div className={styles.body}>
            <div className={styles.artEditorHeader}>
              <button className={styles.artBackBtn} onClick={cancelEdit}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                Back
              </button>
              <span className={styles.artEditorTitle}>{editing === 'new' ? 'New artifact' : 'Edit artifact'}</span>
            </div>

            <div className={styles.artFormRow}>
              <div className={styles.artFormGroup} style={{ flex: 1 }}>
                <label className={styles.artLabel}>Name</label>
                <input
                  className={styles.artInput}
                  value={artForm.name}
                  onChange={e => setArtForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Architecture Plan"
                  autoFocus
                />
              </div>
              <div className={styles.artFormGroup}>
                <label className={styles.artLabel}>Type</label>
                <select
                  className={styles.artSelect}
                  value={artForm.type}
                  onChange={e => setArtForm(f => ({ ...f, type: e.target.value }))}
                >
                  <option value="text">Text</option>
                  <option value="markdown">Markdown</option>
                  <option value="code">Code</option>
                  <option value="json">JSON</option>
                </select>
              </div>
              {artForm.type === 'code' && (
                <div className={styles.artFormGroup}>
                  <label className={styles.artLabel}>Language</label>
                  <input
                    className={styles.artSelect}
                    value={artForm.lang}
                    onChange={e => setArtForm(f => ({ ...f, lang: e.target.value }))}
                    placeholder="python"
                    style={{ width: 90 }}
                  />
                </div>
              )}
            </div>

            <textarea
              className={styles.artEditor}
              value={artForm.content}
              onChange={e => setArtForm(f => ({ ...f, content: e.target.value }))}
              placeholder={contentPlaceholder}
              spellCheck={false}
            />

            {artError && <div className={styles.error}>{artError}</div>}

            <div className={styles.footer}>
              <span className={styles.charCount}>{artForm.content.length} chars</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={styles.artCancelBtn} onClick={cancelEdit}>Cancel</button>
                <button className={styles.saveBtn} onClick={saveArtifact} disabled={artSaving}>
                  {artSaving ? 'Saving…' : editing === 'new' ? 'Create artifact' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ── List pane ── */
          <div className={styles.body}>
            <div className={styles.artListHeader}>
              <span className={styles.hint} style={{ margin: 0 }}>
                Named outputs produced during project work — reports, plans, code, summaries.
              </span>
              <button className={styles.artNewBtn} onClick={openNew}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                New
              </button>
            </div>

            {artifacts.length === 0 ? (
              <div className={styles.emptyFiles}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.25 }}>
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                <span>No artifacts yet.<br/>Create one manually or ask the AI to save outputs here.</span>
              </div>
            ) : (
              <div className={styles.artList}>
                {artifacts.map(a => {
                  const tc = TYPE_COLORS[a.type] || TYPE_COLORS.text;
                  return (
                    <div key={a.id} className={styles.artCard} onClick={() => openEdit(a)}>
                      <div className={styles.artCardTop}>
                        <span className={styles.artCardName}>{a.name}</span>
                        <div className={styles.artCardActions} onClick={e => e.stopPropagation()}>
                          {deleteConfirm === a.id ? (
                            <>
                              <span className={styles.artDeleteMsg}>Delete?</span>
                              <button className={styles.artConfirmYes} onClick={() => confirmDelete(a.id)}>Yes</button>
                              <button className={styles.artConfirmNo} onClick={() => setDeleteConfirm(null)}>No</button>
                            </>
                          ) : (
                            <button className={styles.artDeleteBtn} onClick={() => setDeleteConfirm(a.id)} title="Delete">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className={styles.artCardMeta}>
                        <span className={styles.artTypeBadge} style={{ background: tc.bg, color: tc.color }}>
                          {TYPE_LABELS[a.type]}{a.lang ? ` · ${a.lang}` : ''}
                        </span>
                        <span className={styles.artCardDate}>{formatDate(a.updatedAt)}</span>
                      </div>
                      {a.content && (
                        <p className={styles.artCardPreview}>
                          {a.content.replace(/#{1,3} /g, '').replace(/\*\*/g, '').replace(/`/g, '').slice(0, 160)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {artError && <div className={styles.error}>{artError}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
