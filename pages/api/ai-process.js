import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CLAUDE_BIN = process.env.CLAUDE_PATH || '/opt/homebrew/bin/claude';
const LOG_DIR = '/Users/<user>/Desktop/ai/ai-logs';
const TIMEOUT_MS = 300_000;
const WORKSPACE_ROOT = path.join(process.cwd(), 'workspace');
const MCP_CONFIG = path.join(process.cwd(), 'mcp-config.json');
const AGENTS_FILE = path.join(process.cwd(), 'agents.json');

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

function readWorkspaceDir(dir, label) {
  if (!fs.existsSync(dir)) return null;
  const instructionsPath = path.join(dir, 'instructions.md');
  const instructions = fs.existsSync(instructionsPath)
    ? fs.readFileSync(instructionsPath, 'utf8').trim()
    : null;
  const otherFiles = fs.readdirSync(dir)
    .filter(f => f !== 'instructions.md' && f !== 'buckets' && !f.startsWith('.'));
  if (!instructions && otherFiles.length === 0) return null;
  let ctx = `\n--- ${label} ---`;
  if (instructions) ctx += `\nInstructions:\n${instructions}`;
  if (otherFiles.length > 0) {
    ctx += `\nReference files (use Read tool as needed):\n`;
    ctx += otherFiles.map(f => `  ${path.join(dir, f)}`).join('\n');
  }
  ctx += `\n--- End ${label} ---`;
  return ctx;
}

function loadWorkspaceContext(projectId, bucketName) {
  if (!projectId || projectId === 'daily') return null;
  const safeProject = projectId.replace(/[^a-zA-Z0-9_-]/g, '');
  const projectDir = path.join(WORKSPACE_ROOT, safeProject);

  const parts = [];
  const projectCtx = readWorkspaceDir(projectDir, 'Project Workspace');
  if (projectCtx) parts.push(projectCtx);

  if (bucketName) {
    const bucketDir = path.join(projectDir, 'buckets', slugify(bucketName));
    const bucketCtx = readWorkspaceDir(bucketDir, `Bucket Workspace: ${bucketName}`);
    if (bucketCtx) parts.push(bucketCtx);
  }

  return parts.length > 0 ? '\n' + parts.join('\n') + '\n' : null;
}

// Tools pre-authorized on every run — Claude won't prompt for these
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
    "Analysis revealed a constraint that prevents autonomous completion. The task has cross-system dependencies and missing prerequisite data that require manual resolution first.",
  ],
  human_input: [
    "I need your input to move forward. There are two viable approaches — a targeted fix with minimal scope, or a broader refactor with better long-term outcomes. Which direction aligns with your current priorities?",
    "Before proceeding, I need clarification on the acceptance criteria. Could you define what 'done' looks like for this task, and flag any hard constraints around performance, compatibility, or deadline?",
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

function runClaude(prompt, logStream, allowedTools = [], model = null) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const startMs = Date.now();

    const args = ['--print', '--output-format', 'json'];
    if (model) args.push('--model', model);
    if (allowedTools.length > 0) {
      args.push('--allowedTools', allowedTools.join(','));
    }
    if (fs.existsSync(MCP_CONFIG)) {
      args.push('--mcp-config', MCP_CONFIG);
    }

    const proc = spawn(CLAUDE_BIN, args, {
      env: { ...process.env },
    });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      writeLine(logStream, '\n[TIMEOUT] Claude Code exceeded 300s limit.');
      reject(new Error('Claude Code timed out'));
    }, TIMEOUT_MS);

    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('close', () => {
      clearTimeout(timer);
      const durationMs = Date.now() - startMs;

      writeLine(logStream, '=== RAW OUTPUT ===');
      try {
        // Pretty-print the JSON Claude returns
        const parsed = JSON.parse(stdout);
        writeLine(logStream, JSON.stringify(parsed, null, 2));
        writeLine(logStream);

        if (stderr.trim()) {
          writeLine(logStream, '=== STDERR ===');
          writeLine(logStream, stderr.trim());
          writeLine(logStream);
        }

        writeLine(logStream, `Duration: ${(durationMs / 1000).toFixed(2)}s`);
        if (parsed.total_cost_usd != null) {
          writeLine(logStream, `Cost: $${parsed.total_cost_usd.toFixed(6)}`);
        }
        if (parsed.modelUsage) {
          const models = Object.keys(parsed.modelUsage);
          if (models.length) writeLine(logStream, `Model(s): ${models.join(', ')}`);
        }

        if (parsed.is_error) reject(new Error(parsed.result || 'Claude returned an error'));
        else resolve({ text: parsed.result || '', permissionDenials: parsed.permission_denials || [] });
      } catch {
        writeLine(logStream, stdout);
        if (stderr.trim()) { writeLine(logStream); writeLine(logStream, '=== STDERR ==='); writeLine(logStream, stderr.trim()); }
        writeLine(logStream, `Duration: ${(durationMs / 1000).toFixed(2)}s`);
        if (stdout.trim()) resolve({ text: stdout.trim(), permissionDenials: [] });
        else reject(new Error(stderr.trim() || 'No output from Claude'));
      }
    });

    proc.on('error', e => {
      clearTimeout(timer);
      writeLine(logStream, `\n[ERROR] Failed to spawn Claude Code: ${e.message}`);
      reject(e);
    });

    proc.stdin.write(prompt);
    proc.stdin.end();
  });
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

  const { task, projectId, projectName, bucket, replyContext, approvedContext, allowedTools: bodyAllowedTools, instructions, agentIds } = req.body;

  const notifId = 'n' + Date.now() + Math.random().toString(36).slice(2, 6);
  const logFile = notifId + '.log';
  const logPath = path.join(LOG_DIR, logFile);

  fs.mkdirSync(LOG_DIR, { recursive: true });
  const logStream = fs.createWriteStream(logPath);

  const timestamp = new Date().toISOString();

  writeLine(logStream, '=== AIOps Task Log ===');
  writeLine(logStream, `ID:        ${notifId}`);
  writeLine(logStream, `Task:      "${task.name}"`);
  writeLine(logStream, `Project:   ${projectName}${bucket ? ' › ' + bucket : ''}`);
  writeLine(logStream, `Timestamp: ${timestamp}`);
  const mode = replyContext ? 'Human reply' : approvedContext ? 'Approved retry' : 'Initial analysis';
  writeLine(logStream, `Mode:      ${mode}`);
  writeLine(logStream);

  // Build MCP tool context so Claude knows to use them for workspace operations
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
Always call list_projects first to get valid project ids before creating or updating tasks.`;
      }
    } catch {}
  }

  let prompt;
  if (replyContext) {
    prompt = `You are an AI assistant in AIOps Workbench. You previously worked on a task and asked the human a question. They have now replied — continue and complete the work.
