import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { readData, writeData, readAgents, DATA_PATHS } from '../../lib/datastore.js';
import { runClaudeProcess } from '../../lib/claude-executor.js';
import { writeLine } from '../../lib/utils.js';
import { loadWorkspaceContext } from '../../lib/workspace.js';

const CLAUDE_BIN = process.env.CLAUDE_PATH || '/opt/homebrew/bin/claude';
const LOG_DIR = '/Users/<user>/Desktop/ai/ai-logs';
const WORKSPACE_ROOT = path.join(process.cwd(), 'workspace');
const MCP_CONFIG = path.join(process.cwd(), 'mcp-config.json');
const DATA_FILE = DATA_PATHS.DATA_FILE;
const AGENTS_FILE = DATA_PATHS.AGENTS_FILE;
const TIMEOUT_MS = 300000;

const DEFAULT_ALLOWED_TOOLS = [
  'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'LS',
  'WebFetch', 'WebSearch', 'TodoWrite', 'TodoRead',
];

function loadAgents(ids) {
  if (!ids?.length) return [];
  const all = readAgents();
  return ids.map(id => all.find(a => a.id === id)).filter(Boolean);
}

function getAgentById(agentId) {
  const all = readAgents();
  return all.find(a => a.id === agentId) || null;
}

// Helper functions now imported from lib/utils.js and lib/workspace.js

function runClaude(prompt, logStream, allowedTools = [], model = null) {
  return new Promise((resolve, reject) => {
    let finalResult = '';
    let stderr = '';

    const startMs = Date.now();

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

    const args = ['--print', '--verbose', '--output-format', 'stream-json'];

    if (model) {
      args.push('--model', model);
    }

    if (allowedTools.length > 0) {
      args.push('--allowedTools', allowedTools.join(','));
    }

    if (fs.existsSync(MCP_CONFIG)) {
      args.push('--mcp-config', MCP_CONFIG);
    }

    const proc = spawn(CLAUDE_BIN, args, {
      env: { ...process.env },
      stdio: [stdinFd, 'pipe', 'pipe'],
    });

    try { fs.closeSync(stdinFd); } catch {}

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      cleanup();
      writeLine(logStream, '\n[TIMEOUT] Claude Code exceeded 300s limit.');
      reject(new Error('Claude Code timed out'));
    }, TIMEOUT_MS);

    let lineBuffer = '';
    let procFailed = false;
    let permissionDenials = [];

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
              if (block.type === 'tool_use' && block.name) {
                writeLine(logStream, `[tool] ${block.name} ${JSON.stringify(block.input ?? {}).slice(0, 300)}`);
              }
            }
          }

          // Final result event — store for structured output parsing
          if (ev.type === 'result') {
            if (ev.result) finalResult = ev.result;
            if (ev.is_error || ev.subtype === 'error_during_run') procFailed = true;
          }

          // Capture permission denials (snake_case in JSON)
          if (ev.permission_denials && Array.isArray(ev.permission_denials)) {
            permissionDenials = ev.permission_denials;
          }
        } catch {} // ignore malformed lines
      }
    });

    proc.stderr.on('data', d => {
      stderr += d.toString();
    });

    proc.on('close', code => {
      clearTimeout(timer);
      cleanup();

      const durationMs = Date.now() - startMs;

      writeLine(logStream, `Duration: ${durationMs}ms`);

      if (procFailed || !finalResult.trim()) {
        reject(new Error('Claude returned no output'));
        return;
      }

      resolve({ text: finalResult, permissionDenials });
    });
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

function findTaskInProject(data, projectName, taskName) {
  const project = data.projects?.find(p => p.name === projectName);
  if (!project) return null;
  return (project.tasks || []).find(t => t.name === taskName) || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const { agentId, taskName, taskDesc, projectName, bucket, instructions } = req.body;

  if (!agentId || !taskName) {
    return res.status(400).json({ error: 'agentId and taskName are required' });
  }

  const agent = getAgentById(agentId);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  const notifId = 'n' + Date.now() + Math.random().toString(36).slice(2, 6);
  const logFile = notifId + '.log';
  const logPath = path.join(LOG_DIR, logFile);

  fs.mkdirSync(LOG_DIR, { recursive: true });
  const logStream = fs.createWriteStream(logPath);

  const timestamp = new Date().toISOString();

  writeLine(logStream, '=== AIOps Agent Task Execution ===');
  writeLine(logStream, `ID: ${notifId}`);
  writeLine(logStream, `Agent: ${agent.name} (${agent.role})`);
  writeLine(logStream, `Task: "${taskName}"`);
  writeLine(logStream, `Project: ${projectName}${bucket ? ' › ' + bucket : ''}`);
  writeLine(logStream, `Timestamp: ${timestamp}`);
  writeLine(logStream);

  // Load current task state from data
  let existingTask = null;
  try {
    const data = readData();
    existingTask = findTaskInProject(data, projectName, taskName);
  } catch {}

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

  // Build agent-specific prompt with agent's role and system prompt
  let prompt = '';

  if (agent.systemPrompt) {
    prompt += agent.systemPrompt + '\n\n';
  }

  prompt += `${mcpToolHint}

You are ${agent.name}, an AI agent with role: ${agent.role}.

Project: ${projectName}
Bucket: ${bucket || 'Uncategorized'}
Task: "${taskName}"
${taskDesc ? `Description: "${taskDesc}"` : ''}

${existingTask ? `
Current Status: ${existingTask.col}
Current Comments: ${existingTask.comments?.length || 0} comment(s)
${existingTask.priority ? `Priority: ${existingTask.priority}` : ''}
${existingTask.assignee ? `Assigned to: ${existingTask.assignee}` : ''}
` : ''}

${instructions ? `\nAdditional instructions:\n${instructions}` : ''}

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
  let simulated = false;
  let rawOutput = '';

  // Determine allowed tools
  const agentTools = agent.allowedTools || [];
  const baseTools = agentTools.length ? agentTools : DEFAULT_ALLOWED_TOOLS;

  let mcpWildcards = [];
  if (fs.existsSync(MCP_CONFIG)) {
    try {
      const mcpCfg = JSON.parse(fs.readFileSync(MCP_CONFIG, 'utf8'));
      if (agent.useMcp !== false) {
        mcpWildcards = Object.keys(mcpCfg.mcpServers || {}).map(s => `mcp__${s}__*`);
      }
    } catch {}
  }

  const allAllowedTools = [...new Set([...baseTools, ...mcpWildcards])];

  writeLine(logStream, `Allowed tools: ${allAllowedTools.join(', ')}`);
  writeLine(logStream, `Model: ${agent.model || 'default'}`);
  writeLine(logStream);

  try {
    const { text: raw, permissionDenials } = await runClaude(
      prompt,
      logStream,
      allAllowedTools,
      agent.model
    );

    rawOutput = raw;

    if (permissionDenials.length > 0) {
      type = 'permission_required';
      message = `Agent was blocked from using tools`;
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
    writeLine(logStream, '=== ERROR ===');
    writeLine(logStream, e.message);
    type = 'issue';
    message = `Agent execution failed: ${e.message}`;
  }

  writeLine(logStream);
  writeLine(logStream, '=== RESULT ===');
  writeLine(logStream, `Type: ${type}`);
  writeLine(logStream, `Message: ${message}`);

  if (simulated) {
    writeLine(logStream, '(execution failed)');
  }

  logStream.end();

  res.status(200).json({
    id: notifId,
    type,
    agentId,
    agentName: agent.name,
    agentRole: agent.role,
    taskName,
    projectName,
    bucket: bucket || '',
    message,
    timestamp,
    logFile,
  });
}
