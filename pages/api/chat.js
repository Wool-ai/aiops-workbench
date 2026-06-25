import { spawn } from 'child_process';
import path from 'path';

const CLAUDE_BIN   = process.env.CLAUDE_PATH || '/opt/homebrew/bin/claude';
const MCP_CONFIG   = path.join(process.cwd(), 'mcp-config.json');
const TIMEOUT_MS   = 90_000;

// All MCP tools the assistant is allowed to call — no file-system tools in chat.
const ALLOWED_TOOLS = [
  'mcp__aiops__list_projects',
  'mcp__aiops__get_project_tasks',
  'mcp__aiops__search_tasks',
  'mcp__aiops__get_daily_tasks',
  'mcp__aiops__get_ai_queue',
  'mcp__aiops__get_reminders',
].join(',');

const SYSTEM = `You are a helpful AI assistant embedded in AIOps Workbench, a project management tool.

You have access to live workspace data through these tools:
- list_projects       — see all projects, their buckets, and task-count breakdowns
- get_project_tasks   — see every task in a project (name, description, status, bucket, assignee)
- search_tasks        — search across all projects by keyword, assignee, bucket, or status
- get_daily_tasks     — see recurring daily tasks (schedule, assignee, time)
- get_ai_queue        — see recent AI execution history (completions, issues, pending approvals)

Use tools proactively whenever the user's question involves workspace data. Be concise and conversational — this is a chat, not a report. Respond in plain text; avoid markdown headers and bullet walls.`;

function buildPrompt(messages) {
  const history = messages
    .map(m => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`)
    .join('\n');
  return `${SYSTEM}\n\n${history}\nAssistant:`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { messages = [] } = req.body;
  if (!messages.length) return res.status(400).json({ error: 'No messages' });

  try {
    const reply = await runClaude(buildPrompt(messages));
    res.status(200).json({ reply });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

function runClaude(prompt) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const args = [
      '--print',
      '--output-format', 'json',
      '--mcp-config', MCP_CONFIG,
      '--allowedTools', ALLOWED_TOOLS,
    ];

    const proc = spawn(CLAUDE_BIN, args, { env: { ...process.env } });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('Request timed out'));
    }, TIMEOUT_MS);

    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('close', () => {
      clearTimeout(timer);
      try {
        const parsed = JSON.parse(stdout);
        if (parsed.is_error) return reject(new Error(parsed.result || 'Claude error'));
        resolve((parsed.result || '').trim());
      } catch {
        const text = stdout.trim();
        if (text) resolve(text);
        else reject(new Error(stderr.trim() || 'No response from Claude'));
      }
    });

    proc.on('error', e => { clearTimeout(timer); reject(e); });

    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}
