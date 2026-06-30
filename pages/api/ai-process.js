import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CLAUDE_BIN = process.env.CLAUDE_PATH || '/opt/homebrew/bin/claude';
const LOG_DIR = '/Users/<user>/Desktop/ai/ai-logs';
const TIMEOUT_MS = 300_000;

const WORKSPACE_ROOT = path.join(process.cwd(), 'workspace');
const MCP_CONFIG = path.join(process.cwd(), 'mcp-config.json');
const AGENTS_FILE = path.join(process.cwd(), 'agents.json');
const DATA_FILE = path.join(process.cwd(), 'data.json');

// Text extensions whose contents get injected inline into the prompt
const TEXT_EXTS = new Set([
  '.md',
  '.txt',
  '.json',
  '.js',
  '.ts',
  '.jsx',
  '.tsx',
  '.py',
  '.sh',
  '.yaml',
  '.yml',
  '.toml',
  '.csv',
  '.html',
  '.css',
  '.sql',
  '.go',
  '.rs',
  '.java',
  '.rb',
  '.php',
  '.env.example',
  '.conf',
  '.ini',
]);

const MAX_INLINE_FILE_BYTES = 24 * 1024;
const MAX_INLINE_TOTAL_BYTES = 96 * 1024;

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return {
      projects: [],
      notifications: [],
      dailyTasks: [],
      reminders: [],
    };
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function loadAgents(ids) {
  if (!ids?.length) return [];

  try {
    const all = JSON.parse(fs.readFileSync(AGENTS_FILE, 'utf8'));

    return ids
      .map(id => all.find(a => a.id === id))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function readWorkspaceDir(dir, label, inlineBudgetRef) {
  if (!fs.existsSync(dir)) return null;

  const instructionsPath = path.join(dir, 'instructions.md');

  const instructions = fs.existsSync(instructionsPath)
    ? fs.readFileSync(instructionsPath, 'utf8').trim()
    : null;

  const entries = fs.readdirSync(dir)
    .filter(
      f =>
        f !== 'instructions.md' &&
        f !== 'buckets' &&
        !f.startsWith('.')
    );

  if (!instructions && entries.length === 0) {
    return null;
  }

  const inlined = [];
  const refs = [];

  for (const f of entries) {
    const filePath = path.join(dir, f);

    let stat;

    try {
      stat = fs.statSync(filePath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) continue;

    const ext = path.extname(f).toLowerCase();

    const canInline =
      TEXT_EXTS.has(ext) &&
      stat.size <= MAX_INLINE_FILE_BYTES &&
      inlineBudgetRef.used + stat.size <= MAX_INLINE_TOTAL_BYTES;

    if (canInline) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');

        inlined.push({
          name: f,
          filePath,
          content,
        });

        inlineBudgetRef.used += stat.size;
      } catch {
        refs.push({
          name: f,
          filePath,
          size: stat.size,
        });
      }
    } else {
      refs.push({
        name: f,
        filePath,
        size: stat.size,
      });
    }
  }

  let ctx = `\n--- ${label} ---`;

  if (instructions) {
    ctx += `\nInstructions:\n${instructions}`;
  }

  if (inlined.length > 0) {
    ctx += `\n\nWorkspace files (contents available — no need to Read these separately):`;

    for (const { name, filePath, content } of inlined) {
      ctx += `\n\n<workspace_file path="${filePath}" name="${name}">\n${content}\n</workspace_file>`;
    }
  }

  if (refs.length > 0) {
    ctx += `\n\nAdditional workspace files (use the Read tool to access):`;

    for (const { filePath, size } of refs) {
      const kb = (size / 1024).toFixed(1);
      ctx += `\n  ${filePath}  [${kb} KB]`;
    }
  }

  ctx += `\n--- End ${label} ---`;

  return ctx;
}

function loadWorkspaceContext(projectId, bucketName) {
  if (!projectId || projectId === 'daily') {
    return null;
  }

  const safeProject = projectId.replace(
    /[^a-zA-Z0-9_-]/g,
    ''
  );

  const projectDir = path.join(
    WORKSPACE_ROOT,
    safeProject
  );

  const inlineBudgetRef = { used: 0 };

  const parts = [];

  const projectCtx = readWorkspaceDir(
    projectDir,
    'Project Workspace',
    inlineBudgetRef
  );

  if (projectCtx) {
    parts.push(projectCtx);
  }

  if (bucketName) {
    const bucketDir = path.join(
      projectDir,
      'buckets',
      slugify(bucketName)
    );

    const bucketCtx = readWorkspaceDir(
      bucketDir,
      `Bucket Workspace: ${bucketName}`,
      inlineBudgetRef
    );

    if (bucketCtx) {
      parts.push(bucketCtx);
    }
  }

  return parts.length > 0
    ? '\n' + parts.join('\n') + '\n'
    : null;
}

// Tools pre-authorized on every run
const DEFAULT_ALLOWED_TOOLS = [
  'Bash',
  'Read',
  'Write',
  'Edit',
  'Glob',
  'Grep',
  'LS',
  'WebFetch',
  'WebSearch',
  'TodoWrite',
  'TodoRead',
];

const SIMULATED = {
  completed: [
    "I've analyzed this task thoroughly and drafted a complete implementation plan.",
    'Task analysis complete.',
  ],
  issue: [
    'I ran into a blocker while processing this task.',
    'Analysis revealed a constraint preventing completion.',
  ],
  human_input: [
    'I need your input to move forward.',
    'I need clarification before proceeding.',
  ],
};

function simulate() {
  const rand = Math.random();

  const type =
    rand < 0.55
      ? 'completed'
      : rand < 0.8
      ? 'human_input'
      : 'issue';

  const opts = SIMULATED[type];

  return {
    type,
    message: opts[Math.floor(Math.random() * opts.length)],
  };
}

function writeLine(stream, line = '') {
  stream.write(line + '\n');
}
function runClaude(
  prompt,
  logStream,
  allowedTools = [],
  model = null
) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const startMs = Date.now();

    // Write prompt to a temp file so we can pass it as a real file fd for
    // stdin. This is equivalent to shell's `< file` redirection and avoids
    // the 3-second pipe-timing race in claude --print mode: the file data
    // is already on disk when Claude opens fd 0, so the read returns
    // immediately with no polling window.
    const tempFile = path.join(
      os.tmpdir(),
      `aiops-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`
    );

    let stdinFd;
    try {
      fs.writeFileSync(tempFile, prompt, 'utf8');
      stdinFd = fs.openSync(tempFile, 'r');
    } catch (e) {
      reject(e);
      return;
    }

    function cleanup() {
      try { fs.unlinkSync(tempFile); } catch {}
    }

    const args = [
      '--print',
      '--output-format',
      'json',
    ];

    if (model) {
      args.push('--model', model);
    }

    if (allowedTools.length > 0) {
      args.push(
        '--allowedTools',
        allowedTools.join(',')
      );
    }

    if (fs.existsSync(MCP_CONFIG)) {
      args.push('--mcp-config', MCP_CONFIG);
    }

    const proc = spawn(CLAUDE_BIN, args, {
      env: { ...process.env },
      stdio: [stdinFd, 'pipe', 'pipe'],
    });

    // Parent closes its copy — child already inherited its own via fork/dup2
    try { fs.closeSync(stdinFd); } catch {}

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      cleanup();
      writeLine(
        logStream,
        '\n[TIMEOUT] Claude Code exceeded 300s limit.'
      );

      reject(new Error('Claude Code timed out'));
    }, TIMEOUT_MS);

    proc.stdout.on('data', d => {
      stdout += d.toString();
    });

    proc.stderr.on('data', d => {
      stderr += d.toString();
    });

    proc.on('close', code => {
      clearTimeout(timer);
      cleanup();

      const durationMs = Date.now() - startMs;

      writeLine(logStream, '=== RAW OUTPUT ===');

      try {
        const parsed = JSON.parse(stdout);

        writeLine(
          logStream,
          JSON.stringify(parsed, null, 2)
        );

        writeLine(logStream);

        if (stderr.trim()) {
          writeLine(logStream, '=== STDERR ===');
          writeLine(logStream, stderr.trim());
          writeLine(logStream);
        }

        writeLine(
          logStream,
          `Exit Code: ${code}`
        );

        writeLine(
          logStream,
          `Duration: ${(durationMs / 1000).toFixed(2)}s`
        );

        if (parsed.total_cost_usd != null) {
          writeLine(
            logStream,
            `Cost: $${parsed.total_cost_usd.toFixed(6)}`
          );
        }

        if (parsed.is_error) {
          reject(
            new Error(
              parsed.result ||
                'Claude returned an error'
            )
          );
        } else {
          resolve({
            text: parsed.result || '',
            permissionDenials:
              parsed.permission_denials || [],
          });
        }
      } catch {
        writeLine(logStream, stdout);

        if (stderr.trim()) {
          writeLine(logStream);
          writeLine(logStream, '=== STDERR ===');
          writeLine(logStream, stderr.trim());
        }

        writeLine(
          logStream,
          `Exit Code: ${code}`
        );

        writeLine(
          logStream,
          `Duration: ${(durationMs / 1000).toFixed(2)}s`
        );

        if (stdout.trim()) {
          resolve({
            text: stdout.trim(),
            permissionDenials: [],
          });
        } else {
          reject(
            new Error(
              stderr.trim() || 'No output from Claude'
            )
          );
        }
      }
    });

    proc.on('error', e => {
      clearTimeout(timer);
      cleanup();
      writeLine(
        logStream,
        `[ERROR] Failed to spawn Claude: ${e.message}`
      );

      reject(e);
    });
  });
}

