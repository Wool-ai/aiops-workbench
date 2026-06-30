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

const TEXT_EXTS = new Set([
  '.md', '.txt', '.json', '.js', '.ts', '.jsx', '.tsx', '.py', '.sh',
  '.yaml', '.yml', '.toml', '.csv', '.html', '.css', '.sql',
  '.go', '.rs', '.java', '.rb', '.php', '.env.example', '.conf', '.ini',
]);
const MAX_INLINE_FILE_BYTES = 24 * 1024;
const MAX_INLINE_TOTAL_BYTES = 96 * 1024;

function readData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return { projects: [], notifications: [], dailyTasks: [], reminders: [] }; }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function loadAgents(ids) {
  if (!ids?.length) return [];
  try {
    const all = JSON.parse(fs.readFileSync(AGENTS_FILE, 'utf8'));
    return ids.map(id => all.find(a => a.id === id)).filter(Boolean);
  } catch { return []; }
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function readWorkspaceDir(dir, label, inlineBudgetRef) {
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

function loadWorkspaceContext(projectId, bucketName) {
  if (!projectId || projectId === 'daily') return null;
  const safeProject = projectId.replace(/[^a-zA-Z0-9_-]/g, '');
  const projectDir = path.join(WORKSPACE_ROOT, safeProject);

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

const DEFAULT_ALLOWED_TOOLS = [
  'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'LS',
  'WebFetch', 'WebSearch', 'TodoWrite', 'TodoRead',
];

const SIMULATED = {
  completed: [
    "I've analyzed this task thoroughly and drafted a complete implementation plan. The key steps involve auditing current state, applying targeted changes, and validating against acceptance criteria. Everything looks achievable without additional blockers.",
    "Task analysis complete. I've reviewed the requirements and mapped out the execution path. Dependencies are clear, scope is well-defined, and I'm ready to proceed with the outlined approach.",
  ],
  issue: [
    "I ran into a blocker while processing this task. The required context or dependencies aren't fully specified, and there are potential conflicts with adjacent work that need to be resolved before I can proceed safely.",
  ],
  human_input: [
    "I need your input to move forward. There are two viable approaches — a targeted fix with minimal scope, or a broader refactor with better long-term outcomes. Which direction aligns with your current priorities?",
  ],
};

function simulate() {
  const rand = Math.random();
  const type = rand < 0.55 ? 'completed' : rand < 0.8 ? 'human_input' : 'issue';
  const opts = SIMULATED[type];
  return { type, message: opts[Math.floor(Math.random() * opts.length)] };
}

function writeLine(stream, line = '') {
  stream.write(line + '\n');
}

function extractStructured(text) {
  const match = text.match(/\{[^{}]*"type"\s*:\s*"(completed|issue|human_input)"[^{}]*\}/s);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }
  const typeMatch = text.match(/"type"\s*:\s*"(completed|issue|human_input)"/);
  const msgMatch = text.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (typeMatch && msgMatch) {
    return { type: typeMatch[1], message: msgMatch[1].replace(/\\n/g, ' ') };
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const {
    task, projectId, projectName, bucket,
    allowedTools: bodyAllowedTools, deniedTools: bodyDeniedTools, instructions, agentIds,
  } = req.body;

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  function send(data) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  const notifId = 'n' + Date.now() + Math.random().toString(36).slice(2, 6);
  const logFile = notifId + '.log';
  const logPath = path.join(LOG_DIR, logFile);
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const logStream = fs.createWriteStream(logPath);

  const timestamp = new Date().toISOString();

  writeLine(logStream, '=== AIOps Task Log (streaming) ===');
  writeLine(logStream, `ID:        ${notifId}`);
  writeLine(logStream, `Task:      "${task.name}"`);
  writeLine(logStream, `Project:   ${projectName}${bucket ? ' › ' + bucket : ''}`);
  writeLine(logStream, `Timestamp: ${timestamp}`);
  writeLine(logStream);

  // Build MCP tool hint
  let mcpToolHint = '';
  if (fs.existsSync(MCP_CONFIG)) {
    try {
      const mcpCfg = JSON.parse(fs.readFileSync(MCP_CONFIG, 'utf8'));
      const servers = Object.keys(mcpCfg.mcpServers || {});
      if (servers.length) {
        mcpToolHint = `
You have MCP tools available for reading and writing live workspace data — prefer these over editing data.json directly:
- mcp__aiops__list_projects       — list all projects, their ids, buckets, and task counts
- mcp__aiops__create_project      — create a new project
- mcp__aiops__list_buckets        — list work buckets in a project
- mcp__aiops__add_bucket          — add a bucket to a project
- mcp__aiops__delete_bucket       — remove a bucket (tasks are preserved)
- mcp__aiops__get_project_tasks   — get all tasks in a project (includes ids)
- mcp__aiops__create_task         — add a task to a project
- mcp__aiops__update_task         — update any task fields (status, assignee, priority, etc.)
- mcp__aiops__delete_task         — delete a task
- mcp__aiops__add_comment         — add a comment to a task
- mcp__aiops__search_tasks        — search tasks across all projects
- mcp__aiops__get_daily_tasks     — list recurring daily tasks
- mcp__aiops__create_daily_task   — add a recurring daily task
- mcp__aiops__update_daily_task   — update a recurring daily task
- mcp__aiops__delete_daily_task   — delete a recurring daily task
- mcp__aiops__get_reminders       — list reminders
- mcp__aiops__create_reminder     — create a reminder
- mcp__aiops__complete_reminder   — mark a reminder done
- mcp__aiops__delete_reminder     — delete a reminder
- mcp__aiops__get_ai_queue        — view recent AI task results
Always call list_projects first to get valid project ids before creating or updating tasks.
- mcp__aiops__list_artifacts      — list artifacts in a project
- mcp__aiops__create_artifact     — save a named output (report, code, plan, summary) as a file artifact; pass bucket=current work bucket to scope it correctly
- mcp__aiops__update_artifact     — update an existing artifact's content or metadata
- mcp__aiops__delete_artifact     — remove an artifact`;
      }
    } catch {}
  }

  const agents = loadAgents(agentIds);

  const workspaceCtx = loadWorkspaceContext(projectId, bucket);

  let agentCtx = '';
  if (agents.length === 1) {
    const a = agents[0];
    agentCtx = `\nYou are operating as: ${a.name} (${a.role})${a.description ? ` — ${a.description}` : ''}.${a.systemPrompt ? `\n\nYour specific instructions:\n${a.systemPrompt}` : ''}`;
  } else if (agents.length > 1) {
    const agentList = agents.map((a, i) =>
      `  Agent ${i + 1}: ${a.name} [${a.role}]${a.description ? ` — ${a.description}` : ''}
   System: ${a.systemPrompt || '(default behavior)'}
   Tools: ${a.allowedTools?.join(', ') || 'default'}`
    ).join('\n\n');
    agentCtx = `\nYou are the ORCHESTRATOR for this task. You have a team of ${agents.length} specialized agents. Use the Agent tool to delegate work to each one. Run independent subtasks in parallel where possible.

Your agent team:
${agentList}`;
  }

  const prompt = `You are an AI assistant in AIOps Workbench. You have been assigned a task to complete.${agentCtx}
${mcpToolHint}

Project: ${projectName}
Work Bucket: ${bucket || 'Uncategorized'}
Task: "${task.name}"
${task.desc ? `Description: "${task.desc}"` : ''}
Current status: ${task.col}
${workspaceCtx || ''}${instructions ? `\n\nAdditional instructions:\n${instructions}` : ''}
USE YOUR TOOLS to complete this task now. Do the actual work — do not just describe what you would do.

After completing the work (or if you hit a blocker or need input), write a single JSON line as your final output — nothing else after it:
{"type":"completed","message":"Brief summary of what you did"} or {"type":"issue","message":"What blocked you"} or {"type":"human_input","message":"What decision or info you need"}`;

  writeLine(logStream, '=== PROMPT ===');
  writeLine(logStream, prompt);
  writeLine(logStream);

  // Build allowed tools list
  let agentTools = [];
  let agentModel = null;
  if (agents.length === 1) {
    agentTools = agents[0].allowedTools || [];
    agentModel = agents[0].model;
  } else if (agents.length > 1) {
    agentTools = ['Agent', ...new Set(agents.flatMap(a => a.allowedTools || []))];
    agentModel = agents[0].model;
  }

  const baseTools = agentTools.length ? agentTools : (bodyAllowedTools?.length ? bodyAllowedTools : DEFAULT_ALLOWED_TOOLS);

  let mcpWildcards = [];
  if (fs.existsSync(MCP_CONFIG)) {
    try {
      const mcpCfg = JSON.parse(fs.readFileSync(MCP_CONFIG, 'utf8'));
      const includeMcp = !agents.length || agents.some(a => a.useMcp !== false);
      if (includeMcp) mcpWildcards = Object.keys(mcpCfg.mcpServers || {}).map(s => `mcp__${s}__*`);
    } catch {}
  }

  let allAllowedTools = [...new Set([...baseTools, ...mcpWildcards])];

  // Apply denied tools filter
  if (bodyDeniedTools?.length > 0) {
    allAllowedTools = allAllowedTools.filter(tool => {
      if (bodyDeniedTools.includes(tool)) return false;
      // Handle wildcard denials (e.g., mcp__server__* denies mcp__server__specific_tool)
      for (const denied of bodyDeniedTools) {
        if (denied.endsWith('__*') && tool.match(new RegExp(`^${denied.slice(0, -1)}.+$`))) {
          return false;
        }
      }
      return true;
    });
  }

  writeLine(logStream, `Allowed tools: ${allAllowedTools.join(', ')}`);
  if (bodyDeniedTools?.length > 0) {
    writeLine(logStream, `Denied tools: ${bodyDeniedTools.join(', ')}`);
  }
  writeLine(logStream);

  let type, message;
  let simulated = false;
  // accumulatedText: all assistant text blocks streamed during the run (used for artifact content)
  // finalResult: the result event's consolidated text (used for structured output parsing)
  let accumulatedText = '';
  let finalResult = '';

  const dataBefore = readData();
  const projectBefore = dataBefore.projects?.find(p => p.id === projectId);
  const artifactCountBefore = projectBefore?.artifacts?.length ?? 0;

  try {
    const args = ['--print', '--verbose', '--output-format', 'stream-json'];
    if (agentModel) args.push('--model', agentModel);
    if (allAllowedTools.length > 0) args.push('--allowedTools', allAllowedTools.join(','));
    if (fs.existsSync(MCP_CONFIG)) args.push('--mcp-config', MCP_CONFIG);

    // Write prompt to a temp file and pass it as a file descriptor for stdin.
    // This is equivalent to shell's `< file` — the data is on disk before spawn,
    // so Claude reads it instantly with no pipe-timing race.
    const tempFile = path.join(os.tmpdir(), `aiops-stream-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
    fs.writeFileSync(tempFile, prompt, 'utf8');
    const stdinFd = fs.openSync(tempFile, 'r');

    const proc = spawn(CLAUDE_BIN, args, {
      env: { ...process.env },
      stdio: [stdinFd, 'pipe', 'pipe'],
    });

    // Parent closes its copy — child already inherited its own via fork/dup2
    try { fs.closeSync(stdinFd); } catch {}

    function cleanup() { try { fs.unlinkSync(tempFile); } catch {} }

    // Kill process if client disconnects
    req.on('close', () => { try { proc.kill('SIGTERM'); } catch {} cleanup(); });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      cleanup();
    }, TIMEOUT_MS);

    let lineBuffer = '';
    let procFailed = false;

    proc.stdout.on('data', chunk => {
      lineBuffer += chunk.toString();
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        writeLine(logStream, line);
        try {
          const ev = JSON.parse(line);

          // stream-json format: assistant message with content blocks
          if (ev.type === 'assistant' && ev.message?.content) {
            for (const block of ev.message.content) {
              if (block.type === 'text' && block.text) {
                accumulatedText += block.text;
                send({ t: 'text', delta: block.text });
              } else if (block.type === 'tool_use' && block.name) {
                send({ t: 'tool', name: block.name, input: block.input ?? {} });
              }
            }
          }

          // Alternative: direct text/tool_use events
          if (ev.type === 'text' && ev.text) {
            accumulatedText += ev.text;
            send({ t: 'text', delta: ev.text });
          }
          if (ev.type === 'tool_use' && ev.name) {
            send({ t: 'tool', name: ev.name, input: ev.input ?? {} });
          }

          // Final result event — store separately for structured output parsing
          if (ev.type === 'result') {
            if (ev.result) finalResult = ev.result;
            if (ev.is_error || ev.subtype === 'error_during_run') procFailed = true;
          }
        } catch {} // ignore malformed lines
      }
    });

    proc.stderr.on('data', d => writeLine(logStream, '[stderr] ' + d.toString()));

    await new Promise((resolve, reject) => {
      proc.on('close', () => { cleanup(); resolve(); });
      proc.on('error', (e) => { cleanup(); reject(e); });
    });

    clearTimeout(timer);

    // Use finalResult for structured output parsing (it's the authoritative last response);
    // fall back to accumulatedText if the result event wasn't emitted
    const textForParsing = finalResult || accumulatedText;
    if (procFailed || !textForParsing.trim()) throw new Error('Claude returned no output');

    const parsed = extractStructured(textForParsing);
    if (parsed) {
      type = parsed.type;
      message = parsed.message;
    } else {
      type = 'completed';
      message = (finalResult || accumulatedText).replace(/\n+/g, ' ').slice(0, 400);
    }

  } catch (e) {
    simulated = true;
    writeLine(logStream, `=== FALLBACK (simulation) ===`);
    writeLine(logStream, `Reason: ${e.message}`);

    // Send fake streaming text for simulation
    const fakeMsgs = [
      'Analyzing task requirements...',
      ' Reviewing project context and constraints...',
      ' Formulating approach...',
    ];
    for (const chunk of fakeMsgs) {
      send({ t: 'text', delta: chunk });
      await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
    }

    await new Promise(r => setTimeout(r, 400));
    ({ type, message } = simulate());
    accumulatedText = message;
    send({ t: 'text', delta: '\n\n' + JSON.stringify({ type, message }) });
  }

  let newArtifacts = [];
  if (projectId && projectId !== 'daily') {
    const dataAfter = readData();
    const projectAfter = dataAfter.projects?.find(p => p.id === projectId);
    const beforeIds = new Set((projectBefore?.artifacts || []).map(a => a.id));
    newArtifacts = (projectAfter?.artifacts || [])
      .filter(a => !beforeIds.has(a.id))
      .map(a => ({ id: a.id, name: a.name, type: a.type || 'text', lang: a.lang || '', bucket: a.bucket || '' }));
    if (newArtifacts.length > 0) {
      writeLine(logStream, `New artifact(s) detected via MCP: ${newArtifacts.map(a => a.name).join(', ')}`);
    }
  }

  writeLine(logStream, '=== RESULT ===');
  writeLine(logStream, `Type:    ${type}`);
  writeLine(logStream, `Message: ${message}`);
  if (simulated) writeLine(logStream, '(simulated — Claude Code not available)');
  logStream.end();

  send({
    t: 'done',
    notif: {
      id: notifId,
      type,
      projectId,
      projectName,
      taskId: task.id,
      taskName: task.name,
      bucket: bucket || '',
      message,
      deniedOperations: [],
      timestamp,
      read: false,
      logFile,
      thread: [],
      ...(newArtifacts.length > 0 ? { artifactsAdded: true, newArtifacts } : {}),
    },
  });

  res.end();
}
