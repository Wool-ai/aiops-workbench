import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { writeLine } from './utils.js';

const CLAUDE_BIN = process.env.CLAUDE_PATH || '/opt/homebrew/bin/claude';
const DEFAULT_TIMEOUT = 300_000; // 5 minutes

export async function runClaudeProcess(options) {
  const {
    prompt,
    logStream,
    allowedTools = [],
    model = null,
    mcp_config = null,
    timeout = DEFAULT_TIMEOUT,
  } = options;

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const startMs = Date.now();

    // Write prompt to temp file for stdin
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

    const args = ['--print', '--output-format', 'json'];

    if (model) {
      args.push('--model', model);
    }

    if (allowedTools.length > 0) {
      args.push('--allowedTools', allowedTools.join(','));
    }

    if (mcp_config && fs.existsSync(mcp_config)) {
      args.push('--mcp-config', mcp_config);
    }

    const proc = spawn(CLAUDE_BIN, args, {
      env: { ...process.env },
      stdio: [stdinFd, 'pipe', 'pipe'],
    });

    try { fs.closeSync(stdinFd); } catch {}

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      cleanup();
      reject(new Error(`Claude execution timeout after ${timeout}ms`));
    }, timeout);

    proc.stdout.on('data', chunk => {
      stdout += chunk.toString();
      if (logStream) writeLine(logStream, chunk.toString());
    });

    proc.stderr.on('data', d => {
      stderr += d.toString();
      if (logStream) writeLine(logStream, '[stderr] ' + d.toString());
    });

    proc.on('close', code => {
      clearTimeout(timer);
      cleanup();

      const durationMs = Date.now() - startMs;

      if (logStream) {
        writeLine(logStream, `Exit Code: ${code}`);
        writeLine(logStream, `Duration: ${(durationMs / 1000).toFixed(2)}s`);
      }

      try {
        const parsed = JSON.parse(stdout);

        if (logStream) {
          if (parsed.total_cost_usd != null) {
            writeLine(logStream, `Cost: $${parsed.total_cost_usd.toFixed(6)}`);
          }
        }

        if (parsed.is_error) {
          reject(new Error(parsed.result || 'Claude returned an error'));
        } else {
          resolve({
            text: parsed.result || '',
            permissionDenials: parsed.permission_denials || [],
          });
        }
      } catch {
        if (logStream && stdout.trim()) {
          writeLine(logStream, stdout);
        }
        if (stderr.trim() && logStream) {
          writeLine(logStream);
          writeLine(logStream, '=== STDERR ===');
          writeLine(logStream, stderr.trim());
        }

        if (stdout.trim()) {
          resolve({
            text: stdout.trim(),
            permissionDenials: [],
          });
        } else {
          reject(new Error(stderr.trim() || 'No output from Claude'));
        }
      }
    });

    proc.on('error', e => {
      clearTimeout(timer);
      cleanup();
      if (logStream) {
        writeLine(logStream, `[ERROR] Failed to spawn Claude: ${e.message}`);
      }
      reject(e);
    });
  });
}

export async function runClaudeStream(options) {
  const {
    prompt,
    logStream,
    send,
    allowedTools = [],
    model = null,
    mcp_config = null,
    timeout = DEFAULT_TIMEOUT,
  } = options;

  const tempFile = path.join(
    os.tmpdir(),
    `aiops-stream-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`
  );

  fs.writeFileSync(tempFile, prompt, 'utf8');
  const stdinFd = fs.openSync(tempFile, 'r');

  const args = ['--print', '--verbose', '--output-format', 'stream-json'];

  if (model) args.push('--model', model);
  if (allowedTools.length > 0) args.push('--allowedTools', allowedTools.join(','));
  if (mcp_config && fs.existsSync(mcp_config)) args.push('--mcp-config', mcp_config);

  const proc = spawn(CLAUDE_BIN, args, {
    env: { ...process.env },
    stdio: [stdinFd, 'pipe', 'pipe'],
  });

  try { fs.closeSync(stdinFd); } catch {}

  function cleanup() {
    try { fs.unlinkSync(tempFile); } catch {}
  }

  // Kill process if client disconnects
  if (options.onClose) {
    options.onClose(() => {
      try { proc.kill('SIGTERM'); } catch {}
      cleanup();
    });
  }

  const timer = setTimeout(() => {
    proc.kill('SIGTERM');
    cleanup();
  }, timeout);

  let lineBuffer = '';
  let procFailed = false;
  let accumulatedText = '';
  let finalResult = '';

  return new Promise((resolve, reject) => {
    proc.stdout.on('data', chunk => {
      lineBuffer += chunk.toString();
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        if (logStream) writeLine(logStream, line);

        try {
          const ev = JSON.parse(line);

          // stream-json format: assistant message with content blocks
          if (ev.type === 'assistant' && ev.message?.content) {
            for (const block of ev.message.content) {
              if (block.type === 'text' && block.text) {
                accumulatedText += block.text;
                if (send) send({ t: 'text', delta: block.text });
              } else if (block.type === 'tool_use' && block.name) {
                if (send) send({ t: 'tool', name: block.name, input: block.input ?? {} });
              }
            }
          }

          // Alternative: direct text/tool_use events
          if (ev.type === 'text' && ev.text) {
            accumulatedText += ev.text;
            if (send) send({ t: 'text', delta: ev.text });
          }
          if (ev.type === 'tool_use' && ev.name) {
            if (send) send({ t: 'tool', name: ev.name, input: ev.input ?? {} });
          }

          // Final result event
          if (ev.type === 'result') {
            if (ev.result) finalResult = ev.result;
            if (ev.is_error || ev.subtype === 'error_during_run') procFailed = true;
          }
        } catch {} // ignore malformed lines
      }
    });

    proc.stderr.on('data', d => {
      if (logStream) writeLine(logStream, '[stderr] ' + d.toString());
    });

    proc.on('close', () => {
      clearTimeout(timer);
      cleanup();

      resolve({
        text: accumulatedText,
        finalResult,
        failed: procFailed,
      });
    });

    proc.on('error', (e) => {
      clearTimeout(timer);
      cleanup();
      if (logStream) {
        writeLine(logStream, `[ERROR] Failed to spawn Claude: ${e.message}`);
      }
      reject(e);
    });
  });
}
