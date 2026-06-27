import { useState, useEffect, useRef } from 'react';
import styles from '../styles/WorkspaceModal.module.css';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function WorkspaceModal({ project, bucketName, onClose }) {
  const [tab, setTab] = useState('instructions');
  const [instructions, setInstructions] = useState('');
  const [files, setFiles] = useState([]);
  const [projectDir, setProjectDir] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    load();
  }, [project.id, bucketName]);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ projectId: project.id });
      if (bucketName) params.set('bucketName', bucketName);
      const res = await fetch(`/api/workspace?${params}`);
      const data = await res.json();
      setInstructions(data.instructions || '');
      setFiles(data.files || []);
      setProjectDir(data.projectDir || '');
    } catch {
      setError('Failed to load workspace');
    } finally {
      setLoading(false);
    }
  }

  async function saveInstructions() {
    setSaving(true);
    setError(null);
    try {
      await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, bucketName, instructions }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Failed to save instructions');
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
      setError('Failed to delete file');
    }
  }

  async function handleFileSelect(e) {
    const selected = Array.from(e.target.files);
    if (!selected.length) return;
    setUploading(true);
    setError(null);
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
          setError(d.error || 'Upload failed');
          continue;
        }
        const data = await res.json();
        setFiles(prev => {
          const without = prev.filter(f => f.name !== data.filename);
          return [...without, { name: data.filename, size: data.size, mtime: Date.now() }];
        });
      } catch {
        setError(`Failed to upload ${file.name}`);
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

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
        </div>

        {loading ? (
          <div className={styles.loadingState}>
            <svg className={styles.spinIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            Loading workspace…
          </div>
        ) : tab === 'instructions' ? (
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
            {error && <div className={styles.error}>{error}</div>}
            <div className={styles.footer}>
              <span className={styles.charCount}>{instructions.length} chars</span>
              <button className={styles.saveBtn} onClick={saveInstructions} disabled={saving}>
                {saved ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Saved
                  </>
                ) : saving ? 'Saving…' : 'Save instructions'}
              </button>
            </div>
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
            {error && <div className={styles.error}>{error}</div>}
            <div className={styles.footer}>
              <span className={styles.charCount}>Max 2 MB per file</span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
              <button className={styles.uploadBtn} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? (
                  <>
                    <svg className={styles.spinIcon} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    Uploading…
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Upload files
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
