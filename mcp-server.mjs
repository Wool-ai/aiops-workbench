import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, 'data.json');

function read() {
  try { return JSON.parse(readFileSync(DATA_FILE, 'utf8')); }
  catch { return { projects: [], notifications: [], dailyTasks: [] }; }
}

const server = new McpServer({ name: 'aiops-workbench', version: '1.0.0' });

// ── Tools ─────────────────────────────────────────────────────────────────────

server.tool(
  'list_projects',
  'List every project with its name, bucket list, and task counts by status (todo / in-progress / in-review / done).',
  {},
  async () => {
    const { projects = [] } = read();
    if (!projects.length) return text('No projects exist yet.');
    return text(JSON.stringify(
      projects.map(p => ({
        id:      p.id,
        name:    p.name,
        buckets: p.buckets || [],
        counts:  {
          total:      p.tasks.length,
          todo:       p.tasks.filter(t => t.col === 'todo').length,
          inProgress: p.tasks.filter(t => t.col === 'inprog').length,
          inReview:   p.tasks.filter(t => t.col === 'review').length,
          done:       p.tasks.filter(t => t.col === 'done').length,
        },
      })),
      null, 2
    ));
  }
);

server.tool(
  'get_project_tasks',
  'Return every task in a specific project including name, description, status, bucket, and assignee. Call list_projects first to get project IDs.',
  { project_id: z.string().describe('The project id from list_projects.') },
  async ({ project_id }) => {
    const { projects = [] } = read();
    const project = projects.find(p => p.id === project_id);
    if (!project) return text(`No project found with id "${project_id}". Use list_projects to get valid IDs.`);
    const tasks = project.tasks.map(t => ({
      name:        t.name,
      description: t.desc || '',
      status:      t.col,
      bucket:      t.bucket || 'Uncategorized',
      assignee:    t.assignee || 'Unassigned',
      dueDate:     t.dueDate || null,
      dueTime:     t.dueTime || null,
    }));
    return text(`Project: "${project.name}" — ${tasks.length} tasks\n\n${JSON.stringify(tasks, null, 2)}`);
  }
);

server.tool(
  'search_tasks',
  'Search tasks across all projects. Filter by keyword (matches name + description), assignee, bucket, or status.',
  {
    query:    z.string().optional().describe('Keyword to match against task name or description.'),
    assignee: z.string().optional().describe('Exact assignee name.'),
    bucket:   z.string().optional().describe('Bucket name.'),
    status:   z.enum(['todo', 'inprog', 'review', 'done']).optional().describe('Task status.'),
  },
  async ({ query, assignee, bucket, status }) => {
    const { projects = [] } = read();
    const results = [];
    for (const p of projects) {
      for (const t of p.tasks) {
        const q = (query || '').toLowerCase();
        if (q && !t.name.toLowerCase().includes(q) && !(t.desc || '').toLowerCase().includes(q)) continue;
        if (assignee && t.assignee !== assignee) continue;
        if (bucket   && (t.bucket || '') !== bucket) continue;
        if (status   && t.col !== status) continue;
        results.push({ project: p.name, name: t.name, description: t.desc || '', status: t.col, bucket: t.bucket || 'Uncategorized', assignee: t.assignee || 'Unassigned' });
      }
    }
    if (!results.length) return text('No tasks matched the criteria.');
    return text(`${results.length} task(s):\n\n${JSON.stringify(results, null, 2)}`);
  }
);

server.tool(
  'get_daily_tasks',
  'Return all recurring daily tasks with their scheduled time, recurrence (weekday / weekend / both), and assignee.',
  {},
  async () => {
    const { dailyTasks = [] } = read();
    if (!dailyTasks.length) return text('No recurring daily tasks configured.');
    return text(JSON.stringify(
      dailyTasks.map(t => ({ name: t.name, description: t.desc || '', time: t.time, recurrence: t.days, assignee: t.assignee || 'Unassigned' })),
      null, 2
    ));
  }
);

server.tool(
  'get_ai_queue',
  'Return recent AI work-queue entries: completed tasks, issues, tasks needing human input, or tasks awaiting permission.',
  {
    limit:  z.number().optional().describe('Max entries to return (default 15).'),
    filter: z.enum(['completed', 'issue', 'human_input', 'permission_required']).optional().describe('Return only one notification type.'),
  },
  async ({ limit = 15, filter }) => {
    let { notifications = [] } = read();
    notifications = notifications.filter(n => n.type !== 'processing');
    if (filter) notifications = notifications.filter(n => n.type === filter);
    notifications = notifications.slice(0, limit);
    if (!notifications.length) return text(filter ? `No "${filter}" entries in the queue.` : 'AI queue is empty.');
    return text(JSON.stringify(
      notifications.map(n => ({ type: n.type, task: n.taskName, project: n.projectName, bucket: n.bucket || '', message: n.message, timestamp: n.timestamp, read: n.read })),
      null, 2
    ));
  }
);

server.tool(
  'get_reminders',
  'Return reminders, optionally filtered by status. Shows title, datetime, note, linked project/task, and done status.',
  {
    filter: z.enum(['all', 'upcoming', 'overdue', 'done']).optional().describe('Which reminders to return (default all).'),
    limit:  z.number().optional().describe('Max to return (default 20).'),
  },
  async ({ filter = 'all', limit = 20 }) => {
    const { reminders = [] } = read();
    const now = new Date();
    const filtered = reminders.filter(r => {
      if (filter === 'upcoming') return !r.done && new Date(r.datetime) >= now;
      if (filter === 'overdue')  return !r.done && new Date(r.datetime) <  now;
      if (filter === 'done')     return  r.done;
      return true;
    }).slice(0, limit);
    if (!filtered.length) return text(`No ${filter} reminders.`);
    return text(JSON.stringify(
      filtered.map(r => ({
        title:     r.title,
        datetime:  r.datetime,
        note:      r.note || '',
        done:      r.done,
        project:   r.projectId || null,
        task:      r.taskId    || null,
      })),
      null, 2
    ));
  }
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function text(str) {
  return { content: [{ type: 'text', text: str }] };
}

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
