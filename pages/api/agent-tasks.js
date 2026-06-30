import fs from 'fs';
import path from 'path';

const AGENT_TASKS_FILE = path.join(process.cwd(), 'agent-tasks.json');

function uid() {
  return 'at' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

function loadAgentTasks() {
  try {
    return JSON.parse(fs.readFileSync(AGENT_TASKS_FILE, 'utf8'));
  } catch {
    return { tasks: [], history: [] };
  }
}

function saveAgentTasks(data) {
  fs.writeFileSync(AGENT_TASKS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

export default function handler(req, res) {
  // GET: List all agent tasks or filter by agent
  if (req.method === 'GET') {
    const { agentId, status } = req.query;
    const data = loadAgentTasks();

    let tasks = data.tasks || [];

    if (agentId) {
      tasks = tasks.filter(t => t.agentId === agentId);
    }

    if (status) {
      tasks = tasks.filter(t => t.status === status);
    }

    return res.json({
      tasks: tasks.sort((a, b) => b.createdAt - a.createdAt),
      total: tasks.length,
      summary: {
        pending: tasks.filter(t => t.status === 'pending').length,
        running: tasks.filter(t => t.status === 'running').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        failed: tasks.filter(t => t.status === 'failed').length,
      },
    });
  }

  // POST: Add a new task to agent queue
  if (req.method === 'POST') {
    const {
      agentId,
      taskName,
      taskDesc = '',
      projectName,
      bucket = '',
      instructions = '',
      priority = 'normal',
      autoRun = false,
    } = req.body;

    if (!agentId || !taskName) {
      return res.status(400).json({ error: 'agentId and taskName required' });
    }

    const data = loadAgentTasks();
    const task = {
      id: uid(),
      agentId,
      taskName,
      taskDesc,
      projectName,
      bucket,
      instructions,
      priority,
      status: 'pending',
      autoRun,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      result: null,
      logs: null,
    };

    data.tasks.push(task);
    saveAgentTasks(data);

    return res.status(201).json(task);
  }

  // PUT: Update task status or result
  if (req.method === 'PUT') {
    const { id, status, result, logs } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'id required' });
    }

    const data = loadAgentTasks();
    const taskIdx = data.tasks.findIndex(t => t.id === id);

    if (taskIdx === -1) {
      return res.status(404).json({ error: 'task not found' });
    }

    const task = data.tasks[taskIdx];
    const oldStatus = task.status;

    if (status) task.status = status;
    if (result) task.result = result;
    if (logs) task.logs = logs;
    task.updatedAt = Date.now();

    // Move to history if completed/failed
    if (status === 'completed' || status === 'failed') {
      data.history = data.history || [];
      data.history.push(task);
      data.tasks.splice(taskIdx, 1);
    }

    saveAgentTasks(data);

    return res.json(task);
  }

  // DELETE: Remove task from queue
  if (req.method === 'DELETE') {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'id required' });
    }

    const data = loadAgentTasks();
    data.tasks = data.tasks.filter(t => t.id !== id);
    saveAgentTasks(data);

    return res.json({ ok: true });
  }

  res.status(405).end();
}
