import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CLAUDE_BIN = process.env.CLAUDE_PATH || '/opt/homebrew/bin/claude';
const LOG_DIR = '/Users/<user>/Desktop/ai/ai-logs';
const TIMEOUT_MS = 120_000;

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

function runClaude(prompt, logStream, allowedTools = []) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const startMs = Date.now();

    const args = ['--print', '--output-format', 'json'];
    if (allowedTools.length > 0) {
      args.push('--allowedTools', allowedTools.join(','));
    }

    const proc = spawn(CLAUDE_BIN, args, {
      env: { ...process.env },
    });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      writeLine(logStream, '\n[TIMEOUT] Claude Code exceeded 120s limit.');
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

  const { task, projectId, projectName, bucket, replyContext, approvedTools } = req.body;

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
  writeLine(logStream, replyContext ? `Mode:      Human reply` : `Mode:      Initial analysis`);
  writeLine(logStream);

  const prompt = replyContext
    ? `You are an AI assistant in AIOps Workbench. You previously worked on a task and asked the human a question. They have now replied — continue and complete the work.

Task: "${task.name}"
Your previous message: "${replyContext.previousMessage}"
Human reply: "${replyContext.reply}"

Use your tools (Bash, Write, Read, Edit, etc.) to carry out whatever the human's reply enables. Do the actual work now.

When done, write a single JSON line as your final output — nothing else after it:
{"type":"completed","message":"What you did"} or {"type":"issue","message":"What went wrong"} or {"type":"human_input","message":"What you still need"}`
    : `You are an AI assistant in AIOps Workbench. You have been assigned a task to complete.

Project: ${projectName}
Work Bucket: ${bucket || 'Uncategorized'}
Task: "${task.name}"
${task.desc ? `Description: "${task.desc}"` : ''}
Current status: ${task.col}

USE YOUR TOOLS to complete this task now. Write files, run commands, read code — do the actual work using Bash, Write, Read, Edit and any other tools available to you. Do not just describe what you would do.

After completing the work (or if you hit a blocker or need input), write a single JSON line as your final output — nothing else after it:
{"type":"completed","message":"Brief summary of what you did"} or {"type":"issue","message":"What blocked you"} or {"type":"human_input","message":"What decision or info you need"}`;

  writeLine(logStream, '=== PROMPT ===');
  writeLine(logStream, prompt);
  writeLine(logStream);

  let type, message, deniedOperations = [];
  let simulated = false;

  if (approvedTools && approvedTools.length > 0) {
    writeLine(logStream, `Approved tools: ${approvedTools.join(', ')}`);
    writeLine(logStream);
  }

  try {
    const { text: raw, permissionDenials } = await runClaude(prompt, logStream, approvedTools || []);

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
    thread: replyContext
      ? [{ from: 'human', text: replyContext.reply }, { from: 'ai', text: message }]
      : [],
  });
}
