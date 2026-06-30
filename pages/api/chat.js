import { spawn } from 'child_process';
import path from 'path';

const CLAUDE_BIN   = process.env.CLAUDE_PATH || '/opt/homebrew/bin/claude';
const MCP_CONFIG   = path.join(process.cwd(), 'mcp-config.json');
const TIMEOUT_MS   = 300_000;

// All MCP tools the assistant is allowed to call — no file-system tools in chat.
const ALLOWED_TOOLS = [
  'mcp__aiops__*',
].join(',');

const SYSTEM = `You are a helpful AI assistant embedded in AIOps Workbench, a project management tool.

You have access to live workspace data through these tools:
- list_projects       — see all projects, their buckets, and task-count breakdowns
- get_project_tasks   — see every task in a project (name, description, status, bucket, assignee)
- search_tasks        — search across all projects by keyword, assignee, bucket, or status
- get_daily_tasks     — see recurring daily tasks (schedule, assignee, time)
- get_ai_queue        — see recent AI execution history (completions, issues, pending approvals)
- and others

Use tools proactively whenever the user's question involves workspace data. Be concise and conversational — this is a chat, not a report. Respond in simple markdown.`;

function buildPrompt(messages) {
  const history = messages
    .map(m => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`)
    .join('\n');
  return `${SYSTEM}\n\n${history}\nAssistant:`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { messages = [], stream = false } = req.body;
  console.log('[Chat API] Stream mode:', stream);
  if (!messages.length) return res.status(400).json({ error: 'No messages' });

  if (stream) {
    // Streaming response
    console.log('[Chat API] Starting streaming response...');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      await streamClaude(buildPrompt(messages), res);
    } catch (e) {
      console.error('[Chat API] Stream error:', e.message);
      res.write(`data: ${JSON.stringify({ t: 'error', message: e.message })}\n\n`);
      res.end();
    }
  } else {
    // Non-streaming response
    try {
      const reply = await runClaude(buildPrompt(messages));
      res.status(200).json({ reply });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
}

function streamClaude(prompt, res) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let lastSentIndex = 0;
    let streamStarted = false;

    const args = [
      '--print',
      '--output-format', 'json',
      '--mcp-config', MCP_CONFIG,
      '--allowedTools', ALLOWED_TOOLS,
    ];

    console.log('[streamClaude] Spawning Claude process...');
    const proc = spawn(CLAUDE_BIN, args, { env: { ...process.env } });

    const timer = setTimeout(() => {
      console.error('[streamClaude] Request timed out');
      proc.kill('SIGTERM');
      reject(new Error('Request timed out'));
    }, TIMEOUT_MS);

    // Stream data as it arrives
    proc.stdout.on('data', (data) => {
      const chunk = data.toString();
      console.log('[streamClaude] Received stdout chunk:', chunk.length, 'bytes');
      stdout += chunk;

      // Try to parse and extract content
      try {
        // Try to find a valid JSON object
        const jsonMatch = stdout.match(/\{[\s\S]*"result"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.result) {
            const text = parsed.result;

            // Send any new text since last update
            if (text.length > lastSentIndex) {
              const newText = text.slice(lastSentIndex);
              if (newText.trim()) {
                if (!streamStarted) {
                  streamStarted = true;
                }
                res.write(`data: ${JSON.stringify({ t: 'text', delta: newText })}\n\n`);
                lastSentIndex = text.length;
              }
            }
          }
        }
      } catch (e) {
        // JSON not complete yet, continue buffering
      }
    });

    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('close', () => {
      console.log('[streamClaude] Claude process closed. Total stdout:', stdout.length, 'bytes');
      clearTimeout(timer);
      try {
        console.log('[streamClaude] Parsing JSON response...');
        const parsed = JSON.parse(stdout);
        if (parsed.is_error) {
          console.error('[streamClaude] Claude returned error:', parsed.result);
          res.write(`data: ${JSON.stringify({ t: 'error', message: parsed.result || 'Claude error' })}\n\n`);
          res.end();
          resolve();
          return;
        }

        const fullText = (parsed.result || '').trim();
        console.log('[streamClaude] Extracted text, length:', fullText.length);

        // Stream by word with slight delay for visual effect
        if (!streamStarted && fullText) {
          const words = fullText.split(/(\s+)/); // Split on whitespace but keep it
          console.log('[streamClaude] Starting word-by-word stream. Words:', words.length);

          // Use async function to properly sequence events
          (async () => {
            for (let i = 0; i < words.length; i++) {
              console.log(`[streamClaude] Sending word ${i}/${words.length}`);
              res.write(`data: ${JSON.stringify({ t: 'text', delta: words[i] })}\n\n`);
              // Add delay between chunks (except last)
              if (i < words.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 10));
              }
            }
            // Send completion
            console.log('[streamClaude] Sending completion event');
            res.write(`data: ${JSON.stringify({ t: 'done', content: fullText })}\n\n`);
            res.end();
            resolve();
          })();
        } else if (fullText.length > lastSentIndex) {
          // Send any remaining text
          const remaining = fullText.slice(lastSentIndex);
          if (remaining.trim()) {
            const words = remaining.split(/(\s+)/);

            (async () => {
              for (let i = 0; i < words.length; i++) {
                res.write(`data: ${JSON.stringify({ t: 'text', delta: words[i] })}\n\n`);
                if (i < words.length - 1) {
                  await new Promise(resolve => setTimeout(resolve, 10));
                }
              }
              res.write(`data: ${JSON.stringify({ t: 'done', content: fullText })}\n\n`);
              res.end();
              resolve();
            })();
          } else {
            res.write(`data: ${JSON.stringify({ t: 'done', content: fullText })}\n\n`);
            res.end();
            resolve();
          }
        } else {
          res.write(`data: ${JSON.stringify({ t: 'done', content: fullText })}\n\n`);
          res.end();
          resolve();
        }
      } catch (e) {
        const text = stdout.trim();
        if (text) {
          // Stream response word by word
          const words = text.split(/(\s+)/);

          (async () => {
            for (let i = 0; i < words.length; i++) {
              res.write(`data: ${JSON.stringify({ t: 'text', delta: words[i] })}\n\n`);
              if (i < words.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 10));
              }
            }
            res.write(`data: ${JSON.stringify({ t: 'done', content: text })}\n\n`);
            res.end();
            resolve();
          })();
        } else {
          res.write(`data: ${JSON.stringify({ t: 'error', message: stderr.trim() || 'No response from Claude' })}\n\n`);
          res.end();
          reject(new Error(stderr.trim() || 'No response from Claude'));
        }
      }
    });

    proc.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });

    proc.stdin.write(prompt);
    proc.stdin.end();
  });
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