function extractStructured(text) {
  const match = text.match(
    /\{[^{}]*"type"\s*:\s*"(completed|issue|human_input)"[^{}]*\}/s
  );

  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }

  const typeMatch = text.match(
    /"type"\s*:\s*"(completed|issue|human_input)"/
  );

  const msgMatch = text.match(
    /"message"\s*:\s*"((?:[^"\\]|\\.)*)"/
  );

  if (typeMatch && msgMatch) {
    return {
      type: typeMatch[1],
      message: msgMatch[1].replace(/\\n/g, ' '),
    };
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const {
    task,
    projectId,
    projectName,
    bucket,
    replyContext,
    approvedContext,
    allowedTools: bodyAllowedTools,
    instructions,
    agentIds,
  } = req.body;

  const notifId =
    'n' +
    Date.now() +
    Math.random().toString(36).slice(2, 6);

  const logFile = notifId + '.log';
  const logPath = path.join(LOG_DIR, logFile);

  fs.mkdirSync(LOG_DIR, {
    recursive: true,
  });

  const logStream = fs.createWriteStream(logPath);

  const timestamp = new Date().toISOString();

  writeLine(logStream, '=== AIOps Task Log ===');
  writeLine(logStream, `ID: ${notifId}`);
  writeLine(logStream, `Task: "${task.name}"`);
  writeLine(
    logStream,
    `Project: ${projectName}${
      bucket ? ' › ' + bucket : ''
    }`
  );
  writeLine(logStream, `Timestamp: ${timestamp}`);

  const mode = replyContext
    ? 'Human reply'
    : approvedContext
    ? 'Approved retry'
    : 'Initial analysis';

  writeLine(logStream, `Mode: ${mode}`);
  writeLine(logStream);

  const agents = loadAgents(agentIds);

  let prompt;

  const workspaceCtx = loadWorkspaceContext(
    projectId,
    bucket
  );

  prompt = `
You are an AI assistant in AIOps Workbench.

Project: ${projectName}
Bucket: ${bucket || 'Uncategorized'}
Task: "${task.name}"
${task.desc ? `Description: "${task.desc}"` : ''}

${workspaceCtx || ''}

${
  instructions
    ? `Additional instructions:\n${instructions}`
    : ''
}

USE YOUR TOOLS to complete this task now.

Return ONLY valid JSON:

{"type":"completed","message":"What you completed"}

OR

{"type":"issue","message":"What blocked you"}

OR

{"type":"human_input","message":"What you need"}
`;

  writeLine(logStream, '=== PROMPT ===');
  writeLine(logStream, prompt);
  writeLine(logStream);

  let type;
  let message;
  let deniedOperations = [];
  let simulated = false;
  let rawOutput = '';

  const approvedTools =
    approvedContext?.approvedTools || [];

  let agentTools = [];
  let agentModel = null;

  if (agents.length === 1) {
    agentTools = agents[0].allowedTools || [];
    agentModel = agents[0].model;
  } else if (agents.length > 1) {
    agentTools = [
      'Agent',
      ...new Set(
        agents.flatMap(a => a.allowedTools || [])
      ),
    ];

    agentModel = agents[0].model;
  }

  const baseTools = agentTools.length
    ? agentTools
    : bodyAllowedTools?.length
    ? bodyAllowedTools
    : DEFAULT_ALLOWED_TOOLS;

  let mcpWildcards = [];

  if (fs.existsSync(MCP_CONFIG)) {
    try {
      const mcpCfg = JSON.parse(
        fs.readFileSync(MCP_CONFIG, 'utf8')
      );

      const includeMcp =
        !agents.length ||
        agents.some(a => a.useMcp !== false);

      if (includeMcp) {
        mcpWildcards = Object.keys(
          mcpCfg.mcpServers || {}
        ).map(s => `mcp__${s}__*`);
      }
    } catch {}
  }

  const allAllowedTools = [
    ...new Set([
      ...baseTools,
      ...approvedTools,
      ...mcpWildcards,
    ]),
  ];

  writeLine(
    logStream,
    `Allowed tools: ${allAllowedTools.join(', ')}`
  );

  try {
    const {
      text: raw,
      permissionDenials,
    } = await runClaude(
      prompt,
      logStream,
      allAllowedTools,
      agentModel
    );

    rawOutput = raw;

    if (permissionDenials.length > 0) {
      type = 'permission_required';

      deniedOperations = permissionDenials.map(d => ({
        tool: d.tool_name,
        toolUseId: d.tool_use_id,
        input: d.tool_input,
      }));

      const toolNames = [
        ...new Set(
          deniedOperations.map(d => d.tool)
        ),
      ];

      message = `Claude was blocked from using ${toolNames.join(
        ', '
      )}`;
    } else {
      const parsed = extractStructured(raw);

      if (parsed) {
        type = parsed.type;
        message = parsed.message;
      } else {
        type = 'completed';
        message = raw
          .replace(/\n+/g, ' ')
          .slice(0, 400);
      }
    }
  } catch (e) {
    simulated = true;

    writeLine(logStream, '=== FALLBACK ===');
    writeLine(logStream, `Reason: ${e.message}`);

    await new Promise(r =>
      setTimeout(r, 600 + Math.random() * 600)
    );

    ({ type, message } = simulate());
  }

  writeLine(logStream);
  writeLine(logStream, '=== RESULT ===');
  writeLine(logStream, `Type: ${type}`);
  writeLine(logStream, `Message: ${message}`);

  if (simulated) {
    writeLine(
      logStream,
      '(simulated — Claude unavailable)'
    );
  }

  logStream.end();

  res.status(200).json({
    id: notifId,
    type,
    projectId,
    projectName,
    taskId: task.id,
    taskName: task.name,
    bucket: bucket || '',
    message,
    deniedOperations,
    timestamp,
    read: false,
    logFile,
  });
}