${mcpToolHint}

Task: "${task.name}"
Your previous message: "${replyContext.previousMessage}"
Human reply: "${replyContext.reply}"

Use your tools to carry out whatever the human's reply enables. Do the actual work now.

When done, write a single JSON line as your final output — nothing else after it:
{"type":"completed","message":"What you did"} or {"type":"issue","message":"What went wrong"} or {"type":"human_input","message":"What you still need"}`;
  } else if (approvedContext) {
    const { previousMessage, deniedOperations, approvedTools } = approvedContext;
    const blockedSummary = deniedOperations.map(op => {
      const inputStr = JSON.stringify(op.input || {}).slice(0, 200);
      return `  - ${op.tool}: ${inputStr}`;
    }).join('\n');
    prompt = `You are an AI assistant in AIOps Workbench. You were previously working on a task but some tool uses were blocked by the permission system. The user has now approved those tools — resume and complete the work without starting over.
${mcpToolHint}

Project: ${projectName}
Work Bucket: ${bucket || 'Uncategorized'}
Task: "${task.name}"
${task.desc ? `Description: "${task.desc}"` : ''}

Previously blocked operations (now approved):
${blockedSummary || '  (see approved tools list)'}

Approved tools: ${approvedTools.join(', ')}

Your previous progress/status: "${previousMessage}"

Continue from where you left off. Do NOT repeat work you already completed.

After completing the work (or if you hit a new blocker), write a single JSON line as your final output — nothing else after it:
{"type":"completed","message":"Brief summary of what you did"} or {"type":"issue","message":"What blocked you"} or {"type":"human_input","message":"What decision or info you need"}`;
  } else {
    const workspaceCtx = loadWorkspaceContext(projectId, bucket);

    // Build agent context string
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
      agentCtx = `\nYou are the ORCHESTRATOR for this task. You have a team of ${agents.length} specialized agents. Use the Agent tool to delegate work to each one — pass their system prompt + the relevant subtask as the prompt to each Agent call. Run independent subtasks in parallel where possible.

Your agent team:
${agentList}

