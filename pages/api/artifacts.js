import fs from 'fs';
import path from 'path';
import { readData, writeData, DATA_PATHS } from '../../lib/datastore.js';
import { uid, slugify } from '../../lib/utils.js';

const DATA_FILE = DATA_PATHS.DATA_FILE;
const WORKSPACE = path.join(process.cwd(), 'workspace');

// slugify is now imported from lib/utils.js

function artifactExt(type, lang) {
  if (type === 'json') return '.json';
  if (type === 'markdown') return '.md';
  if (type === 'code' && lang) {
    const map = {
      python: '.py', py: '.py', typescript: '.ts', ts: '.ts',
      javascript: '.js', js: '.js', rust: '.rs', go: '.go',
      java: '.java', css: '.css', html: '.html',
      bash: '.sh', shell: '.sh', sh: '.sh', sql: '.sql',
      yaml: '.yaml', yml: '.yaml', ruby: '.rb', php: '.php',
      swift: '.swift', kotlin: '.kt', c: '.c', cpp: '.cpp', cs: '.cs',
    };
    return map[lang.toLowerCase()] || `.${lang.toLowerCase()}`;
  }
  return '.txt';
}

function typeFromExt(ext) {
  if (ext === '.md')   return { type: 'markdown', lang: '' };
  if (ext === '.json') return { type: 'json',     lang: '' };
  if (ext === '.txt')  return { type: 'text',     lang: '' };
  const codeMap = {
    '.py': 'python', '.ts': 'typescript', '.js': 'javascript',
    '.rs': 'rust',   '.go': 'go',         '.java': 'java',
    '.css': 'css',   '.html': 'html',     '.sh': 'bash',
    '.sql': 'sql',   '.yaml': 'yaml',     '.yml': 'yaml',
    '.rb': 'ruby',   '.php': 'php',       '.swift': 'swift',
    '.kt': 'kotlin', '.c': 'c',           '.cpp': 'cpp',  '.cs': 'csharp',
  };
  const lang = codeMap[ext];
  return lang ? { type: 'code', lang } : { type: 'text', lang: '' };
}

function parseArtifactFilename(filename) {
  // Expected format: <id>--<sanitized-name>.<ext>
  const m = filename.match(/^([a-z0-9]+)--(.+?)(\.[^.]+)$/);
  if (m) {
    const [, id, namePart, ext] = m;
    return { id, name: namePart.replace(/-+/g, ' ').trim(), ext };
  }
  const extM = filename.match(/(\.[^.]+)$/);
  return { id: null, name: filename.replace(/\.[^.]+$/, ''), ext: extM?.[1] || '' };
}

function sanitizeName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

// Artifact files live under:
//   workspace/<projectId>/uncategorized/artifacts/   ← no bucket
//   workspace/<projectId>/buckets/<slug>/artifacts/  ← bucketed
function artifactDir(projectId, bucket) {
  const safeProject = projectId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (bucket) {
    return path.join(WORKSPACE, safeProject, 'buckets', slugify(bucket), 'artifacts');
  }
  return path.join(WORKSPACE, safeProject, 'uncategorized', 'artifacts');
}

function writeArtifactFile(projectId, bucket, id, name, type, lang, content) {
  const dir = artifactDir(projectId, bucket);
  fs.mkdirSync(dir, { recursive: true });
  const filename = id + '--' + sanitizeName(name) + artifactExt(type, lang);
  const fullPath = path.join(dir, filename);
  fs.writeFileSync(fullPath, content, 'utf8');
  return path.relative(process.cwd(), fullPath);
}

function deleteArtifactFile(filePath) {
  if (!filePath) return;
  const fullPath = path.join(process.cwd(), filePath);
  try { fs.unlinkSync(fullPath); } catch {}
}

// Scan every artifacts/ subdirectory under the project workspace.
// Returns { fullPath, relPath, filename, bucketSlug } for each file found.
function scanArtifactFiles(projectId) {
  const safeProject = projectId.replace(/[^a-zA-Z0-9_-]/g, '');
  const results = [];

  function scanDir(dir, bucketSlug) {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith('.')) continue;
      const fullPath = path.join(dir, f);
      if (!fs.statSync(fullPath).isFile()) continue;
      results.push({
        fullPath,
        relPath: path.relative(process.cwd(), fullPath),
        filename: f,
        bucketSlug,
      });
    }
  }

  // uncategorized (current path)
  scanDir(path.join(WORKSPACE, safeProject, 'uncategorized', 'artifacts'), '');
  // legacy: old project-root artifacts/ path (before we added uncategorized/)
  scanDir(path.join(WORKSPACE, safeProject, 'artifacts'), '');

  // all bucket artifact directories
  const bucketsRoot = path.join(WORKSPACE, safeProject, 'buckets');
  if (fs.existsSync(bucketsRoot)) {
    for (const slug of fs.readdirSync(bucketsRoot)) {
      scanDir(path.join(bucketsRoot, slug, 'artifacts'), slug);
    }
  }

  return results;
}