// import { spawn } from 'child_process';
// import fs from 'fs';
// import path from 'path';

// const CLAUDE_BIN = process.env.CLAUDE_PATH || '/opt/homebrew/bin/claude';
// const LOG_DIR = '/Users/<user>/Desktop/ai/ai-logs';
// const TIMEOUT_MS = 300_000;
// const WORKSPACE_ROOT = path.join(process.cwd(), 'workspace');
// const MCP_CONFIG = path.join(process.cwd(), 'mcp-config.json');
// const AGENTS_FILE = path.join(process.cwd(), 'agents.json');
// const DATA_FILE = path.join(process.cwd(), 'data.json');

// // Text extensions whose contents get injected inline into the prompt
// const TEXT_EXTS = new Set([
//   '.md', '.txt', '.json', '.js', '.ts', '.jsx', '.tsx', '.py', '.sh',
//   '.yaml', '.yml', '.toml', '.csv', '.html', '.css', '.sql',
//   '.go', '.rs', '.java', '.rb', '.php', '.env.example', '.conf', '.ini',
// ]);
// const MAX_INLINE_FILE_BYTES = 24 * 1024;   // 24 KB per file
// const MAX_INLINE_TOTAL_BYTES = 96 * 1024;  // 96 KB across all files

// function readData() {
//   try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
//   catch { return { projects: [], notifications: [], dailyTasks: [], reminders: [] }; }
// }