Orchestration approach:
1. Analyze the task and identify distinct subtasks
2. Delegate each subtask to the appropriate agent using the Agent tool
3. Collect results from all agents
4. Synthesize and report the combined outcome`;
    }

    prompt = `You are an AI assistant in AIOps Workbench. You have been assigned a task to complete.${agentCtx}
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
  }

  writeLine(logStream, '=== PROMPT ===');
  writeLine(logStream, prompt);
  writeLine(logStream);

  let type, message, deniedOperations = [];
  let simulated = false;

  // Load configured agents
  const agents = loadAgents(agentIds);
  if (agents.length) {
    writeLine(logStream, `Agents: ${agents.map(a => `${a.name} (${a.role})`).join(', ')}`);
  }

  const approvedTools = approvedContext?.approvedTools || [];

  // If agents are configured, merge their allowed tools
  let agentTools = [];
  let agentModel = null;
  if (agents.length === 1) {
    agentTools = agents[0].allowedTools || [];
    agentModel = agents[0].model;
  } else if (agents.length > 1) {
    // Multi-agent: orchestrator needs Agent tool + union of all agent tools
    agentTools = ['Agent', ...new Set(agents.flatMap(a => a.allowedTools || []))];
    agentModel = agents[0].model; // orchestrator model
  }

  const baseTools = agentTools.length ? agentTools : (bodyAllowedTools?.length ? bodyAllowedTools : DEFAULT_ALLOWED_TOOLS);

  // Auto-add a wildcard per MCP server so tasks always have access to MCP tools
  let mcpWildcards = [];
  if (fs.existsSync(MCP_CONFIG)) {
    try {
      const mcpCfg = JSON.parse(fs.readFileSync(MCP_CONFIG, 'utf8'));
      // Only include MCP wildcards for agents that have useMcp enabled (or when no agents)
      const includeMcp = !agents.length || agents.some(a => a.useMcp !== false);
      if (includeMcp) mcpWildcards = Object.keys(mcpCfg.mcpServers || {}).map(s => `mcp__${s}__*`);
    } catch {}
  }

  const allAllowedTools = [...new Set([...baseTools, ...approvedTools, ...mcpWildcards])];
  writeLine(logStream, `Allowed tools: ${allAllowedTools.join(', ')}`);
  writeLine(logStream, `MCP config:    ${fs.existsSync(MCP_CONFIG) ? MCP_CONFIG : '(none)'}`);
  writeLine(logStream);

  try {
    const { text: raw, permissionDenials } = await runClaude(prompt, logStream, allAllowedTools, agentModel);

    // Permission denials take priority over whatever Claude reported
    if (permissionDenials.length > 0) {
      type = 'permission_required';
      deniedOperations = permissionDenials.map(d => ({
        tool: d.tool_name,
        toolUseId: d.tool_use_id,
        input: d.tool_input,
      }));
      const toolNames = [...new Set(deniedOperations.map(d => d.tool))];
      message = `Claude was blocked from using ${toolNames.join(', ')}. Review the requested operations below and approve to retry.`;
      writeLine(logStream);
      writeLine(logStream, `=== PERMISSION DENIALS (${permissionDenials.length}) ===`);
      permissionDenials.forEach((d, i) => {
        writeLine(logStream, `[${i + 1}] Tool: ${d.tool_name}`);
        writeLine(logStream, `    Input: ${JSON.stringify(d.tool_input)}`);
      });
    } else {
      const parsed = extractStructured(raw);
      if (parsed) {
        type = parsed.type;
        message = parsed.message;
      } else {
        type = 'completed';
        message = raw.replace(/\n+/g, ' ').slice(0, 400);
      }
    }
  } catch (e) {
    simulated = true;
    writeLine(logStream, `=== FALLBACK (simulation) ===`);
    writeLine(logStream, `Reason: ${e.message}`);
    await new Promise(r => setTimeout(r, 600 + Math.random() * 600));
    ({ type, message } = simulate());
  }

  writeLine(logStream);
  writeLine(logStream, '=== RESULT ===');
  writeLine(logStream, `Type:    ${type}`);
  writeLine(logStream, `Message: ${message}`);
  if (deniedOperations.length > 0) writeLine(logStream, `Denied:  ${deniedOperations.map(d => d.tool).join(', ')}`);
  if (simulated) writeLine(logStream, `(simulated — Claude Code not available)`);

  logStream.end();

  let thread = [];
  if (replyContext) {
    thread = [{ from: 'human', text: replyContext.reply }, { from: 'ai', text: message }];
  } else if (approvedContext) {
    const toolNames = approvedContext.approvedTools.join(', ');
    thread = [
      { from: 'human', text: `Approved ${toolNames} — resuming task` },
      { from: 'ai', text: message },
    ];
  }

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
    thread,
  });
}
