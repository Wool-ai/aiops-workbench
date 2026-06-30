export function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function uidAgent() {
  return 'ag' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

export function uidSchedule() {
  return 's' + Date.now();
}

export function extractStructured(text) {
  // Try JSON object pattern first
  const jsonMatch = text.match(/\{[^{}]*"type"\s*:\s*"(completed|issue|human_input)"[^{}]*\}/s);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {}
  }

  // Try named capture groups
  const typeMatch = text.match(/"type"\s*:\s*"(completed|issue|human_input)"/);
  const msgMatch = text.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (typeMatch && msgMatch) {
    return {
      type: typeMatch[1],
      message: msgMatch[1].replace(/\\n/g, ' '),
    };
  }

  return null;
}

export function writeLine(stream, line = '') {
  stream.write(line + '\n');
}
