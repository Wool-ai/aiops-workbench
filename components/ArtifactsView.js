import { useState, useEffect, useCallback, useRef } from 'react';
import styles from '../styles/ArtifactsView.module.css';

// ── Inline parser ─────────────────────────────────────────────────────────────

function parseInline(text) {
  const tokens = [];
  let s = text;
  while (s.length > 0) {
    const img = s.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (img) { tokens.push({ type: 'image', alt: img[1], src: img[2] }); s = s.slice(img[0].length); continue; }
    const lnk = s.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (lnk) { tokens.push({ type: 'link', text: lnk[1], href: lnk[2] }); s = s.slice(lnk[0].length); continue; }
    const bold = s.match(/^\*\*([^*]+)\*\*/);
    if (bold) { tokens.push({ type: 'bold', text: bold[1] }); s = s.slice(bold[0].length); continue; }
    const ital = s.match(/^\*([^*]+)\*/);
    if (ital) { tokens.push({ type: 'italic', text: ital[1] }); s = s.slice(ital[0].length); continue; }
    const strk = s.match(/^~~([^~]+)~~/);
    if (strk) { tokens.push({ type: 'strike', text: strk[1] }); s = s.slice(strk[0].length); continue; }
    const code = s.match(/^`([^`]+)`/);
    if (code) { tokens.push({ type: 'code', text: code[1] }); s = s.slice(code[0].length); continue; }
    const next = s.search(/[!*`~[\]]/);
    if (next === -1) { tokens.push({ type: 'text', text: s }); s = ''; }
    else if (next === 0) { tokens.push({ type: 'text', text: s[0] }); s = s.slice(1); }
    else { tokens.push({ type: 'text', text: s.slice(0, next) }); s = s.slice(next); }
  }
  return tokens;
}

function renderInline(tokens, prefix = '') {
  return tokens.map((tok, i) => {
    const key = `${prefix}-${i}`;
    if (tok.type === 'image')  return <img key={key} src={tok.src} alt={tok.alt} className={styles.mdImg} />;
    if (tok.type === 'link')   return <a key={key} href={tok.href} target="_blank" rel="noopener noreferrer" className={styles.mdLink}>{tok.text}</a>;
    if (tok.type === 'bold')   return <strong key={key}>{tok.text}</strong>;
    if (tok.type === 'italic') return <em key={key}>{tok.text}</em>;
    if (tok.type === 'strike') return <del key={key} className={styles.mdStrike}>{tok.text}</del>;
    if (tok.type === 'code')   return <code key={key} className={styles.inlineCode}>{tok.text}</code>;
    return tok.text;
  });
}

function inline(text, prefix) {
  return renderInline(parseInline(text), prefix);
}

// ── Block renderer ────────────────────────────────────────────────────────────

