import { useState, useEffect, useRef, useCallback } from 'react';
import styles from '../styles/MCPView.module.css';

// ── Curated server list (quick-add) ──────────────────────────────────────────

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

function TransportBadge({ transport }) {
  const label = transport === 'streamable_http' ? 'HTTP' : transport === 'stdio' ? 'stdio' : 'SSE';
  return <span className={transport === 'stdio' ? styles.badgeStdio : styles.badgeSSE}>{label}</span>;
}

// ── Server registration form ──────────────────────────────────────────────────

const EMPTY_FORM = {
  name: '',
  transport: 'streamable_http',
  url: '',
  command: '',
  args: '',
  description: '',
  bearerToken: '',
  envPairs: [{ k: '', v: '' }],
};

function ServerForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(() => {
    if (!initial) return EMPTY_FORM;
    const cfg = initial.config || {};
    const isStdio = !!cfg.command;
    const envPairs = Object.entries(cfg.env || {}).map(([k, v]) => ({ k, v }));
    return {
      name: initial.key || initial.name || '',
      transport: isStdio ? 'stdio' : cfg.type === 'sse' ? 'sse' : 'streamable_http',
      url: cfg.url || '',
      command: cfg.command || '',
      args: (cfg.args || []).join(' '),
      description: initial.description || '',
      bearerToken: '',
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
  function removeEnvRow(i) { setForm(f => ({ ...f, envPairs: f.envPairs.filter((_, idx) => idx !== i) })); }

  function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const env = Object.fromEntries(form.envPairs.filter(p => p.k.trim()).map(p => [p.k.trim(), p.v]));
    const payload = {
      name: form.name.trim(),
      transport: form.transport,
      description: form.description.trim(),
    };
    if (form.transport === 'stdio') {
      payload.command = form.command.trim();
      payload.args = form.args.trim() ? form.args.trim().split(/\s+/) : [];
      if (Object.keys(env).length) payload.env = env;
    } else {
      payload.url = form.url.trim();
      if (form.bearerToken.trim()) payload.bearerToken = form.bearerToken.trim();
    }
    onSave(payload);
  }

  return (
    <form className={styles.serverForm} onSubmit={submit}>
      <div className={styles.formField}>
        <label className={styles.formLabel}>Server name</label>
        <input
          className={styles.formInput}
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="e.g. github"
          required
          disabled={!!initial?.key}
        />
      </div>

      <div className={styles.formField}>
        <label className={styles.formLabel}>Transport</label>
        <div className={styles.typeToggle}>
          {[
            { id: 'streamable_http', label: 'HTTP' },
            { id: 'sse', label: 'SSE' },
            { id: 'stdio', label: 'stdio' },
          ].map(t => (
            <button
              key={t.id}
              type="button"
              className={`${styles.typeBtn} ${form.transport === t.id ? styles.typeBtnOn : ''}`}
              onClick={() => set('transport', t.id)}
            >{t.label}</button>
          ))}
        </div>
      </div>

      {form.transport === 'stdio' ? (
        <>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Command</label>
            <input className={styles.formInput} value={form.command} onChange={e => set('command', e.target.value)} placeholder="npx" required />
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Arguments</label>
            <input className={styles.formInput} value={form.args} onChange={e => set('args', e.target.value)} placeholder="-y @modelcontextprotocol/server-github" />
            <span className={styles.formHint}>Space-separated.</span>
          </div>
        </>
      ) : (
        <>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Server URL</label>
            <input className={styles.formInput} value={form.url} onChange={e => set('url', e.target.value)} placeholder="https://mcp.example.com/mcp" required />
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Bearer token <span className={styles.formOptional}>(optional)</span></label>
            <input className={styles.formInput} type="password" value={form.bearerToken} onChange={e => set('bearerToken', e.target.value)} placeholder="Token for authenticated servers" />
          </div>
        </>
      )}

      <div className={styles.formField}>
        <label className={styles.formLabel}>Description <span className={styles.formOptional}>(optional)</span></label>
        <input className={styles.formInput} value={form.description} onChange={e => set('description', e.target.value)} placeholder="What this server does" />
      </div>

      {form.transport === 'stdio' && (
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
      )}

      <div className={styles.formActions}>
        <button type="submit" className={styles.saveBtn}>Register server</button>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

// ── Configured servers tab ────────────────────────────────────────────────────

function ConfiguredTab({ servers, connected, onToggle, onRemove, onAddCustom }) {
  if (!connected) {
    return (
      <div className={styles.disconnected}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.25 }}>
          <circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M17.66 6.34l1.42-1.42"/>
        </svg>
        <span className={styles.disconnectedTitle}>MCPJungle not reachable</span>
        <span className={styles.disconnectedDesc}>
          Start MCPJungle at <code>localhost:8080</code> to manage servers here.
          Claude still connects via <code>mcp-config.json</code> when MCPJungle is running.
        </span>
        <a
          className={styles.disconnectedLink}
          href="https://docs.mcpjungle.com/installation.md"
          target="_blank"
          rel="noopener noreferrer"
        >
          Installation guide →
        </a>
      </div>
    );
  }

  if (Object.keys(servers).length === 0) {
    return (
      <div className={styles.empty}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.25 }}>
          <circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M17.66 6.34l1.42-1.42"/>
        </svg>
        <span>No servers registered in MCPJungle yet</span>
        <button className={styles.emptyBtn} onClick={onAddCustom}>Register your first server</button>
      </div>
    );
  }

  return (
    <div className={styles.configuredList}>
      {Object.entries(servers).map(([key, cfg]) => {
        const transport = cfg._transport || (cfg.command ? 'stdio' : 'streamable_http');
        const enabled = cfg._enabled !== false;
        const envKeys = Object.keys(cfg.env || {});
        return (
          <div key={key} className={`${styles.configuredCard} ${!enabled ? styles.configuredCardDisabled : ''}`}>
            <div className={styles.configuredTop}>
              <div className={styles.configuredName}>
                <TransportBadge transport={transport} />
                <span>{key}</span>
                {!enabled && <span className={styles.disabledBadge}>disabled</span>}
              </div>
              <div className={styles.configuredActions}>
                <button
                  className={enabled ? styles.disableBtn : styles.enableBtn}
                  onClick={() => onToggle(key, enabled)}
                  title={enabled ? 'Disable' : 'Enable'}
                >
                  {enabled ? (
                    <>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                      </svg>
                      Disable
                    </>
                  ) : (
                    <>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      Enable
                    </>
                  )}
                </button>
                <button className={styles.removeBtn} onClick={() => onRemove(key)} title="Deregister">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                  Remove
                </button>
              </div>
            </div>
            <div className={styles.configuredMeta}>
              {cfg.command ? (
                <code className={styles.configPre}>{[cfg.command, ...(cfg.args || [])].join(' ')}</code>
              ) : (
                <code className={styles.configPre}>{cfg.url}</code>
              )}
              {cfg._description && <span className={styles.configDesc}>{cfg._description}</span>}
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

// ── Public MCP registry discovery ─────────────────────────────────────────────

const OFFICIAL_MCP_SERVERS = [
  { name: 'Filesystem', id: 'filesystem', description: 'Read/write local files and directories', npm: '@modelcontextprotocol/server-filesystem', repo: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem' },
  { name: 'Git', id: 'git', description: 'Read git repositories — commits, diffs, branches, file history', npm: '@modelcontextprotocol/server-git', repo: 'https://github.com/modelcontextprotocol/servers/tree/main/src/git' },
  { name: 'GitHub', id: 'github', description: 'Manage repos, issues, PRs, files, and search code on GitHub', npm: '@modelcontextprotocol/server-github', repo: 'https://github.com/modelcontextprotocol/servers/tree/main/src/github' },
  { name: 'GitLab', id: 'gitlab', description: 'Interact with GitLab repositories, issues, and merge requests', npm: '@modelcontextprotocol/server-gitlab', repo: 'https://github.com/modelcontextprotocol/servers/tree/main/src/gitlab' },
  { name: 'SQLite', id: 'sqlite', description: 'Query and inspect SQLite databases', npm: '@modelcontextprotocol/server-sqlite', repo: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite' },
  { name: 'PostgreSQL', id: 'postgres', description: 'Read-only access to PostgreSQL databases', npm: '@modelcontextprotocol/server-postgres', repo: 'https://github.com/modelcontextprotocol/servers/tree/main/src/postgres' },
  { name: 'Brave Search', id: 'brave-search', description: 'Web and local search via the Brave Search API', npm: '@modelcontextprotocol/server-brave-search', repo: 'https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search' },
  { name: 'Fetch', id: 'fetch', description: 'Fetch web pages and convert them to Markdown', npm: '@modelcontextprotocol/server-fetch', repo: 'https://github.com/modelcontextprotocol/servers/tree/main/src/fetch' },
  { name: 'Puppeteer', id: 'puppeteer', description: 'Browser automation — navigate pages, click, fill forms, take screenshots', npm: '@modelcontextprotocol/server-puppeteer', repo: 'https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer' },
  { name: 'Slack', id: 'slack', description: 'Read channels, post messages, and search Slack workspaces', npm: '@modelcontextprotocol/server-slack', repo: 'https://github.com/modelcontextprotocol/servers/tree/main/src/slack' },
  { name: 'Google Maps', id: 'google-maps', description: 'Geocoding, directions, place search, and distance calculations', npm: '@modelcontextprotocol/server-google-maps', repo: 'https://github.com/modelcontextprotocol/servers/tree/main/src/google-maps' },
  { name: 'Memory', id: 'memory', description: 'Persistent key-value memory store for cross-session recall', npm: '@modelcontextprotocol/server-memory', repo: 'https://github.com/modelcontextprotocol/servers/tree/main/src/memory' },
  { name: 'Sequential Thinking', id: 'sequential-thinking', description: 'Structured step-by-step reasoning for complex problems', npm: '@modelcontextprotocol/server-sequential-thinking', repo: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking' },
  { name: 'Everart', id: 'everart', description: 'AI image generation with multiple models', npm: '@everart-ai/mcp-server', repo: 'https://github.com/everart-ai/mcp-server' },
  { name: 'Weather', id: 'weather', description: 'Real-time weather data and forecasts', npm: '@modelcontextprotocol/server-weather', repo: 'https://github.com/modelcontextprotocol/servers/tree/main/src/weather' },
];

function PublicRegistry({ onAdd }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  const filtered = query.toLowerCase() ? OFFICIAL_MCP_SERVERS.filter(s =>
    s.name.toLowerCase().includes(query) ||
    s.description.toLowerCase().includes(query) ||
    s.id.includes(query)
  ) : OFFICIAL_MCP_SERVERS;

  function handleInput(e) {
    const q = e.target.value;
    setQuery(q);
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
          placeholder="Search official MCP servers…"
        />
        {query && (
          <button className={styles.discoverClear} onClick={() => setQuery('')}>×</button>
        )}
      </div>

      {!loading && filtered.length === 0 && query && (
        <div className={styles.smitheryHint}>
          No servers match "{query}".
        </div>
      )}

      {filtered.length > 0 && (
        <div className={styles.smitheryResults}>
          {filtered.map((server, i) => (
            <div key={server.id} className={styles.smitheryCard}>
              <div className={styles.smitheryCardLeft}>
                <div className={styles.smitheryCardName}>
                  <span className={styles.registryName}>{server.name}</span>
                  <span className={styles.smitheryAuthor}>official</span>
                </div>
                {server.description && <p className={styles.smitheryCardDesc}>{server.description}</p>}
                <a
                  href={server.repo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.smitheryLink}
                >
                  View on GitHub →
                </a>
              </div>
              <button
                className={styles.addBtn}
                onClick={() => onAdd({
                  id: server.id,
                  name: server.name,
                  description: server.description || '',
                  type: 'stdio',
                  config: { command: 'npx', args: ['-y', server.npm] },
                  docs: server.repo,
                  tags: [],
                })}
              >
                Register
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── MCPJungle live tools viewer ───────────────────────────────────────────────

function MCPJungleTools({ connected }) {
  const [query, setQuery] = useState('');
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  const load = useCallback((q = '') => {
    if (!connected) return;
    setLoading(true);
    setError('');
    fetch(`/api/mcp-registry${q ? `?q=${encodeURIComponent(q)}` : ''}`)
      .then(r => r.json())
      .then(d => {
        setTools(d.tools || []);
        if (d.error) setError(d.error);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [connected]);

  useEffect(() => { load(); }, [load]);

  function handleInput(e) {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(q), 350);
  }

  if (!connected) {
    return null;
  }

  return (
    <div className={styles.smitherySection}>
      <div className={styles.smitheryLabel}>Your registered server tools</div>
      <div className={styles.smitheryHeader}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          ref={inputRef}
          className={styles.smitheryInput}
          value={query}
          onChange={handleInput}
          placeholder="Search your registered tools…"
        />
        {loading && <span className={styles.smitherySpin} />}
        {query && !loading && (
          <button className={styles.discoverClear} onClick={() => { setQuery(''); load(); }}>×</button>
        )}
      </div>

      {error && <div className={styles.smitheryError}>{error}</div>}

      {!loading && tools.length === 0 && !error && (
        <div className={styles.smitheryHint}>
          {query
            ? `No tools match "${query}".`
            : 'No tools found. Register servers to expose their tools here.'}
        </div>
      )}

      {tools.length > 0 && (
        <div className={styles.smitheryResults}>
          {tools.map((tool, i) => (
            <div key={tool.name || i} className={styles.smitheryCard}>
              <div className={styles.smitheryCardLeft}>
                <div className={styles.smitheryCardName}>
                  <span className={styles.registryName}>{tool.name}</span>
                  {tool.server_name && (
                    <span className={styles.smitheryUses}>via {tool.server_name}</span>
                  )}
                </div>
                {tool.description && <p className={styles.smitheryCardDesc}>{tool.description}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Discover tab ──────────────────────────────────────────────────────────────

function DiscoverTab({ servers, connected, onAdd }) {
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
      {/* Public MCP registry discovery */}
      <div className={styles.discoverSection}>
        <PublicRegistry onAdd={onAdd} />
      </div>

      {/* Live MCPJungle tools if connected */}
      {connected && (
        <div className={styles.discoverSection}>
          <MCPJungleTools connected={connected} />
        </div>
      )}

      <div className={styles.curatedDivider}>
        <span className={styles.curatedLabel}>Curated picks — register via MCPJungle</span>
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
              const isInstalled = !!servers[server.id];
              const isOpen = expanded === server.id;
              return (
                <div key={server.id} className={`${styles.registryCard} ${isInstalled ? styles.registryCardInstalled : ''}`}>
                  <div className={styles.registryTop} onClick={() => setExpanded(isOpen ? null : server.id)}>
                    <div className={styles.registryInfo}>
                      <div className={styles.registryNameRow}>
                        <TransportBadge transport={server.type} />
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
                        <span className={styles.installedBadge}>Registered</span>
                      ) : (
                        <button
                          className={styles.addBtn}
                          onClick={e => { e.stopPropagation(); onAdd(server); }}
                        >Register</button>
                      )}
                      <button className={styles.expandBtn} onClick={e => { e.stopPropagation(); setExpanded(isOpen ? null : server.id); }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform var(--transition)' }}>
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
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('configured');
  const [panel, setPanel] = useState(null); // null | 'add' | { prefill }
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');

  async function reload() {
    try {
      const r = await fetch('/api/mcp-servers');
      const d = await r.json();
      setServers(d.mcpServers || {});
      setConnected(d.connected || false);
    } catch {
      setConnected(false);
    }
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  async function handleSave(serverData) {
    setSaving(true);
    setActionError('');
    try {
      const r = await fetch('/api/mcp-servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverData),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Registration failed');
      await reload();
      setPanel(null);
    } catch (e) {
      setActionError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(name) {
    setSaving(true);
    setActionError('');
    try {
      const r = await fetch(`/api/mcp-servers?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Deregistration failed');
      await reload();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(name, currentlyEnabled) {
    setSaving(true);
    setActionError('');
    try {
      const action = currentlyEnabled ? 'disable' : 'enable';
      const r = await fetch('/api/mcp-servers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, action }),
      });
      if (!r.ok) throw new Error(`${action} failed`);
      await reload();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function handleAddFromRegistry(server) {
    const isStdio = !!server.config?.command;
    setPanel({
      prefill: {
        name: server.name,
        key: server.id,
        description: server.description || '',
        config: server.config,
      },
    });
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
            {connected && (
              <span className={styles.connectedBadge} title="MCPJungle connected">
                <span className={styles.connectedDot} />
                MCPJungle
              </span>
            )}
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
              disabled={!connected}
              title={connected ? 'Register a custom server' : 'Start MCPJungle to register servers'}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Register
            </button>
          </div>
        </div>

        {actionError && (
          <div className={styles.actionError}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {actionError}
            <button className={styles.actionErrorClose} onClick={() => setActionError('')}>×</button>
          </div>
        )}

        <div className={styles.body}>
          {loading ? (
            <div className={styles.empty}><span>Connecting to MCPJungle…</span></div>
          ) : tab === 'configured' ? (
            <ConfiguredTab
              servers={servers}
              connected={connected}
              onToggle={handleToggle}
              onRemove={handleRemove}
              onAddCustom={() => setPanel('add')}
            />
          ) : (
            <DiscoverTab
              servers={servers}
              connected={connected}
              onAdd={handleAddFromRegistry}
            />
          )}
        </div>
      </div>

      {/* ── Right: register / edit panel ── */}
      {panel && (
        <div className={styles.formPanel}>
          <div className={styles.formPanelHeader}>
            <span className={styles.formPanelTitle}>
              {panel === 'add' ? 'Register custom server' : `Register "${panel.prefill?.name}"`}
            </span>
            <button className={styles.formPanelClose} onClick={() => { setPanel(null); setActionError(''); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <ServerForm
            initial={panel === 'add' ? null : panel.prefill}
            onSave={handleSave}
            onCancel={() => { setPanel(null); setActionError(''); }}
          />
        </div>
      )}
    </div>
  );
}
