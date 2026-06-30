import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, 'data.json');

const PROJECT_COLORS = [
  '#7c6df0', '#4ecb8a', '#f0c060', '#6aabff',
  '#ff7b8a', '#f0855a', '#5dcaa5', '#c084fc',
];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function read() {
  try { return JSON.parse(readFileSync(DATA_FILE, 'utf8')); }
  catch { return { projects: [], notifications: [], dailyTasks: [], reminders: [] }; }
}

function write(data) {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function text(str) {
  return { content: [{ type: 'text', text: String(str) }] };
}

const server = new McpServer({ name: 'aiops-workbench', version: '2.0.0' });

// ── Projects ──────────────────────────────────────────────────────────────────

server.tool(
  'list_projects',
  'List every project with its id, name, color, buckets, and task counts by status.',
  {},
  async () => {
    const { projects = [] } = read();
    if (!projects.length) return text('No projects exist yet.');
    return text(JSON.stringify(
      projects.map(p => ({
        id:      p.id,
        name:    p.name,
        color:   p.color,
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
  'create_project',
  'Create a new project. Returns the created project.',
  {
    name:  z.string().describe('Project name.'),
    color: z.string().optional().describe('Hex color e.g. #4ecb8a. Chosen automatically if omitted.'),
  },
  async ({ name, color }) => {
    const data = read();
    data.projects = data.projects || [];
    const usedColors = data.projects.map(p => p.color);
    const chosenColor = color || PROJECT_COLORS.find(c => !usedColors.includes(c)) || PROJECT_COLORS[data.projects.length % PROJECT_COLORS.length];
    const project = { id: 'p' + uid(), name: name.trim(), color: chosenColor, open: true, buckets: [], tasks: [] };
    data.projects.push(project);
    write(data);
    return text(`Created project "${project.name}" (id: ${project.id})`);
  }
);

// ── Buckets ───────────────────────────────────────────────────────────────────

server.tool(
  'list_buckets',
  'List all work buckets in a project.',
  { project_id: z.string().describe('Project id from list_projects.') },
  async ({ project_id }) => {
    const { projects = [] } = read();
    const project = projects.find(p => p.id === project_id);
    if (!project) return text(`No project with id "${project_id}".`);
    if (!project.buckets?.length) return text(`Project "${project.name}" has no buckets yet.`);
    return text(JSON.stringify(project.buckets));
  }
);

server.tool(
  'add_bucket',
  'Add a new work bucket to a project.',
  {
    project_id:  z.string().describe('Project id.'),
    bucket_name: z.string().describe('Name of the new bucket.'),
  },
  async ({ project_id, bucket_name }) => {
    const data = read();
    const project = data.projects?.find(p => p.id === project_id);
    if (!project) return text(`No project with id "${project_id}".`);
    project.buckets = project.buckets || [];
    const name = bucket_name.trim();
    if (project.buckets.includes(name)) return text(`Bucket "${name}" already exists in "${project.name}".`);
    project.buckets.push(name);
    write(data);
    return text(`Added bucket "${name}" to project "${project.name}".`);
  }
);

server.tool(
  'delete_bucket',
  'Remove a work bucket from a project. Tasks in this bucket are NOT deleted — their bucket field is cleared.',
  {
    project_id:  z.string().describe('Project id.'),
    bucket_name: z.string().describe('Exact bucket name to remove.'),
  },
  async ({ project_id, bucket_name }) => {
    const data = read();
    const project = data.projects?.find(p => p.id === project_id);
    if (!project) return text(`No project with id "${project_id}".`);
    const before = (project.buckets || []).length;
    project.buckets = (project.buckets || []).filter(b => b !== bucket_name);
    if (project.buckets.length === before) return text(`Bucket "${bucket_name}" not found in "${project.name}".`);
    // Clear bucket reference on tasks
    project.tasks = (project.tasks || []).map(t =>
      t.bucket === bucket_name ? { ...t, bucket: '' } : t
    );
    write(data);
    return text(`Deleted bucket "${bucket_name}" from "${project.name}".`);
  }
);

// ── Tasks ─────────────────────────────────────────────────────────────────────

server.tool(
  'get_project_tasks',
  'Return every task in a project with all fields. Call list_projects first to get project ids.',
  { project_id: z.string().describe('Project id.') },
  async ({ project_id }) => {
    const { projects = [] } = read();
    const project = projects.find(p => p.id === project_id);
    if (!project) return text(`No project with id "${project_id}".`);
    if (!project.tasks.length) return text(`Project "${project.name}" has no tasks.`);
    return text(JSON.stringify(
      project.tasks.map(t => ({
        id:       t.id,
        name:     t.name,
        desc:     t.desc || '',
        status:   t.col,
        bucket:   t.bucket || '',
        assignee: t.assignee || '',
        priority: t.priority || 'medium',
        dueDate:  t.dueDate || null,
        dueTime:  t.dueTime || null,
        comments: (t.comments || []).length,
      })),
      null, 2
    ));
  }
);

server.tool(
  'create_task',
  'Add a new task to a project. Returns the created task id.',
  {
    project_id: z.string().describe('Project id.'),
    name:       z.string().describe('Task name.'),
    desc:       z.string().optional().describe('Description or context.'),
    status:     z.enum(['todo', 'inprog', 'review', 'done']).optional().describe('Initial status (default: todo).'),
    assignee:   z.string().optional().describe('Assignee name or "AI" for AI-assigned.'),
    bucket:     z.string().optional().describe('Work bucket name (must already exist in project).'),
    priority:   z.enum(['urgent', 'high', 'medium', 'low']).optional().describe('Priority (default: medium).'),
    due_date:   z.string().optional().describe('Due date in YYYY-MM-DD format.'),
    due_time:   z.string().optional().describe('Due time in HH:MM format.'),
  },
  async ({ project_id, name, desc, status, assignee, bucket, priority, due_date, due_time }) => {
    const data = read();
    const project = data.projects?.find(p => p.id === project_id);
    if (!project) return text(`No project with id "${project_id}".`);
    if (bucket && !(project.buckets || []).includes(bucket)) {
      return text(`Bucket "${bucket}" does not exist in "${project.name}". Use add_bucket first or pick from: ${(project.buckets || []).join(', ') || 'none'}.`);
    }
    const task = {
      id:       't' + uid(),
      name:     name.trim(),
      desc:     desc?.trim() || '',
      col:      status || 'todo',
      assignee: assignee || '',
      bucket:   bucket || '',
      priority: priority || 'medium',
      dueDate:  due_date || '',
      dueTime:  due_time || '',
      comments: [],
    };
    project.tasks = project.tasks || [];
    project.tasks.push(task);
    write(data);
    return text(`Created task "${task.name}" (id: ${task.id}) in "${project.name}".`);
  }
);

server.tool(
  'update_task',
  'Update one or more fields of an existing task. Only provided fields are changed.',
  {
    project_id: z.string().describe('Project id.'),
    task_id:    z.string().describe('Task id from get_project_tasks or search_tasks.'),
    name:       z.string().optional(),
    desc:       z.string().optional(),
    status:     z.enum(['todo', 'inprog', 'review', 'done']).optional(),
    assignee:   z.string().optional().describe('Pass empty string to clear.'),
    bucket:     z.string().optional().describe('Pass empty string to clear.'),
    priority:   z.enum(['urgent', 'high', 'medium', 'low']).optional(),
    due_date:   z.string().optional().describe('YYYY-MM-DD or empty string to clear.'),
    due_time:   z.string().optional().describe('HH:MM or empty string to clear.'),
  },
  async ({ project_id, task_id, name, desc, status, assignee, bucket, priority, due_date, due_time }) => {
    const data = read();
    const project = data.projects?.find(p => p.id === project_id);
    if (!project) return text(`No project with id "${project_id}".`);
    const task = project.tasks?.find(t => t.id === task_id);
    if (!task) return text(`No task with id "${task_id}" in "${project.name}".`);
    if (bucket !== undefined && bucket !== '' && !(project.buckets || []).includes(bucket)) {
      return text(`Bucket "${bucket}" does not exist. Available: ${(project.buckets || []).join(', ') || 'none'}.`);
    }
    const before = { ...task };
    if (name     !== undefined) task.name     = name.trim();
    if (desc     !== undefined) task.desc     = desc.trim();
    if (status   !== undefined) task.col      = status;
    if (assignee !== undefined) task.assignee = assignee;
    if (bucket   !== undefined) task.bucket   = bucket;
    if (priority !== undefined) task.priority = priority;
    if (due_date !== undefined) task.dueDate  = due_date;
    if (due_time !== undefined) task.dueTime  = due_time;
    write(data);
    const changed = Object.entries({ name, desc, status, assignee, bucket, priority, due_date, due_time })
      .filter(([, v]) => v !== undefined)
      .map(([k]) => k);
    return text(`Updated task "${task.name}" — changed: ${changed.join(', ')}.`);
  }
);

server.tool(
  'delete_task',
  'Permanently delete a task from a project.',
  {
    project_id: z.string().describe('Project id.'),
    task_id:    z.string().describe('Task id.'),
  },
  async ({ project_id, task_id }) => {
    const data = read();
    const project = data.projects?.find(p => p.id === project_id);
    if (!project) return text(`No project with id "${project_id}".`);
    const before = (project.tasks || []).length;
    const task = project.tasks?.find(t => t.id === task_id);
    if (!task) return text(`No task with id "${task_id}" in "${project.name}".`);
    project.tasks = project.tasks.filter(t => t.id !== task_id);
    write(data);
    return text(`Deleted task "${task.name}" from "${project.name}".`);
  }
);

server.tool(
  'get_task_comments',
  'Return all comments on a specific task.',
  {
    project_id: z.string().describe('Project id.'),
    task_id:    z.string().describe('Task id from get_project_tasks.'),
  },
  async ({ project_id, task_id }) => {
    const { projects = [] } = read();
    const project = projects.find(p => p.id === project_id);
    if (!project) return text(`No project with id "${project_id}".`);
    const task = project.tasks?.find(t => t.id === task_id);
    if (!task) return text(`No task with id "${task_id}" in "${project.name}".`);
    const comments = task.comments || [];
    if (!comments.length) return text(`Task "${task.name}" has no comments.`);
    return text(JSON.stringify(
      comments.map((c, i) => ({ index: i, author: c.author, text: c.text, time: c.time })),
      null, 2
    ));
  }
);

server.tool(
  'add_comment',
  'Add a comment to a task. Use get_task_comments to read existing comments.',
  {
    project_id: z.string().describe('Project id.'),
    task_id:    z.string().describe('Task id.'),
    author:     z.string().describe('Comment author name.'),
    text_body:  z.string().describe('Comment text.'),
  },
  async ({ project_id, task_id, author, text_body }) => {
    const data = read();
    const project = data.projects?.find(p => p.id === project_id);
    if (!project) return text(`No project with id "${project_id}".`);
    const task = project.tasks?.find(t => t.id === task_id);
    if (!task) return text(`No task with id "${task_id}" in "${project.name}".`);
    task.comments = task.comments || [];
    const comment = { author: author.trim(), text: text_body.trim(), time: new Date().toISOString() };
    task.comments.push(comment);
    write(data);
    return text(`Added comment to "${task.name}" by ${author}. Task now has ${task.comments.length} comment(s).`);
  }
);

server.tool(
  'search_tasks',
  'Search tasks across all projects by keyword, assignee, bucket, or status.',
  {
    query:    z.string().optional().describe('Keyword to match against task name or description.'),
    assignee: z.string().optional().describe('Exact assignee name.'),
    bucket:   z.string().optional().describe('Bucket name.'),
    status:   z.enum(['todo', 'inprog', 'review', 'done']).optional().describe('Task status.'),
    priority: z.enum(['urgent', 'high', 'medium', 'low']).optional().describe('Priority filter.'),
  },
  async ({ query, assignee, bucket, status, priority }) => {
    const { projects = [] } = read();
    const results = [];
    for (const p of projects) {
      for (const t of p.tasks) {
        const q = (query || '').toLowerCase();
        if (q && !t.name.toLowerCase().includes(q) && !(t.desc || '').toLowerCase().includes(q)) continue;
        if (assignee && t.assignee !== assignee) continue;
        if (bucket   && (t.bucket || '') !== bucket) continue;
        if (status   && t.col !== status) continue;
        if (priority && (t.priority || 'medium') !== priority) continue;
        results.push({
          task_id:  t.id,
          project:  p.name,
          project_id: p.id,
          name:     t.name,
          desc:     t.desc || '',
          status:   t.col,
          bucket:   t.bucket || '',
          assignee: t.assignee || '',
          priority: t.priority || 'medium',
        });
      }
    }
    if (!results.length) return text('No tasks matched the criteria.');
    return text(`${results.length} task(s):\n\n${JSON.stringify(results, null, 2)}`);
  }
);

// ── Daily (recurring) tasks ────────────────────────────────────────────────────

server.tool(
  'get_daily_tasks',
  'Return all recurring daily tasks with their schedule and assignee.',
  {},
  async () => {
    const { dailyTasks = [] } = read();
    if (!dailyTasks.length) return text('No recurring daily tasks configured.');
    return text(JSON.stringify(
      dailyTasks.map(t => ({
        id:         t.id,
        name:       t.name,
        desc:       t.desc || '',
        time:       t.time,
        recurrence: t.days,
        assignee:   t.assignee || '',
      })),
      null, 2
    ));
  }
);

server.tool(
  'create_daily_task',
  'Add a new recurring daily task to the Daily view.',
  {
    name:       z.string().describe('Task name.'),
    desc:       z.string().optional().describe('Optional description.'),
    time:       z.string().optional().describe('Time in HH:MM format (default 09:00).'),
    recurrence: z.enum(['weekday', 'weekend', 'both']).optional().describe('Which days it recurs on (default weekday).'),
    assignee:   z.string().optional().describe('Assignee name or "AI".'),
  },
  async ({ name, desc, time, recurrence, assignee }) => {
    const data = read();
    data.dailyTasks = data.dailyTasks || [];
    const task = {
      id:       'dt' + uid(),
      name:     name.trim(),
      desc:     desc?.trim() || '',
      time:     time || '09:00',
      days:     recurrence || 'weekday',
      assignee: assignee || '',
    };
    data.dailyTasks.push(task);
    write(data);
    return text(`Created recurring task "${task.name}" (id: ${task.id}) — ${task.days} at ${task.time}.`);
  }
);

server.tool(
  'update_daily_task',
  'Update fields on an existing recurring daily task.',
  {
    task_id:    z.string().describe('Daily task id from get_daily_tasks.'),
    name:       z.string().optional(),
    desc:       z.string().optional(),
    time:       z.string().optional().describe('HH:MM format.'),
    recurrence: z.enum(['weekday', 'weekend', 'both']).optional(),
    assignee:   z.string().optional().describe('Pass empty string to clear.'),
  },
  async ({ task_id, name, desc, time, recurrence, assignee }) => {
    const data = read();
    const task = data.dailyTasks?.find(t => t.id === task_id);
    if (!task) return text(`No daily task with id "${task_id}".`);
    if (name       !== undefined) task.name     = name.trim();
    if (desc       !== undefined) task.desc     = desc.trim();
    if (time       !== undefined) task.time     = time;
    if (recurrence !== undefined) task.days     = recurrence;
    if (assignee   !== undefined) task.assignee = assignee;
    write(data);
    return text(`Updated daily task "${task.name}".`);
  }
);

server.tool(
  'delete_daily_task',
  'Delete a recurring daily task.',
  { task_id: z.string().describe('Daily task id.') },
  async ({ task_id }) => {
    const data = read();
    const task = data.dailyTasks?.find(t => t.id === task_id);
    if (!task) return text(`No daily task with id "${task_id}".`);
    data.dailyTasks = data.dailyTasks.filter(t => t.id !== task_id);
    write(data);
    return text(`Deleted daily task "${task.name}".`);
  }
);

// ── Reminders ─────────────────────────────────────────────────────────────────

server.tool(
  'get_reminders',
  'Return reminders, optionally filtered by status.',
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
        id:       r.id,
        title:    r.title,
        datetime: r.datetime,
        note:     r.note || '',
        done:     r.done,
        project:  r.projectId || null,
        task:     r.taskId    || null,
      })),
      null, 2
    ));
  }
);

server.tool(
  'create_reminder',
  'Create a new reminder with an optional link to a project or task.',
  {
    title:      z.string().describe('Reminder title.'),
    datetime:   z.string().describe('ISO 8601 datetime string e.g. 2026-07-01T09:00:00.'),
    note:       z.string().optional().describe('Optional longer note.'),
    project_id: z.string().optional().describe('Link to a project (use list_projects to get ids).'),
    task_id:    z.string().optional().describe('Link to a specific task.'),
  },
  async ({ title, datetime, note, project_id, task_id }) => {
    const data = read();
    data.reminders = data.reminders || [];
    const reminder = {
      id:        'r' + uid(),
      title:     title.trim(),
      datetime,
      note:      note?.trim() || '',
      projectId: project_id || '',
      taskId:    task_id    || '',
      done:      false,
    };
    data.reminders.push(reminder);
    write(data);
    return text(`Created reminder "${reminder.title}" (id: ${reminder.id}) for ${datetime}.`);
  }
);

server.tool(
  'complete_reminder',
  'Mark a reminder as done.',
  { reminder_id: z.string().describe('Reminder id from get_reminders.') },
  async ({ reminder_id }) => {
    const data = read();
    const reminder = data.reminders?.find(r => r.id === reminder_id);
    if (!reminder) return text(`No reminder with id "${reminder_id}".`);
    reminder.done = true;
    write(data);
    return text(`Marked reminder "${reminder.title}" as done.`);
  }
);

server.tool(
  'delete_reminder',
  'Permanently delete a reminder.',
  { reminder_id: z.string().describe('Reminder id.') },
  async ({ reminder_id }) => {
    const data = read();
    const reminder = data.reminders?.find(r => r.id === reminder_id);
    if (!reminder) return text(`No reminder with id "${reminder_id}".`);
    data.reminders = data.reminders.filter(r => r.id !== reminder_id);
    write(data);
    return text(`Deleted reminder "${reminder.title}".`);
  }
);

// ── AI queue ──────────────────────────────────────────────────────────────────

server.tool(
  'get_ai_queue',
  'Return recent AI work-queue entries. Filter by type if needed.',
  {
    limit:  z.number().optional().describe('Max entries to return (default 15).'),
    filter: z.enum(['completed', 'issue', 'human_input', 'permission_required']).optional(),
  },
  async ({ limit = 15, filter }) => {
    let { notifications = [] } = read();
    notifications = notifications.filter(n => n.type !== 'processing');
    if (filter) notifications = notifications.filter(n => n.type === filter);
    notifications = notifications.slice(0, limit);
    if (!notifications.length) return text(filter ? `No "${filter}" entries.` : 'AI queue is empty.');
    return text(JSON.stringify(
      notifications.map(n => ({
        id:        n.id,
        type:      n.type,
        task:      n.taskName,
        project:   n.projectName,
        bucket:    n.bucket || '',
        message:   n.message,
        timestamp: n.timestamp,
        read:      n.read,
      })),
      null, 2
    ));
  }
);

// ── Artifact filesystem helpers ───────────────────────────────────────────────

const WORKSPACE_ROOT = join(__dirname, 'workspace');

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function artifactExt(type, lang) {
  if (type === 'json') return '.json';
  if (type === 'markdown') return '.md';
  if (type === 'code' && lang) {
    const map = {
      python: '.py', py: '.py', typescript: '.ts', ts: '.ts',
      javascript: '.js', js: '.js', rust: '.rs', go: '.go',
      java: '.java', css: '.css', html: '.html',
      bash: '.sh', shell: '.sh', sh: '.sh', sql: '.sql',
      yaml: '.yaml', yml: '.yaml', ruby: '.rb', php: '.php',
      swift: '.swift', kotlin: '.kt', c: '.c', cpp: '.cpp', cs: '.cs',
    };
    return map[lang.toLowerCase()] || `.${lang.toLowerCase()}`;
  }
  return '.txt';
}

function sanitizeArtifactName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

function artifactDir(projectId, bucket) {
  const safeProject = projectId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (bucket) {
    return join(WORKSPACE_ROOT, safeProject, 'buckets', slugify(bucket), 'artifacts');
  }
  return join(WORKSPACE_ROOT, safeProject, 'uncategorized', 'artifacts');
}

function writeArtifactFile(projectId, bucket, id, name, type, lang, content) {
  const dir = artifactDir(projectId, bucket);
  mkdirSync(dir, { recursive: true });
  const filename = id + '--' + sanitizeArtifactName(name) + artifactExt(type, lang);
  const fullPath = join(dir, filename);
  writeFileSync(fullPath, content, 'utf8');
  // Return path relative to __dirname (app root)
  return fullPath.startsWith(__dirname + '/')
    ? fullPath.slice(__dirname.length + 1)
    : fullPath;
}

function readArtifactContent(filePath) {
  if (!filePath) return '';
  const fullPath = filePath.startsWith('/') ? filePath : join(__dirname, filePath);
  try { return readFileSync(fullPath, 'utf8'); }
  catch { return ''; }
}

function deleteArtifactFile(filePath) {
  if (!filePath) return;
  const fullPath = filePath.startsWith('/') ? filePath : join(__dirname, filePath);
  try { unlinkSync(fullPath); } catch {}
}

// ── Artifacts ─────────────────────────────────────────────────────────────────

server.tool(
  'list_artifacts',
  'List all artifacts in a project workspace. Artifacts are named outputs (text, code, markdown, JSON) produced during project work.',
  { project_id: z.string().describe('Project id from list_projects.') },
  async ({ project_id }) => {
    const { projects = [] } = read();
    const project = projects.find(p => p.id === project_id);
    if (!project) return text(`No project with id "${project_id}".`);
    const artifacts = project.artifacts || [];
    if (!artifacts.length) return text(`Project "${project.name}" has no artifacts yet.`);
    return text(JSON.stringify(
      artifacts.map(a => {
        const content = a.filePath ? readArtifactContent(a.filePath) : (a.content || '');
        return {
          id:        a.id,
          name:      a.name,
          type:      a.type,
          lang:      a.lang || '',
          bucket:    a.bucket || '',
          filePath:  a.filePath || '',
          preview:   content.slice(0, 120) + (content.length > 120 ? '…' : ''),
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
        };
      }),
      null, 2
    ));
  }
);

server.tool(
  'create_artifact',
  'Create a new artifact in a project. Use this to save generated outputs — reports, code, plans, summaries, etc. The content is stored as a file in the project workspace.',
  {
    project_id: z.string().describe('Project id.'),
    name:       z.string().describe('Artifact name, e.g. "Architecture Plan" or "setup.py".'),
    type:       z.enum(['text', 'markdown', 'code', 'json']).describe('Artifact type.'),
    content:    z.string().describe('The full content of the artifact.'),
    lang:       z.string().optional().describe('Programming language for code artifacts, e.g. "python", "typescript".'),
    bucket:     z.string().optional().describe('Work bucket name to scope the artifact under (e.g. the current task bucket). Omit for project-level artifacts.'),
  },
  async ({ project_id, name, type, content, lang, bucket }) => {
    const data = read();
    const project = data.projects?.find(p => p.id === project_id);
    if (!project) return text(`No project with id "${project_id}".`);
    project.artifacts = project.artifacts || [];
    const id = 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const filePath = writeArtifactFile(project_id, bucket || '', id, name.trim(), type, lang || '', content);
    const artifact = {
      id,
      name:      name.trim(),
      type,
      lang:      lang || '',
      bucket:    bucket || '',
      filePath,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    project.artifacts.push(artifact);
    write(data);
    return text(`Created artifact "${artifact.name}" (id: ${artifact.id}) in "${project.name}" at ${filePath}.`);
  }
);

server.tool(
  'update_artifact',
  'Update an existing artifact — change its name, type, language, or replace its content.',
  {
    project_id:  z.string().describe('Project id.'),
    artifact_id: z.string().describe('Artifact id from list_artifacts.'),
    name:        z.string().optional().describe('New name.'),
    type:        z.enum(['text', 'markdown', 'code', 'json']).optional(),
    lang:        z.string().optional().describe('Programming language (for code type).'),
    content:     z.string().optional().describe('Full replacement content.'),
  },
  async ({ project_id, artifact_id, name, type, lang, content }) => {
    const data = read();
    const project = data.projects?.find(p => p.id === project_id);
    if (!project) return text(`No project with id "${project_id}".`);
    const artifact = (project.artifacts || []).find(a => a.id === artifact_id);
    if (!artifact) return text(`No artifact with id "${artifact_id}" in "${project.name}".`);

    const newName    = name    !== undefined ? name.trim()  : artifact.name;
    const newType    = type    !== undefined ? type         : artifact.type;
    const newLang    = lang    !== undefined ? lang         : artifact.lang;
    const newContent = content !== undefined ? content      : readArtifactContent(artifact.filePath);

    deleteArtifactFile(artifact.filePath);
    const filePath = writeArtifactFile(project_id, artifact.bucket || '', artifact.id, newName, newType, newLang, newContent);

    artifact.name      = newName;
    artifact.type      = newType;
    artifact.lang      = newLang;
    artifact.filePath  = filePath;
    artifact.updatedAt = new Date().toISOString();
    write(data);
    return text(`Updated artifact "${artifact.name}" at ${filePath}.`);
  }
);

server.tool(
  'delete_artifact',
  'Permanently delete an artifact from a project.',
  {
    project_id:  z.string().describe('Project id.'),
    artifact_id: z.string().describe('Artifact id from list_artifacts.'),
  },
  async ({ project_id, artifact_id }) => {
    const data = read();
    const project = data.projects?.find(p => p.id === project_id);
    if (!project) return text(`No project with id "${project_id}".`);
    const artifact = (project.artifacts || []).find(a => a.id === artifact_id);
    if (!artifact) return text(`No artifact with id "${artifact_id}".`);
    deleteArtifactFile(artifact.filePath);
    project.artifacts = project.artifacts.filter(a => a.id !== artifact_id);
    write(data);
    return text(`Deleted artifact "${artifact.name}" from "${project.name}".`);
  }
);

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