function MarkdownRenderer({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();

    if (t.startsWith('```')) {
      const lang = t.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <div key={`cb${i}`} className={styles.mdCodeBlock}>
          {lang && <div className={styles.mdCodeLang}>{lang}</div>}
          <pre className={styles.mdCodePre}><code>{codeLines.join('\n')}</code></pre>
        </div>
      );
      i++; continue;
    }

    if (t.startsWith('### ')) { elements.push(<h3 key={i} className={styles.mdH3}>{inline(t.slice(4), `h3${i}`)}</h3>); i++; continue; }
    if (t.startsWith('## '))  { elements.push(<h2 key={i} className={styles.mdH2}>{inline(t.slice(3), `h2${i}`)}</h2>); i++; continue; }
    if (t.startsWith('# '))   { elements.push(<h1 key={i} className={styles.mdH1}>{inline(t.slice(2), `h1${i}`)}</h1>); i++; continue; }

    if (t.startsWith('> ')) {
      const lines2 = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        lines2.push(lines[i].trim().slice(2));
        i++;
      }
      elements.push(<blockquote key={`bq${i}`} className={styles.mdBlockquote}>{lines2.map((l, j) => <div key={j}>{inline(l, `bq${i}-${j}`)}</div>)}</blockquote>);
      continue;
    }

    if (t.startsWith('- ') || t.startsWith('* ')) {
      const items = [];
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
        const raw = lines[i].trim().slice(2);
        const taskUnchecked = raw.startsWith('[ ] ');
        const taskChecked   = raw.startsWith('[x] ') || raw.startsWith('[X] ');
        if (taskUnchecked || taskChecked) {
          items.push(
            <li key={i} className={styles.mdTaskItem}>
              <span className={`${styles.mdCheckbox} ${taskChecked ? styles.mdCheckboxChecked : ''}`}>
                {taskChecked && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </span>
              <span>{inline(raw.slice(4), `task${i}`)}</span>
            </li>
          );
        } else {
          items.push(<li key={i} className={styles.mdLi}><span className={styles.mdBullet}>•</span><span>{inline(raw, `li${i}`)}</span></li>);
        }
        i++;
      }
      elements.push(<ul key={`ul${i}`} className={styles.mdUl}>{items}</ul>);
      continue;
    }

    if (/^\d+\. /.test(t)) {
      const items = [];
      let n = 1;
      while (i < lines.length && /^\d+\. /.test(lines[i].trim())) {
        const raw = lines[i].trim().replace(/^\d+\. /, '');
        items.push(<li key={i} className={styles.mdLi}><span className={styles.mdOlNum}>{n++}.</span><span>{inline(raw, `ol${i}`)}</span></li>);
        i++;
      }
      elements.push(<ol key={`ol${i}`} className={styles.mdOl}>{items}</ol>);
      continue;
    }

    if (t === '---' || t === '***' || t === '___') { elements.push(<hr key={i} className={styles.mdHr} />); i++; continue; }
    if (t === '') { elements.push(<div key={i} className={styles.mdSpacer} />); i++; continue; }

    // GFM table: pipe-delimited rows where the second row is all dashes/colons
    if (t.includes('|') && i + 1 < lines.length && /^\s*\|?[\s\-:|]+\|/.test(lines[i + 1])) {
      const parseRow = row => row.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const sepRow = lines[i + 1].trim();
      // Derive alignment from separator cells
      const aligns = parseRow(sepRow).map(c => {
        if (c.startsWith(':') && c.endsWith(':')) return 'center';
        if (c.endsWith(':')) return 'right';
        return 'left';
      });
      const headers = parseRow(t);
      const bodyRows = [];
      i += 2; // skip header + separator
      while (i < lines.length && lines[i].trim().includes('|')) {
        bodyRows.push(parseRow(lines[i].trim()));
        i++;
      }
      elements.push(
        <div key={`tbl${i}`} className={styles.mdTableWrap}>
          <table className={styles.mdTable}>
            <thead>
              <tr>
                {headers.map((h, ci) => (
                  <th key={ci} className={styles.mdTh} style={{ textAlign: aligns[ci] || 'left' }}>
                    {inline(h, `th${i}-${ci}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 1 ? styles.mdTrAlt : ''}>
                  {row.map((cell, ci) => (
                    <td key={ci} className={styles.mdTd} style={{ textAlign: aligns[ci] || 'left' }}>
                      {inline(cell, `td${i}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (/^!\[[^\]]*\]\([^)]+\)$/.test(t)) {
      const m = t.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      elements.push(<img key={i} src={m[2]} alt={m[1]} className={`${styles.mdImg} ${styles.mdImgBlock}`} />);
      i++; continue;
    }

    elements.push(<p key={i} className={styles.mdP}>{inline(t, `p${i}`)}</p>);
    i++;
  }
  return <div className={styles.mdBody}>{elements}</div>;
}

// ── Content renderers ─────────────────────────────────────────────────────────

function CodeRenderer({ content, lang }) {
  return (
    <div className={styles.codeWrap}>
      {lang && <div className={styles.codeLang}>{lang}</div>}
      <pre className={styles.codePre}><code>{content}</code></pre>
    </div>
  );
}

function JsonRenderer({ content }) {
  let formatted = content;
  try { formatted = JSON.stringify(JSON.parse(content), null, 2); } catch {}
  return (
    <div className={styles.codeWrap}>
      <div className={styles.codeLang}>json</div>
      <pre className={styles.codePre}><code>{formatted}</code></pre>
    </div>
  );
}

function ArtifactContent({ artifact }) {
  if (!artifact?.content) return <div className={styles.emptyContent}>No content</div>;
  if (artifact.type === 'markdown') return <MarkdownRenderer text={artifact.content} />;
  if (artifact.type === 'code')     return <CodeRenderer content={artifact.content} lang={artifact.lang} />;
  if (artifact.type === 'json')     return <JsonRenderer content={artifact.content} />;
  return <pre className={styles.textPre}>{artifact.content}</pre>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_META = {
  text:     { label: 'Text',     color: 'var(--artifact-text-c)', bg: 'var(--artifact-text-bg)' },
  markdown: { label: 'MD',       color: 'var(--artifact-markdown-c)', bg: 'var(--artifact-markdown-bg)'  },
  code:     { label: 'Code',     color: 'var(--artifact-code-c)', bg: 'var(--artifact-code-bg)'  },
  json:     { label: 'JSON',     color: 'var(--artifact-json-c)', bg: 'var(--artifact-json-bg)'  },
};

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)  return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function contentPreview(content) {
  if (!content) return '';
  return content
    .replace(/#{1,6} /g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .replace(/~~|__/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/^\s*[-*>]\s+/gm, '')
    .replace(/\n+/g, ' ')
    .trim()
    .slice(0, 90);
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

const CopyIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

// ── Main component ────────────────────────────────────────────────────────────

export default function ArtifactsView({ projects, initialProjectId }) {
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId || null);
  const [artifacts, setArtifacts]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [selected, setSelected]     = useState(null);
  const [search, setSearch]         = useState('');
  const [copying, setCopying]       = useState(false);
  const [showRaw, setShowRaw]       = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // artifact id
  const confirmTimerRef = useRef(null);

  useEffect(() => { setShowRaw(false); }, [selected]);

  // Clear confirm-delete state on selection change
  useEffect(() => {
    setConfirmDelete(null);
    clearTimeout(confirmTimerRef.current);
  }, [selected]);

  // When parent navigates to a specific project, honour it
  useEffect(() => {
    if (initialProjectId) setSelectedProjectId(initialProjectId);
  }, [initialProjectId]);

  // Auto-select first project with artifacts if nothing is selected
  useEffect(() => {
    if (selectedProjectId || !projects.length) return;
    const withArtifacts = projects.find(p => (p.artifacts?.length ?? 0) > 0);
    setSelectedProjectId((withArtifacts || projects[0]).id);
  }, [projects, selectedProjectId]);

  const loadArtifacts = useCallback(async (projectId) => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    setSelected(null);
    try {
      const res = await fetch(`/api/artifacts?projectId=${projectId}`);
      const data = await res.json();
      const list = data.artifacts || [];
      setArtifacts(list);
      if (list.length > 0) setSelected(list[0]);
    } catch {
      setError('Failed to load artifacts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProjectId) loadArtifacts(selectedProjectId);
  }, [selectedProjectId, loadArtifacts]);

  async function execDelete(artifact) {
    const params = new URLSearchParams({ projectId: selectedProjectId });
    if (artifact.id)       params.set('artifactId', artifact.id);
    if (artifact.filePath) params.set('filePath', artifact.filePath);
    const res = await fetch(`/api/artifacts?${params}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
    const next = artifacts.filter(a => a.id !== artifact.id);
    setArtifacts(next);
    if (selected?.id === artifact.id) {
      setSelected(next.length > 0 ? next[0] : null);
    }
  }

  // Two-step confirm for the main viewer delete button
  async function handleViewerDelete(artifact) {
    if (confirmDelete !== artifact.id) {
      setConfirmDelete(artifact.id);
      clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => setConfirmDelete(null), 3000);
      return;
    }
    clearTimeout(confirmTimerRef.current);
    setConfirmDelete(null);
    try { await execDelete(artifact); } catch {}
  }

  // Immediate delete from list item (secondary action, no confirm needed)
  async function handleListDelete(e, artifact) {
    e.stopPropagation();
    try { await execDelete(artifact); } catch {}
  }

  async function copyContent() {
    if (!selected?.content) return;
    try {
      await navigator.clipboard.writeText(selected.content);
      setCopying(true);
      setTimeout(() => setCopying(false), 1500);
    } catch {}
  }

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const filtered = artifacts.filter(a => {
    if (!search) return true;
    const q = search.toLowerCase();
    return a.name.toLowerCase().includes(q) || (a.content || '').toLowerCase().includes(q);
  });

  // Group by bucket
  const grouped = [];
  const seen = new Set();
  for (const a of filtered) {
    const bucket = a.bucket || '';
    if (!seen.has(bucket)) { seen.add(bucket); grouped.push({ bucket, items: [] }); }
    grouped.find(g => g.bucket === bucket).items.push(a);
  }

  const isConfirmingDelete = confirmDelete === selected?.id;

  return (
    <div className={styles.root}>
      {/* ── Left panel ── */}
      <div className={styles.left}>

        {/* Project switcher */}
        <div className={styles.projectList}>
          <div className={styles.projectListLabel}>Projects</div>
          {projects.map(p => {
            const count = p.artifacts?.length ?? 0;
            return (
              <button
                key={p.id}
                className={`${styles.projBtn} ${selectedProjectId === p.id ? styles.projBtnActive : ''}`}
                onClick={() => { setSelectedProjectId(p.id); setSearch(''); }}
              >
                <span className={styles.projDot} style={{ background: p.color }} />
                <span className={styles.projName}>{p.name}</span>
                {count > 0 && <span className={styles.projCount}>{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Artifact list */}
        <div className={styles.listSection}>
          {selectedProject && (
            <div className={styles.listHeader}>
              <input
                className={styles.search}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={`Search ${artifacts.length} artifact${artifacts.length !== 1 ? 's' : ''}…`}
              />
            </div>
          )}

          {loading && (
            <div className={styles.loadingState}>
              <svg className={styles.spin} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Loading…
            </div>
          )}

          {!loading && error && <div className={styles.errorState}>{error}</div>}

          {!loading && !error && filtered.length === 0 && (
            <div className={styles.emptyState}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.2 }}>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <span>{search ? 'No matches' : 'No artifacts yet'}</span>
            </div>
          )}

          <div className={styles.artifactList}>
            {grouped.map(({ bucket, items }) => (
              <div key={bucket || '__uncategorized'}>
                {(grouped.length > 1 || bucket) && (
                  <div className={styles.bucketLabel}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    {bucket || 'Uncategorized'}
                  </div>
                )}
                {items.map(a => {
                  const tm = TYPE_META[a.type] || TYPE_META.text;
                  const isActive = selected?.id === a.id;
                  const preview = contentPreview(a.content);
                  return (
                    <button
                      key={a.id}
                      className={`${styles.artItem} ${isActive ? styles.artItemActive : ''}`}
                      onClick={() => setSelected(a)}
                    >
                      <div className={styles.artItemTop}>
                        <span className={styles.artItemName}>{a.name}</span>
                        <span
                          className={styles.artItemDelete}
                          role="button"
                          title="Delete artifact"
                          onClick={e => handleListDelete(e, a)}
                        >
                          <TrashIcon />
                        </span>
                      </div>
                      <div className={styles.artItemBottom}>
                        <span className={styles.artTypeBadge} style={{ background: tm.bg, color: tm.color }}>
                          {tm.label}{a.lang ? ` · ${a.lang}` : ''}
                        </span>
                        <span className={styles.artDate}>{formatDate(a.updatedAt)}</span>
                      </div>
                      {preview && <span className={styles.artPreview}>{preview}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: viewer ── */}
      <div className={styles.viewer}>
        {selected ? (
          <>
            <div className={styles.viewerHeader}>
              {/* Meta row */}
              <div className={styles.viewerMetaRow}>
                {(() => {
                  const tm = TYPE_META[selected.type] || TYPE_META.text;
                  return (
                    <span className={styles.viewerTypeBadge} style={{ background: tm.bg, color: tm.color }}>
                      {tm.label}{selected.lang ? ` · ${selected.lang}` : ''}
                    </span>
                  );
                })()}
                {selected.bucket && (
                  <span className={styles.viewerBucket}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    {selected.bucket}
                  </span>
                )}
                <span className={styles.viewerDate}>{formatDate(selected.updatedAt)}</span>
                <span className={styles.charCount}>{(selected.content || '').length.toLocaleString()} chars</span>
              </div>

              {/* Title + actions row */}
              <div className={styles.viewerTitleRow}>
                <h2 className={styles.viewerTitle}>{selected.name}</h2>
                <div className={styles.viewerActions}>
                  <div className={styles.rawToggle}>
                    <button
                      className={`${styles.rawBtn} ${!showRaw ? styles.rawBtnActive : ''}`}
                      onClick={() => setShowRaw(false)}
                    >Rendered</button>
                    <button
                      className={`${styles.rawBtn} ${showRaw ? styles.rawBtnActive : ''}`}
                      onClick={() => setShowRaw(true)}
                    >Raw</button>
                  </div>

                  <button className={styles.actionBtn} onClick={copyContent}>
                    {copying ? <CheckIcon /> : <CopyIcon />}
                    {copying ? 'Copied' : 'Copy'}
                  </button>

                  <button
                    className={`${styles.actionBtn} ${isConfirmingDelete ? styles.actionBtnDanger : ''}`}
                    onClick={() => handleViewerDelete(selected)}
                    title={isConfirmingDelete ? 'Click again to confirm deletion' : 'Delete artifact'}
                  >
                    <TrashIcon />
                    {isConfirmingDelete ? 'Confirm?' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.viewerBody}>
              {showRaw
                ? <pre className={styles.rawPre}>{selected.content}</pre>
                : <ArtifactContent artifact={selected} />
              }
            </div>
          </>
        ) : (
          <div className={styles.noSelection}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.1 }}>
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            {artifacts.length === 0 && !loading ? (
              <>
                <span>No artifacts yet</span>
                <span className={styles.noSelectionSub}>Run an AI task and ask it to save its output as an artifact.</span>
              </>
            ) : (
              <span>Select an artifact</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
