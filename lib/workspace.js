import fs from 'fs';
import path from 'path';

export const TEXT_EXTS = new Set([
  '.md', '.txt', '.json', '.js', '.ts', '.jsx', '.tsx', '.py', '.sh',
  '.yaml', '.yml', '.toml', '.csv', '.html', '.css', '.sql',
  '.go', '.rs', '.java', '.rb', '.php', '.env.example', '.conf', '.ini',
]);

export const MAX_INLINE_FILE_BYTES = 24 * 1024;
export const MAX_INLINE_TOTAL_BYTES = 96 * 1024;

export function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function readWorkspaceDir(dir, label, inlineBudgetRef) {
  if (!fs.existsSync(dir)) return null;

  const instructionsPath = path.join(dir, 'instructions.md');
  const instructions = fs.existsSync(instructionsPath)
    ? fs.readFileSync(instructionsPath, 'utf8').trim()
    : null;

  const entries = fs.readdirSync(dir)
    .filter(f => f !== 'instructions.md' && f !== 'buckets' && !f.startsWith('.'));

  if (!instructions && entries.length === 0) return null;

  const inlined = [];
  const refs = [];

  for (const f of entries) {
    const filePath = path.join(dir, f);
    let stat;
    try { stat = fs.statSync(filePath); } catch { continue; }
    if (stat.isDirectory()) continue;

    const ext = path.extname(f).toLowerCase();
    const canInline =
      TEXT_EXTS.has(ext) &&
      stat.size <= MAX_INLINE_FILE_BYTES &&
      inlineBudgetRef.used + stat.size <= MAX_INLINE_TOTAL_BYTES;

    if (canInline) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        inlined.push({ name: f, filePath, content });
        inlineBudgetRef.used += stat.size;
      } catch {
        refs.push({ name: f, filePath, size: stat.size });
      }
    } else {
      refs.push({ name: f, filePath, size: stat.size });
    }
  }

  let ctx = `\n--- ${label} ---`;
  if (instructions) ctx += `\nInstructions:\n${instructions}`;

  if (inlined.length > 0) {
    ctx += `\n\nWorkspace files (contents available — no need to Read these separately):`;
    for (const { name, filePath, content } of inlined) {
      ctx += `\n\n<workspace_file path="${filePath}" name="${name}">\n${content}\n</workspace_file>`;
    }
  }

  if (refs.length > 0) {
    ctx += `\n\nAdditional workspace files (use the Read tool to access):`;
    for (const { name, filePath, size } of refs) {
      const kb = (size / 1024).toFixed(1);
      ctx += `\n  ${filePath}  [${kb} KB]`;
    }
  }

  ctx += `\n--- End ${label} ---`;
  return ctx;
}

export function loadWorkspaceContext(projectId, bucketName, workspaceRoot = path.join(process.cwd(), 'workspace')) {
  if (!projectId || projectId === 'daily') return null;

  const safeProject = projectId.replace(/[^a-zA-Z0-9_-]/g, '');
  const projectDir = path.join(workspaceRoot, safeProject);

  const inlineBudgetRef = { used: 0 };
  const parts = [];

  const projectCtx = readWorkspaceDir(projectDir, 'Project Workspace', inlineBudgetRef);
  if (projectCtx) parts.push(projectCtx);

  if (bucketName) {
    const bucketDir = path.join(projectDir, 'buckets', slugify(bucketName));
    const bucketCtx = readWorkspaceDir(bucketDir, `Bucket Workspace: ${bucketName}`, inlineBudgetRef);
    if (bucketCtx) parts.push(bucketCtx);
  }

  return parts.length > 0 ? '\n' + parts.join('\n') + '\n' : null;
}