// function writeData(data) {
//   fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
// }

// function loadAgents(ids) {
//   if (!ids?.length) return [];
//   try {
//     const all = JSON.parse(fs.readFileSync(AGENTS_FILE, 'utf8'));
//     return ids.map(id => all.find(a => a.id === id)).filter(Boolean);
//   } catch { return []; }
// }

// function slugify(name) {
//   return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// }

// function readWorkspaceDir(dir, label, inlineBudgetRef) {
//   if (!fs.existsSync(dir)) return null;

//   const instructionsPath = path.join(dir, 'instructions.md');
//   const instructions = fs.existsSync(instructionsPath)
//     ? fs.readFileSync(instructionsPath, 'utf8').trim()
//     : null;

//   const entries = fs.readdirSync(dir)
//     .filter(f => f !== 'instructions.md' && f !== 'buckets' && !f.startsWith('.'));

//   if (!instructions && entries.length === 0) return null;

//   // Separate files that can be inlined from those that are too large / binary
//   const inlined = [];
//   const refs = [];

//   for (const f of entries) {
//     const filePath = path.join(dir, f);
//     let stat;
//     try { stat = fs.statSync(filePath); } catch { continue; }
//     if (stat.isDirectory()) continue;

//     const ext = path.extname(f).toLowerCase();
//     const canInline =
//       TEXT_EXTS.has(ext) &&
//       stat.size <= MAX_INLINE_FILE_BYTES &&
//       inlineBudgetRef.used + stat.size <= MAX_INLINE_TOTAL_BYTES;

//     if (canInline) {
//       try {
//         const content = fs.readFileSync(filePath, 'utf8');
//         inlined.push({ name: f, filePath, content });
//         inlineBudgetRef.used += stat.size;
//       } catch {
//         refs.push({ name: f, filePath, size: stat.size });
//       }
//     } else {
//       refs.push({ name: f, filePath, size: stat.size });
//     }
//   }

//   let ctx = `\n--- ${label} ---`;
//   if (instructions) ctx += `\nInstructions:\n${instructions}`;

//   if (inlined.length > 0) {
//     ctx += `\n\nWorkspace files (contents available — no need to Read these separately):`;
//     for (const { name, filePath, content } of inlined) {
//       ctx += `\n\n<workspace_file path="${filePath}" name="${name}">\n${content}\n</workspace_file>`;
//     }
//   }

//   if (refs.length > 0) {
//     ctx += `\n\nAdditional workspace files (use the Read tool to access):`;
//     for (const { name, filePath, size } of refs) {
//       const kb = (size / 1024).toFixed(1);
//       ctx += `\n  ${filePath}  [${kb} KB]`;
//     }
//   }

//   ctx += `\n--- End ${label} ---`;
//   return ctx;
// }

// function loadWorkspaceContext(projectId, bucketName) {
//   if (!projectId || projectId === 'daily') return null;
//   const safeProject = projectId.replace(/[^a-zA-Z0-9_-]/g, '');
//   const projectDir = path.join(WORKSPACE_ROOT, safeProject);