export default function handler(req, res) {
  const params = req.method === 'GET' || req.method === 'DELETE' ? req.query : req.body;
  const { projectId } = params;

  if (!projectId) return res.status(400).json({ error: 'projectId required' });

  const data = readData();
  const project = (data.projects || []).find(p => p.id === projectId);
  if (!project) return res.status(404).json({ error: `Project "${projectId}" not found` });

  project.artifacts = project.artifacts || [];

  // ── GET ────────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    // Build lookup maps from data.json metadata
    const metaByPath = {};
    const metaById   = {};
    for (const a of project.artifacts) {
      if (a.filePath) metaByPath[a.filePath] = a;
      metaById[a.id] = a;
    }

    // Filesystem is the source of truth — scan all artifact dirs
    const fileEntries = scanArtifactFiles(projectId);
    const seenPaths   = new Set();
    const artifacts   = [];

    for (const { fullPath, relPath, filename, bucketSlug } of fileEntries) {
      seenPaths.add(relPath);
      const meta                   = metaByPath[relPath];
      const { id, name, ext }      = parseArtifactFilename(filename);
      const { type: derivedType, lang: derivedLang } = typeFromExt(ext);
      let stat, content;
      try {
        stat    = fs.statSync(fullPath);
        content = fs.readFileSync(fullPath, 'utf8');
      } catch { continue; }

      artifacts.push({
        id:        meta?.id        || id       || filename,
        name:      meta?.name      || name,
        type:      meta?.type      || derivedType,
        lang:      meta?.lang      !== undefined ? meta.lang : derivedLang,
        bucket:    meta?.bucket    || bucketSlug,
        filePath:  relPath,
        content,
        createdAt: meta?.createdAt || stat.birthtime.toISOString(),
        updatedAt: meta?.updatedAt || stat.mtime.toISOString(),
      });
    }

    // Also include any data.json-only artifacts (legacy: content stored in JSON, no file)
    for (const a of project.artifacts) {
      if (!a.filePath && a.content !== undefined) {
        artifacts.push({ ...a });
      }
    }

    return res.status(200).json({ artifacts });
  }

  // ── POST ───────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { name, type = 'text', lang = '', content = '', bucket = '' } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name required' });
    const id       = 'a' + uid();
    const filePath = writeArtifactFile(projectId, bucket, id, name.trim(), type, lang, content);
    const artifact = {
      id,
      name:      name.trim(),
      type,
      lang:      lang || '',
      bucket:    bucket || '',
      filePath,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    project.artifacts.push(artifact);
    writeData(data);
    return res.status(201).json({ artifact: { ...artifact, content } });
  }

  // ── PUT ────────────────────────────────────────────────────────────────────
  if (req.method === 'PUT') {
    const { artifactId, name, type, lang, content } = req.body;
    if (!artifactId) return res.status(400).json({ error: 'artifactId required' });
    const artifact = project.artifacts.find(a => a.id === artifactId);
    if (!artifact) return res.status(404).json({ error: `Artifact "${artifactId}" not found` });

    const newName    = name    !== undefined ? name.trim() : artifact.name;
    const newType    = type    !== undefined ? type        : artifact.type;
    const newLang    = lang    !== undefined ? lang        : artifact.lang;
    const oldContent = artifact.filePath
      ? (() => { try { return fs.readFileSync(path.join(process.cwd(), artifact.filePath), 'utf8'); } catch { return ''; } })()
      : (artifact.content || '');
    const newContent = content !== undefined ? content : oldContent;

    deleteArtifactFile(artifact.filePath);
    const filePath = writeArtifactFile(projectId, artifact.bucket || '', artifact.id, newName, newType, newLang, newContent);

    artifact.name      = newName;
    artifact.type      = newType;
    artifact.lang      = newLang;
    artifact.filePath  = filePath;
    delete artifact.content; // remove legacy inline content if present
    artifact.updatedAt = new Date().toISOString();
    writeData(data);
    return res.status(200).json({ artifact: { ...artifact, content: newContent } });
  }

  // ── DELETE ─────────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { artifactId, filePath: filePathParam } = req.query;
    if (!artifactId && !filePathParam) return res.status(400).json({ error: 'artifactId or filePath required' });

    // Remove from data.json if present
    const idx = artifactId ? project.artifacts.findIndex(a => a.id === artifactId) : -1;
    let resolvedFilePath = filePathParam || null;
    if (idx !== -1) {
      const [artifact] = project.artifacts.splice(idx, 1);
      resolvedFilePath = artifact.filePath || resolvedFilePath;
      writeData(data);
    }

    // Delete the file regardless of whether it was in data.json
    if (resolvedFilePath) {
      deleteArtifactFile(resolvedFilePath);
    }

    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
