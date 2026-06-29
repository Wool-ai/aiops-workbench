import { useState, useEffect, useRef, useCallback } from 'react';
import styles from '../styles/MCPView.module.css';

// ── Public server registry ────────────────────────────────────────────────────

const REGISTRY = [
  {
    category: 'Files & Code',
    servers: [
      {
        id: 'filesystem',
        name: 'Filesystem',
        description: 'Read/write local files and directories. Requires specifying allowed paths.',
        author: 'Anthropic',
        type: 'stdio',
        config: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allow'] },
        configNote: 'Replace /path/to/allow with the directory you want to expose.',
        docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
        tags: ['files', 'local'],
      },
      {
        id: 'git',
        name: 'Git',
        description: 'Read git repositories — commits, diffs, branches, file history.',
        author: 'Anthropic',
        type: 'stdio',
        config: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-git', '--repository', '/path/to/repo'] },
        configNote: 'Replace /path/to/repo with the path to your git repository.',
        docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/git',
        tags: ['git', 'code'],
      },
      {
        id: 'github',
        name: 'GitHub',
        description: 'Manage repos, issues, PRs, files, and search code on GitHub.',
        author: 'Anthropic',
        type: 'stdio',
        config: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'], env: { GITHUB_PERSONAL_ACCESS_TOKEN: '' } },
        configNote: 'Set GITHUB_PERSONAL_ACCESS_TOKEN to your GitHub PAT.',
        docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/github',
        tags: ['github', 'code', 'issues'],
      },
      {
        id: 'gitlab',
        name: 'GitLab',
        description: 'Interact with GitLab repositories, issues, and merge requests.',
        author: 'Anthropic',
        type: 'stdio',
        config: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-gitlab'], env: { GITLAB_PERSONAL_ACCESS_TOKEN: '', GITLAB_API_URL: 'https://gitlab.com/api/v4' } },
        configNote: 'Set GITLAB_PERSONAL_ACCESS_TOKEN and optionally GITLAB_API_URL for self-hosted.',
        docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/gitlab',
        tags: ['gitlab', 'code'],
      },
    ],
  },
  {
    category: 'Databases',
    servers: [
      {
        id: 'sqlite',
        name: 'SQLite',
        description: 'Query and inspect SQLite databases with business intelligence tools.',
        author: 'Anthropic',
        type: 'stdio',
        config: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-sqlite', '--db-path', '/path/to/db.sqlite'] },
        configNote: 'Replace /path/to/db.sqlite with your database file path.',
        docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite',
        tags: ['database', 'sql'],
      },
      {
        id: 'postgres',
        name: 'PostgreSQL',
        description: 'Read-only access to PostgreSQL databases for schema inspection and queries.',
        author: 'Anthropic',
        type: 'stdio',
        config: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://localhost/mydb'] },
        configNote: 'Replace the connection string with your PostgreSQL URL.',
        docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/postgres',
        tags: ['database', 'sql'],
      },
    ],
  },
  {
    category: 'Search & Web',
    servers: [
      {
        id: 'brave-search',
        name: 'Brave Search',
        description: 'Web and local search via the Brave Search API.',
        author: 'Anthropic',
        type: 'stdio',
        config: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-brave-search'], env: { BRAVE_API_KEY: '' } },
        configNote: 'Set BRAVE_API_KEY from the Brave Search API dashboard.',
        docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search',
        tags: ['search', 'web'],
      },
      {
        id: 'fetch',
        name: 'Fetch',
        description: 'Fetch web pages and convert them to Markdown for AI consumption.',
        author: 'Anthropic',
        type: 'stdio',
        config: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-fetch'] },
        docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/fetch',
        tags: ['web', 'fetch'],
      },
      {
        id: 'puppeteer',
        name: 'Puppeteer',
        description: 'Browser automation — navigate pages, click, fill forms, take screenshots.',
        author: 'Anthropic',
        type: 'stdio',
        config: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-puppeteer'] },
        docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer',
        tags: ['browser', 'automation'],
      },
    ],
  },
  {
    category: 'Productivity',
    servers: [
      {
        id: 'slack',
        name: 'Slack',
        description: 'Read channels, post messages, and search Slack workspaces.',
        author: 'Anthropic',
        type: 'stdio',
        config: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-slack'], env: { SLACK_BOT_TOKEN: '', SLACK_TEAM_ID: '' } },
        configNote: 'Set SLACK_BOT_TOKEN (xoxb-...) and SLACK_TEAM_ID from your Slack app settings.',
        docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/slack',
        tags: ['slack', 'messaging'],
      },
      {
        id: 'google-maps',
        name: 'Google Maps',
        description: 'Geocoding, directions, place search, and distance calculations.',
        author: 'Anthropic',
        type: 'stdio',
        config: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-google-maps'], env: { GOOGLE_MAPS_API_KEY: '' } },
        configNote: 'Set GOOGLE_MAPS_API_KEY from the Google Cloud Console.',
        docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/google-maps',
        tags: ['maps', 'location'],
      },
      {
        id: 'linear',
        name: 'Linear',
        description: 'Manage Linear issues, projects, and cycles via the API.',
        author: 'Community',
        type: 'stdio',
        config: { command: 'npx', args: ['-y', 'linear-mcp-server'], env: { LINEAR_API_KEY: '' } },
        configNote: 'Set LINEAR_API_KEY from Linear Settings → API.',
        docs: 'https://github.com/jerhadf/linear-mcp-server',
        tags: ['project-management', 'issues'],
      },
      {
        id: 'notion',
        name: 'Notion',
        description: 'Query and update Notion pages, databases, and blocks.',
        author: 'Community',
        type: 'stdio',
        config: { command: 'npx', args: ['-y', '@notionhq/notion-mcp-server'], env: { OPENAPI_MCP_HEADERS: '{"Authorization":"Bearer ntn_...","Notion-Version":"2022-06-28"}' } },
        configNote: 'Replace ntn_... with your Notion integration token.',
        docs: 'https://github.com/makenotion/notion-mcp-server',
        tags: ['notion', 'docs'],
      },
    ],
  },
  {
    category: 'AI & Memory',
    servers: [
      {
        id: 'memory',
        name: 'Memory',
        description: 'Persistent key-value memory store so AI can remember facts across sessions.',
        author: 'Anthropic',
        type: 'stdio',
        config: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'] },
        docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/memory',
        tags: ['memory', 'persistence'],
      },
      {
        id: 'sequential-thinking',
        name: 'Sequential Thinking',
        description: 'Structured step-by-step reasoning for complex multi-step problems.',
        author: 'Anthropic',
        type: 'stdio',
        config: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-sequential-thinking'] },
        docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking',
        tags: ['reasoning', 'thinking'],
      },
    ],
  },
];