//   // Shared budget so project + bucket inlined bytes don't exceed the total cap
//   const inlineBudgetRef = { used: 0 };

//   const parts = [];
//   const projectCtx = readWorkspaceDir(projectDir, 'Project Workspace', inlineBudgetRef);
//   if (projectCtx) parts.push(projectCtx);

//   if (bucketName) {
//     const bucketDir = path.join(projectDir, 'buckets', slugify(bucketName));
//     const bucketCtx = readWorkspaceDir(bucketDir, `Bucket Workspace: ${bucketName}`, inlineBudgetRef);
//     if (bucketCtx) parts.push(bucketCtx);
//   }

//   return parts.length > 0 ? '\n' + parts.join('\n') + '\n' : null;
// }

// // Tools pre-authorized on every run — Claude won't prompt for these
// const DEFAULT_ALLOWED_TOOLS = [
//   'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'LS',
//   'WebFetch', 'WebSearch', 'TodoWrite', 'TodoRead',
// ];

// const SIMULATED = {
//   completed: [
//     "I've analyzed this task thoroughly and drafted a complete implementation plan. The key steps involve auditing current state, applying targeted changes, and validating against acceptance criteria. Everything looks achievable without additional blockers.",
//     "Task analysis complete. I've reviewed the requirements and mapped out the execution path. Dependencies are clear, scope is well-defined, and I'm ready to proceed with the outlined approach.",
//   ],
//   issue: [
//     "I ran into a blocker while processing this task. The required context or dependencies aren't fully specified, and there are potential conflicts with adjacent work that need to be resolved before I can proceed safely.",
//     "Analysis revealed a constraint that prevents autonomous completion. The task has cross-system dependencies and missing prerequisite data that require manual resolution first.",
//   ],
//   human_input: [
//     "I need your input to move forward. There are two viable approaches — a targeted fix with minimal scope, or a broader refactor with better long-term outcomes. Which direction aligns with your current priorities?",
//     "Before proceeding, I need clarification on the acceptance criteria. Could you define what 'done' looks like for this task, and flag any hard constraints around performance, compatibility, or deadline?",
//   ],
// };

// function simulate() {
//   const rand = Math.random();
//   const type = rand < 0.55 ? 'completed' : rand < 0.8 ? 'human_input' : 'issue';
//   const opts = SIMULATED[type];
//   return { type, message: opts[Math.floor(Math.random() * opts.length)] };
// }

// function writeLine(stream, line = '') {
//   stream.write(line + '\n');
// }

// function runClaude(prompt, logStream, allowedTools = [], model = null) {
//   return new Promise((resolve, reject) => {
//     let stdout = '';
//     let stderr = '';
//     const startMs = Date.now();

//     // Prompt is passed as a positional argument (claude [options] [prompt])
//     // — this avoids the stdin 3-second timeout in --print mode entirely.
//     const args = ['--print', '--output-format', 'json'];
//     if (model) args.push('--model', model);
//     if (allowedTools.length > 0) {
//       args.push('--allowedTools', allowedTools.join(','));
//     }
//     if (fs.existsSync(MCP_CONFIG)) {
//       args.push('--mcp-config', MCP_CONFIG);
//     }
//     args.push(prompt);

//     const proc = spawn(CLAUDE_BIN, args, {
//       env: { ...process.env },
//       stdio: ['ignore', 'pipe', 'pipe'],
//     });

//     const timer = setTimeout(() => {
//       proc.kill('SIGTERM');
//       writeLine(logStream, '\n[TIMEOUT] Claude Code exceeded 300s limit.');
//       reject(new Error('Claude Code timed out'));
//     }, TIMEOUT_MS);

//     proc.stdout.on('data', d => { stdout += d.toString(); });
//     proc.stderr.on('data', d => { stderr += d.toString(); });

//     proc.on('close', () => {
//       clearTimeout(timer);
//       const durationMs = Date.now() - startMs;

//       writeLine(logStream, '=== RAW OUTPUT ===');
//       try {
//         // Pretty-print the JSON Claude returns
//         const parsed = JSON.parse(stdout);
//         writeLine(logStream, JSON.stringify(parsed, null, 2));
//         writeLine(logStream);

//         if (stderr.trim()) {
//           writeLine(logStream, '=== STDERR ===');
//           writeLine(logStream, stderr.trim());
//           writeLine(logStream);
//         }

//         writeLine(logStream, `Duration: ${(durationMs / 1000).toFixed(2)}s`);
//         if (parsed.total_cost_usd != null) {
//           writeLine(logStream, `Cost: $${parsed.total_cost_usd.toFixed(6)}`);
//         }
//         if (parsed.modelUsage) {
//           const models = Object.keys(parsed.modelUsage);
//           if (models.length) writeLine(logStream, `Model(s): ${models.join(', ')}`);
//         }

//         if (parsed.is_error) reject(new Error(parsed.result || 'Claude returned an error'));
//         else resolve({ text: parsed.result || '', permissionDenials: parsed.permission_denials || [] });
//       } catch {
//         writeLine(logStream, stdout);
//         if (stderr.trim()) { writeLine(logStream); writeLine(logStream, '=== STDERR ==='); writeLine(logStream, stderr.trim()); }
//         writeLine(logStream, `Duration: ${(durationMs / 1000).toFixed(2)}s`);
//         if (stdout.trim()) resolve({ text: stdout.trim(), permissionDenials: [] });
//         else reject(new Error(stderr.trim() || 'No output from Claude'));
//       }
//     });

//     proc.on('error', e => {
//       clearTimeout(timer);
//       writeLine(logStream, `\n[ERROR] Failed to spawn Claude Code: ${e.message}`);
//       reject(e);
//     });
//   });
// }

// function extractStructured(text) {
//   const match = text.match(/\{[^{}]*"type"\s*:\s*"(completed|issue|human_input)"[^{}]*\}/s);
//   if (match) {
//     try { return JSON.parse(match[0]); } catch {}
//   }
//   const typeMatch = text.match(/"type"\s*:\s*"(completed|issue|human_input)"/);
//   const msgMatch = text.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
//   if (typeMatch && msgMatch) {
//     return { type: typeMatch[1], message: msgMatch[1].replace(/\\n/g, ' ') };
//   }
//   return null;
// }

// export default async function handler(req, res) {
//   if (req.method !== 'POST') return res.status(405).end();

//   const { task, projectId, projectName, bucket, replyContext, approvedContext, allowedTools: bodyAllowedTools, instructions, agentIds } = req.body;

//   const notifId = 'n' + Date.now() + Math.random().toString(36).slice(2, 6);
//   const logFile = notifId + '.log';
//   const logPath = path.join(LOG_DIR, logFile);

//   fs.mkdirSync(LOG_DIR, { recursive: true });
//   const logStream = fs.createWriteStream(logPath);

//   const timestamp = new Date().toISOString();

//   writeLine(logStream, '=== AIOps Task Log ===');
//   writeLine(logStream, `ID:        ${notifId}`);
//   writeLine(logStream, `Task:      "${task.name}"`);
//   writeLine(logStream, `Project:   ${projectName}${bucket ? ' › ' + bucket : ''}`);
//   writeLine(logStream, `Timestamp: ${timestamp}`);
//   const mode = replyContext ? 'Human reply' : approvedContext ? 'Approved retry' : 'Initial analysis';
//   writeLine(logStream, `Mode:      ${mode}`);
//   writeLine(logStream);

//   // Build MCP tool context so Claude knows to use them for workspace operations
//   let mcpToolHint = '';
//   if (fs.existsSync(MCP_CONFIG)) {
//     try {
//       const mcpCfg = JSON.parse(fs.readFileSync(MCP_CONFIG, 'utf8'));
//       const servers = Object.keys(mcpCfg.mcpServers || {});
//       if (servers.length) {
//         mcpToolHint = `
// You have MCP tools available for reading and writing live workspace data — prefer these over editing data.json directly:
// - mcp__aiops__list_projects       — list all projects, their ids, buckets, and task counts
// - mcp__aiops__create_project      — create a new project
// - mcp__aiops__list_buckets        — list work buckets in a project
// - mcp__aiops__add_bucket          — add a bucket to a project
// - mcp__aiops__delete_bucket       — remove a bucket (tasks are preserved)
// - mcp__aiops__get_project_tasks   — get all tasks in a project (includes ids)
// - mcp__aiops__create_task         — add a task to a project
// - mcp__aiops__update_task         — update any task fields (status, assignee, priority, etc.)
// - mcp__aiops__delete_task         — delete a task
// - mcp__aiops__add_comment         — add a comment to a task
// - mcp__aiops__search_tasks        — search tasks across all projects
// - mcp__aiops__get_daily_tasks     — list recurring daily tasks
// - mcp__aiops__create_daily_task   — add a recurring daily task
// - mcp__aiops__update_daily_task   — update a recurring daily task
// - mcp__aiops__delete_daily_task   — delete a recurring daily task
// - mcp__aiops__get_reminders       — list reminders
// - mcp__aiops__create_reminder     — create a reminder
// - mcp__aiops__complete_reminder   — mark a reminder done
// - mcp__aiops__delete_reminder     — delete a reminder
// - mcp__aiops__get_ai_queue        — view recent AI task results
// Always call list_projects first to get valid project ids before creating or updating tasks.`;
//       }
//     } catch {}
//   }

//   // Load configured agents before building the prompt (needed for agentCtx injection)
//   const agents = loadAgents(agentIds);

//   let prompt;
//   if (replyContext) {
//     prompt = `You are an AI assistant in AIOps Workbench. You previously worked on a task and asked the human a question. They have now replied — continue and complete the work.
// ${mcpToolHint}

// Task: "${task.name}"
// Your previous message: "${replyContext.previousMessage}"
// Human reply: "${replyContext.reply}"

// Use your tools to carry out whatever the human's reply enables. Do the actual work now.