const ALL_TAGS = [...new Set(REGISTRY.flatMap(c => c.servers.flatMap(s => s.tags)))].sort();

// ── Helpers ───────────────────────────────────────────────────────────────────

function ServerTypeBadge({ type }) {
  return (
    <span className={type === 'sse' ? styles.badgeSSE : styles.badgeStdio}>
      {type === 'sse' ? 'SSE' : 'stdio'}
    </span>
  );
}

// ── Add / Edit form ───────────────────────────────────────────────────────────

const EMPTY_CUSTOM = {
  key: '',
  type: 'stdio',
  command: '',
  args: '',
  url: '',
  envPairs: [{ k: '', v: '' }],
};

function ServerForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(() => {
    if (!initial) return EMPTY_CUSTOM;
    const cfg = initial.config;
    const envPairs = Object.entries(cfg.env || {}).map(([k, v]) => ({ k, v }));
    return {
      key: initial.key,
      type: cfg.type === 'sse' ? 'sse' : 'stdio',
      command: cfg.command || '',
      args: (cfg.args || []).join(' '),
      url: cfg.url || '',
      envPairs: envPairs.length ? envPairs : [{ k: '', v: '' }],
    };
  });

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function setEnv(i, field, val) {
    setForm(f => {
      const pairs = [...f.envPairs];
      pairs[i] = { ...pairs[i], [field]: val };
      return { ...f, envPairs: pairs };
    });
  }
  function addEnvRow() { setForm(f => ({ ...f, envPairs: [...f.envPairs, { k: '', v: '' }] })); }
  function removeEnvRow(i) {
    setForm(f => ({ ...f, envPairs: f.envPairs.filter((_, idx) => idx !== i) }));
  }

  function submit(e) {
    e.preventDefault();
    if (!form.key.trim()) return;
    const env = Object.fromEntries(form.envPairs.filter(p => p.k.trim()).map(p => [p.k.trim(), p.v]));
    let cfg;
    if (form.type === 'sse') {
      cfg = { type: 'sse', url: form.url.trim() };
    } else {
      const args = form.args.trim() ? form.args.trim().split(/\s+/) : [];
      cfg = { command: form.command.trim(), args };
    }
    if (Object.keys(env).length) cfg.env = env;
    onSave({ key: form.key.trim(), config: cfg });
  }

  return (
    <form className={styles.serverForm} onSubmit={submit}>
      <div className={styles.formField}>
        <label className={styles.formLabel}>Server name (key)</label>
        <input
          className={styles.formInput}
          value={form.key}
          onChange={e => set('key', e.target.value)}
          placeholder="e.g. github"
          required
          disabled={!!initial}
        />
      </div>

      <div className={styles.formField}>
        <label className={styles.formLabel}>Type</label>
        <div className={styles.typeToggle}>
          {['stdio', 'sse'].map(t => (
            <button
              key={t}
              type="button"
              className={`${styles.typeBtn} ${form.type === t ? styles.typeBtnOn : ''}`}
              onClick={() => set('type', t)}
            >{t.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {form.type === 'stdio' ? (
        <>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Command</label>
            <input className={styles.formInput} value={form.command} onChange={e => set('command', e.target.value)} placeholder="npx" required />
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Arguments</label>
            <input className={styles.formInput} value={form.args} onChange={e => set('args', e.target.value)} placeholder="-y @modelcontextprotocol/server-github" />
            <span className={styles.formHint}>Space-separated. Will be split into an array.</span>
          </div>
        </>
      ) : (
        <div className={styles.formField}>
          <label className={styles.formLabel}>Server URL</label>
          <input className={styles.formInput} value={form.url} onChange={e => set('url', e.target.value)} placeholder="https://mcp.example.com/sse" required />
        </div>
      )}

      <div className={styles.formField}>
        <label className={styles.formLabel}>Environment variables</label>
        <div className={styles.envRows}>
          {form.envPairs.map((pair, i) => (
            <div key={i} className={styles.envRow}>
              <input className={styles.envKey} value={pair.k} onChange={e => setEnv(i, 'k', e.target.value)} placeholder="KEY" />
              <input className={styles.envVal} value={pair.v} onChange={e => setEnv(i, 'v', e.target.value)} placeholder="value" />
              {form.envPairs.length > 1 && (
                <button type="button" className={styles.envRemove} onClick={() => removeEnvRow(i)}>×</button>
              )}
            </div>
          ))}
          <button type="button" className={styles.envAdd} onClick={addEnvRow}>+ Add variable</button>
        </div>
      </div>

      <div className={styles.formActions}>
        <button type="submit" className={styles.saveBtn}>{initial ? 'Save changes' : 'Add server'}</button>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

// ── Configured servers tab ────────────────────────────────────────────────────

function ConfiguredTab({ servers, onEdit, onRemove, onAddCustom }) {
  if (Object.keys(servers).length === 0) {
    return (
      <div className={styles.empty}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.25 }}>
          <circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M17.66 6.34l1.42-1.42"/>
        </svg>
        <span>No MCP servers configured yet</span>
        <button className={styles.emptyBtn} onClick={onAddCustom}>Add your first server</button>
      </div>
    );
  }

  return (
    <div className={styles.configuredList}>
      {Object.entries(servers).map(([key, cfg]) => {
        const isSSE = cfg.type === 'sse';
        const envKeys = Object.keys(cfg.env || {});
        return (
          <div key={key} className={styles.configuredCard}>
            <div className={styles.configuredTop}>
              <div className={styles.configuredName}>
                <ServerTypeBadge type={isSSE ? 'sse' : 'stdio'} />
                <span>{key}</span>
              </div>
              <div className={styles.configuredActions}>
                <button className={styles.editBtn} onClick={() => onEdit(key, cfg)} title="Edit">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Edit
                </button>
                <button className={styles.removeBtn} onClick={() => onRemove(key)} title="Remove">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                  Remove
                </button>
              </div>
            </div>
            <div className={styles.configuredMeta}>
              {isSSE ? (
                <code className={styles.configPre}>{cfg.url}</code>
              ) : (
                <code className={styles.configPre}>{[cfg.command, ...(cfg.args || [])].join(' ')}</code>
              )}
            </div>
            {envKeys.length > 0 && (
              <div className={styles.envChips}>
                {envKeys.map(k => (
                  <span key={k} className={`${styles.envChip} ${cfg.env[k] ? '' : styles.envChipMissing}`} title={cfg.env[k] ? 'Set' : 'Not set'}>
                    {k}
                    {!cfg.env[k] && <span className={styles.envChipWarn}>!</span>}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Smithery live search ──────────────────────────────────────────────────────

function SmitheryResults({ configured, onAdd }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null); // null = not searched yet
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [adding, setAdding] = useState(null); // qualifiedName being fetched

  const debounceRef = useRef(null);

  const search = useCallback((q, pg = 1) => {
    setLoading(true);
    setError('');
    fetch(`/api/mcp-registry?q=${encodeURIComponent(q)}&page=${pg}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setResults([]); return; }
        setResults(d.servers || []);
        setTotalPages(d.pagination?.totalPages || 1);
        setPage(pg);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function handleInput(e) {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults(null); return; }
    debounceRef.current = setTimeout(() => search(q, 1), 420);
  }

  async function handleAdd(server) {
    setAdding(server.qualifiedName);
    try {
      const r = await fetch(`/api/mcp-registry?detail=${encodeURIComponent(server.qualifiedName)}`);
      const detail = await r.json();
      const conn = (detail.connections || [])[0];
      let prefillConfig;
      if (conn?.type === 'http' && conn.deploymentUrl) {
        prefillConfig = { type: 'sse', url: conn.deploymentUrl };
      } else if (conn?.type === 'stdio') {
        prefillConfig = { command: conn.command || '', args: conn.args || [] };
      } else if (server.remote && detail.deploymentUrl) {
        prefillConfig = { type: 'sse', url: detail.deploymentUrl };
      } else {
        prefillConfig = { command: '', args: [] };
      }
      // Extract required env vars from configSchema if present
      const schemaProps = conn?.configSchema?.properties || {};
      if (Object.keys(schemaProps).length > 0) {
        prefillConfig.env = Object.fromEntries(Object.keys(schemaProps).map(k => [k, '']));
      }
      onAdd({
        id: server.qualifiedName,
        name: server.displayName,
        type: prefillConfig.type === 'sse' ? 'sse' : 'stdio',
        config: prefillConfig,
        docs: `https://smithery.ai/servers/${server.qualifiedName}`,
      });
    } catch {
      // Fallback: open form with minimal prefill
      onAdd({
        id: server.qualifiedName,
        name: server.displayName,
        type: server.remote ? 'sse' : 'stdio',
        config: server.remote ? { type: 'sse', url: '' } : { command: '', args: [] },
        docs: `https://smithery.ai/servers/${server.qualifiedName}`,
      });
    } finally {
      setAdding(null);
    }
  }

  return (
    <div className={styles.smitherySection}>
      <div className={styles.smitheryHeader}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          className={styles.smitheryInput}
          value={query}
          onChange={handleInput}
          placeholder="Search Smithery registry (1000+ servers)…"
        />
        {loading && <span className={styles.smitherySpin} />}
        {query && !loading && <button className={styles.discoverClear} onClick={() => { setQuery(''); setResults(null); }}>×</button>}
      </div>

      {error && <div className={styles.smitheryError}>{error}</div>}

      {results === null && !loading && (
        <div className={styles.smitheryHint}>
          Type to search the live Smithery registry — remote and stdio MCP servers indexed from the community.
        </div>
      )}

      {results !== null && results.length === 0 && !loading && (
        <div className={styles.noResults}>No servers found for "{query}"</div>
      )}

      {results && results.length > 0 && (
        <>
          <div className={styles.smitheryResults}>
            {results.map(s => {
              const key = s.qualifiedName;
              const isInstalled = !!configured[key];
              const isAdding = adding === key;
              return (
                <div key={key} className={`${styles.smitheryCard} ${isInstalled ? styles.registryCardInstalled : ''}`}>
                  <div className={styles.smitheryCardLeft}>
                    <div className={styles.smitheryCardName}>
                      <ServerTypeBadge type={s.remote ? 'sse' : 'stdio'} />
                      <span className={styles.registryName}>{s.displayName}</span>
                      {s.verified && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" title="Verified">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </div>
                    <p className={styles.smitheryCardDesc}>{s.description}</p>
                    <span className={styles.smitheryUses}>{s.useCount?.toLocaleString()} uses</span>
                  </div>
                  <div className={styles.registryBtns}>
                    {isInstalled ? (
                      <span className={styles.installedBadge}>Configured</span>
                    ) : (
                      <button
                        className={styles.addBtn}
                        onClick={() => handleAdd(s)}
                        disabled={isAdding}
                      >{isAdding ? '…' : 'Add'}</button>
                    )}
                    <a
                      className={styles.smitheryDocs}
                      href={s.homepage || `https://smithery.ai/servers/${key}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Docs"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className={styles.smitheryPager}>
              <button
                className={styles.pagerBtn}
                disabled={page <= 1}
                onClick={() => search(query, page - 1)}
              >← Prev</button>
              <span className={styles.pagerInfo}>Page {page} / {totalPages}</span>
              <button
                className={styles.pagerBtn}
                disabled={page >= totalPages}
                onClick={() => search(query, page + 1)}
              >Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Discover tab ──────────────────────────────────────────────────────────────

function DiscoverTab({ configured, onAdd }) {
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [expanded, setExpanded] = useState(null);

  const q = search.toLowerCase();
  const filtered = REGISTRY.map(cat => ({
    ...cat,
    servers: cat.servers.filter(s => {
      const matchTag = !activeTag || s.tags.includes(activeTag);
      const matchQ = !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.tags.some(t => t.includes(q));
      return matchTag && matchQ;
    }),
  })).filter(cat => cat.servers.length > 0);

  return (
    <div className={styles.discoverPane}>
      {/* Live Smithery search at top */}
      <SmitheryResults configured={configured} onAdd={onAdd} />

      <div className={styles.curatedDivider}>
        <span className={styles.curatedLabel}>Curated picks</span>
      </div>

      <div className={styles.discoverSearch}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className={styles.discoverInput}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter curated list…"
        />
        {search && <button className={styles.discoverClear} onClick={() => setSearch('')}>×</button>}
      </div>

      <div className={styles.tagRow}>
        <button
          className={`${styles.tagBtn} ${!activeTag ? styles.tagBtnOn : ''}`}
          onClick={() => setActiveTag('')}
        >All</button>
        {ALL_TAGS.map(t => (
          <button
            key={t}
            className={`${styles.tagBtn} ${activeTag === t ? styles.tagBtnOn : ''}`}
            onClick={() => setActiveTag(a => a === t ? '' : t)}
          >{t}</button>
        ))}
      </div>

      <div className={styles.registryList}>
        {filtered.length === 0 && (
          <div className={styles.noResults}>No servers match your search.</div>
        )}
        {filtered.map(cat => (
          <div key={cat.category} className={styles.registryCategory}>
            <div className={styles.categoryLabel}>{cat.category}</div>
            {cat.servers.map(server => {
              const isInstalled = !!configured[server.id];
              const isOpen = expanded === server.id;
              return (
                <div key={server.id} className={`${styles.registryCard} ${isInstalled ? styles.registryCardInstalled : ''}`}>
                  <div className={styles.registryTop} onClick={() => setExpanded(isOpen ? null : server.id)}>
                    <div className={styles.registryInfo}>
                      <div className={styles.registryNameRow}>
                        <ServerTypeBadge type={server.type} />
                        <span className={styles.registryName}>{server.name}</span>
                        <span className={styles.registryAuthor}>{server.author}</span>
                      </div>
                      <p className={styles.registryDesc}>{server.description}</p>
                      <div className={styles.registryTags}>
                        {server.tags.map(t => <span key={t} className={styles.registryTag}>{t}</span>)}
                      </div>
                    </div>
                    <div className={styles.registryBtns}>
                      {isInstalled ? (
                        <span className={styles.installedBadge}>Configured</span>
                      ) : (
                        <button
                          className={styles.addBtn}
                          onClick={e => { e.stopPropagation(); onAdd(server); }}
                        >Add</button>
                      )}
                      <button className={styles.expandBtn} onClick={e => { e.stopPropagation(); setExpanded(isOpen ? null : server.id); }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className={styles.registryDetail}>
                      <div className={styles.detailSection}>
                        <span className={styles.detailLabel}>Config preview</span>
                        <pre className={styles.detailPre}>{JSON.stringify({ [server.id]: server.config }, null, 2)}</pre>
                      </div>
                      {server.configNote && (
                        <div className={styles.detailNote}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                          </svg>
                          {server.configNote}
                        </div>
                      )}
                      <a className={styles.detailDocs} href={server.docs} target="_blank" rel="noopener noreferrer">
                        View docs →
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main MCPView ──────────────────────────────────────────────────────────────

export default function MCPView() {
  const [servers, setServers] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('configured');
  const [panel, setPanel] = useState(null); // null | 'add' | { key, config } for edit
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/mcp-servers')
      .then(r => r.json())
      .then(d => { setServers(d.mcpServers || {}); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function persist(updated) {
    setSaving(true);
    try {
      const res = await fetch('/api/mcp-servers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mcpServers: updated }),
      });
      const data = await res.json();
      setServers(data.mcpServers || {});
    } finally {
      setSaving(false);
    }
  }

  function handleSave({ key, config }) {
    const updated = { ...servers, [key]: config };
    persist(updated);
    setPanel(null);
  }

  function handleRemove(key) {
    const updated = { ...servers };
    delete updated[key];
    persist(updated);
  }

  function handleEdit(key, cfg) {
    setPanel({ key, config: cfg });
    setTab('configured');
  }

  function handleAddFromRegistry(server) {
    setPanel({ prefill: server });
    setTab('configured');
  }

  const serverCount = Object.keys(servers).length;

  return (
    <div className={styles.root}>
      {/* ── Left: header + tabs + content ── */}
      <div className={styles.main}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.title}>MCP Servers</span>
            {serverCount > 0 && <span className={styles.countBadge}>{serverCount}</span>}
            {saving && <span className={styles.savingDot} title="Saving…" />}
          </div>
          <div className={styles.headerRight}>
            <div className={styles.tabBar}>
              <button className={`${styles.tabBtn} ${tab === 'configured' ? styles.tabBtnOn : ''}`} onClick={() => setTab('configured')}>
                Configured
                {serverCount > 0 && <span className={styles.tabCount}>{serverCount}</span>}
              </button>
              <button className={`${styles.tabBtn} ${tab === 'discover' ? styles.tabBtnOn : ''}`} onClick={() => setTab('discover')}>
                Discover
              </button>
            </div>
            <button
              className={styles.newBtn}
              onClick={() => { setPanel('add'); setTab('configured'); }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add custom
            </button>
          </div>
        </div>

        <div className={styles.body}>
          {loading ? (
            <div className={styles.empty}><span>Loading…</span></div>
          ) : tab === 'configured' ? (
            <ConfiguredTab
              servers={servers}
              onEdit={handleEdit}
              onRemove={handleRemove}
              onAddCustom={() => setPanel('add')}
            />
          ) : (
            <DiscoverTab
              configured={servers}
              onAdd={handleAddFromRegistry}
            />
          )}
        </div>
      </div>

      {/* ── Right: add/edit panel ── */}
      {panel && (
        <div className={styles.formPanel}>
          <div className={styles.formPanelHeader}>
            <span className={styles.formPanelTitle}>
              {panel === 'add' ? 'Add custom server' : panel.prefill ? `Add "${panel.prefill.name}"` : `Edit "${panel.key}"`}
            </span>
            <button className={styles.formPanelClose} onClick={() => setPanel(null)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {panel.prefill ? (
            // Pre-fill from registry
            <ServerForm
              initial={{
                key: panel.prefill.id,
                config: panel.prefill.config,
              }}
              onSave={handleSave}
              onCancel={() => setPanel(null)}
            />
          ) : panel === 'add' ? (
            <ServerForm onSave={handleSave} onCancel={() => setPanel(null)} />
          ) : (
            <ServerForm
              initial={{ key: panel.key, config: panel.config }}
              onSave={handleSave}
              onCancel={() => setPanel(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