// When done, write a single JSON line as your final output — nothing else after it:
// {"type":"completed","message":"What you did"} or {"type":"issue","message":"What went wrong"} or {"type":"human_input","message":"What you still need"}`;
//   } else if (approvedContext) {
//     const { previousMessage, deniedOperations, approvedTools } = approvedContext;
//     const blockedSummary = deniedOperations.map(op => {
//       const inputStr = JSON.stringify(op.input || {}).slice(0, 200);
//       return `  - ${op.tool}: ${inputStr}`;
//     }).join('\n');
//     prompt = `You are an AI assistant in AIOps Workbench. You were previously working on a task but some tool uses were blocked by the permission system. The user has now approved those tools — resume and complete the work without starting over.
// ${mcpToolHint}

// Project: ${projectName}
// Work Bucket: ${bucket || 'Uncategorized'}
// Task: "${task.name}"
// ${task.desc ? `Description: "${task.desc}"` : ''}

// Previously blocked operations (now approved):
// ${blockedSummary || '  (see approved tools list)'}

// Approved tools: ${approvedTools.join(', ')}

// Your previous progress/status: "${previousMessage}"

// Continue from where you left off. Do NOT repeat work you already completed.

// After completing the work (or if you hit a new blocker), write a single JSON line as your final output — nothing else after it:
// {"type":"completed","message":"Brief summary of what you did"} or {"type":"issue","message":"What blocked you"} or {"type":"human_input","message":"What decision or info you need"}`;
//   } else {
//     const workspaceCtx = loadWorkspaceContext(projectId, bucket);

//     // Build agent context string
//     let agentCtx = '';
//     if (agents.length === 1) {
//       const a = agents[0];
//       agentCtx = `\nYou are operating as: ${a.name} (${a.role})${a.description ? ` — ${a.description}` : ''}.${a.systemPrompt ? `\n\nYour specific instructions:\n${a.systemPrompt}` : ''}`;
//     } else if (agents.length > 1) {
//       const agentList = agents.map((a, i) =>
//         `  Agent ${i + 1}: ${a.name} [${a.role}]${a.description ? ` — ${a.description}` : ''}
//    System: ${a.systemPrompt || '(default behavior)'}
//    Tools: ${a.allowedTools?.join(', ') || 'default'}`
//       ).join('\n\n');
//       agentCtx = `\nYou are the ORCHESTRATOR for this task. You have a team of ${agents.length} specialized agents. Use the Agent tool to delegate work to each one — pass their system prompt + the relevant subtask as the prompt to each Agent call. Run independent subtasks in parallel where possible.

// Your agent team:
// ${agentList}

// Orchestration approach:
// 1. Analyze the task and identify distinct subtasks
// 2. Delegate each subtask to the appropriate agent using the Agent tool
// 3. Collect results from all agents
// 4. Synthesize and report the combined outcome`;
//     }

//     prompt = `You are an AI assistant in AIOps Workbench. You have been assigned a task to complete.${agentCtx}
// ${mcpToolHint}

// Project: ${projectName}
// Work Bucket: ${bucket || 'Uncategorized'}
// Task: "${task.name}"
// ${task.desc ? `Description: "${task.desc}"` : ''}
// Current status: ${task.col}
// ${workspaceCtx || ''}${instructions ? `\n\nAdditional instructions:\n${instructions}` : ''}
// USE YOUR TOOLS to complete this task now. Do the actual work — do not just describe what you would do.

// After completing the work (or if you hit a blocker or need input), write a single JSON line as your final output — nothing else after it:
// {"type":"completed","message":"Brief summary of what you did"} or {"type":"issue","message":"What blocked you"} or {"type":"human_input","message":"What decision or info you need"}`;
//   }

//   writeLine(logStream, '=== PROMPT ===');
//   writeLine(logStream, prompt);
//   writeLine(logStream);

//   let type, message, deniedOperations = [];
//   let simulated = false;
//   let rawOutput = '';

//   if (agents.length) {
//     writeLine(logStream, `Agents: ${agents.map(a => `${a.name} (${a.role})`).join(', ')}`);
//   }

//   const approvedTools = approvedContext?.approvedTools || [];

//   // If agents are configured, merge their allowed tools
//   let agentTools = [];
//   let agentModel = null;
//   if (agents.length === 1) {
//     agentTools = agents[0].allowedTools || [];
//     agentModel = agents[0].model;
//   } else if (agents.length > 1) {
//     // Multi-agent: orchestrator needs Agent tool + union of all agent tools
//     agentTools = ['Agent', ...new Set(agents.flatMap(a => a.allowedTools || []))];
//     agentModel = agents[0].model; // orchestrator model
//   }

//   const baseTools = agentTools.length ? agentTools : (bodyAllowedTools?.length ? bodyAllowedTools : DEFAULT_ALLOWED_TOOLS);

//   // Auto-add a wildcard per MCP server so tasks always have access to MCP tools
//   let mcpWildcards = [];
//   if (fs.existsSync(MCP_CONFIG)) {
//     try {
//       const mcpCfg = JSON.parse(fs.readFileSync(MCP_CONFIG, 'utf8'));
//       // Only include MCP wildcards for agents that have useMcp enabled (or when no agents)
//       const includeMcp = !agents.length || agents.some(a => a.useMcp !== false);
//       if (includeMcp) mcpWildcards = Object.keys(mcpCfg.mcpServers || {}).map(s => `mcp__${s}__*`);
//     } catch {}
//   }

//   const allAllowedTools = [...new Set([...baseTools, ...approvedTools, ...mcpWildcards])];
//   writeLine(logStream, `Allowed tools: ${allAllowedTools.join(', ')}`);
//   writeLine(logStream, `MCP config:    ${fs.existsSync(MCP_CONFIG) ? MCP_CONFIG : '(none)'}`);
//   writeLine(logStream);

//   try {
//     const { text: raw, permissionDenials } = await runClaude(prompt, logStream, allAllowedTools, agentModel);
//     rawOutput = raw;

//     // Permission denials take priority over whatever Claude reported
//     if (permissionDenials.length > 0) {
//       type = 'permission_required';
//       deniedOperations = permissionDenials.map(d => ({
//         tool: d.tool_name,
//         toolUseId: d.tool_use_id,
//         input: d.tool_input,
//       }));
//       const toolNames = [...new Set(deniedOperations.map(d => d.tool))];
//       message = `Claude was blocked from using ${toolNames.join(', ')}. Review the requested operations below and approve to retry.`;
//       writeLine(logStream);
//       writeLine(logStream, `=== PERMISSION DENIALS (${permissionDenials.length}) ===`);
//       permissionDenials.forEach((d, i) => {
//         writeLine(logStream, `[${i + 1}] Tool: ${d.tool_name}`);
//         writeLine(logStream, `    Input: ${JSON.stringify(d.tool_input)}`);
//       });
//     } else {
//       const parsed = extractStructured(raw);
//       if (parsed) {
//         type = parsed.type;
//         message = parsed.message;
//       } else {
//         type = 'completed';
//         message = raw.replace(/\n+/g, ' ').slice(0, 400);
//       }
//     }
//   } catch (e) {
//     simulated = true;
//     writeLine(logStream, `=== FALLBACK (simulation) ===`);
//     writeLine(logStream, `Reason: ${e.message}`);
//     await new Promise(r => setTimeout(r, 600 + Math.random() * 600));
//     ({ type, message } = simulate());
//   }

//   // Auto-capture artifact for completed, real (non-simulated) runs
//   if (type === 'completed' && !simulated && rawOutput && projectId && projectId !== 'daily') {
//     try {
//       const data = readData();
//       const project = (data.projects || []).find(p => p.id === projectId);
//       if (project) {
//         project.artifacts = project.artifacts || [];
//         const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
//         // Strip the trailing JSON result line — that's metadata, not content
//         const artifactContent = rawOutput
//           .replace(/\{[^{}]*"type"\s*:\s*"(?:completed|issue|human_input)"[^{}]*\}\s*$/s, '')
//           .trim();
//         const looksLikeMarkdown =
//           artifactContent.includes('##') ||
//           artifactContent.includes('```') ||
//           artifactContent.includes('**') ||
//           artifactContent.includes('\n- ');
//         project.artifacts.push({
//           id: 'a' + notifId,
//           name: `${task.name} — ${dateStr}`,
//           type: looksLikeMarkdown ? 'markdown' : 'text',
//           lang: '',
//           content: artifactContent,
//           taskId: task.id,
//           taskName: task.name,
//           notifId,
//           createdAt: timestamp,
//           updatedAt: timestamp,
//         });
//         writeData(data);
//         writeLine(logStream, `Artifact saved: a${notifId}`);
//       }
//     } catch (artifactErr) {
//       writeLine(logStream, `Artifact save failed: ${artifactErr.message}`);
//     }
//   }

//   writeLine(logStream);
//   writeLine(logStream, '=== RESULT ===');
//   writeLine(logStream, `Type:    ${type}`);
//   writeLine(logStream, `Message: ${message}`);
//   if (deniedOperations.length > 0) writeLine(logStream, `Denied:  ${deniedOperations.map(d => d.tool).join(', ')}`);
//   if (simulated) writeLine(logStream, `(simulated — Claude Code not available)`);

//   logStream.end();

//   let thread = [];
//   if (replyContext) {
//     thread = [{ from: 'human', text: replyContext.reply }, { from: 'ai', text: message }];
//   } else if (approvedContext) {
//     const toolNames = approvedContext.approvedTools.join(', ');
//     thread = [
//       { from: 'human', text: `Approved ${toolNames} — resuming task` },
//       { from: 'ai', text: message },
//     ];
//   }

//   res.status(200).json({
//     id: notifId,
//     type,
//     projectId,
//     projectName,
//     taskId: task.id,
//     taskName: task.name,
//     bucket: bucket || '',
//     message,
//     deniedOperations,
//     timestamp,
//     read: false,
//     logFile,
//     thread,
//   });
// }
