import fs from 'fs';
import path from 'path';

const AGENT_TASKS_FILE = path.join(process.cwd(), 'agent-tasks.json');

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

async function executeTask(task) {
  try {
    // Call the agent-execute endpoint
    const response = await fetch(`http://localhost:3000/api/agent-execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: task.agentId,
        taskName: task.taskName,
        taskDesc: task.taskDesc,
        projectName: task.projectName,
        bucket: task.bucket,
        instructions: task.instructions,
      }),
    });

    if (!response.ok) {
      throw new Error(`Execution failed with status ${response.status}`);
    }

    const result = await response.json();
    return {
      success: true,
      result,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const { agentId, limit = 1 } = req.body;

  const data = loadAgentTasks();
  const allTasks = data.tasks || [];

  // Find pending tasks for this agent
  let tasksToProcess = allTasks.filter(
    t =>
      t.status === 'pending' &&
      (!agentId || t.agentId === agentId) &&
      (t.autoRun || agentId) // Either autoRun or explicitly requested by agent
  );

  // Sort by priority and creation time
  const priorityOrder = { high: 1, normal: 2, low: 3 };
  tasksToProcess.sort((a, b) => {
    const priorityDiff = (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    if (priorityDiff !== 0) return priorityDiff;
    return a.createdAt - b.createdAt;
  });

  // Process up to limit tasks
  tasksToProcess = tasksToProcess.slice(0, limit);

  const results = [];

  for (const task of tasksToProcess) {
    // Mark as running
    const taskIdx = data.tasks.findIndex(t => t.id === task.id);
    if (taskIdx !== -1) {
      data.tasks[taskIdx].status = 'running';
      data.tasks[taskIdx].updatedAt = Date.now();
      saveAgentTasks(data);
    }

    // Execute task
    const execution = await executeTask(task);

    // Update task with result
    const updatedTaskIdx = data.tasks.findIndex(t => t.id === task.id);
    if (updatedTaskIdx !== -1) {
      const taskData = data.tasks[updatedTaskIdx];
      if (execution.success) {
        taskData.status = execution.result.type === 'completed' ? 'completed' : 'failed';
        taskData.result = execution.result;
      } else {
        taskData.status = 'failed';
        taskData.result = { error: execution.error };
      }
      taskData.updatedAt = Date.now();

      // Move to history if done
      if (taskData.status === 'completed' || taskData.status === 'failed') {
        data.history = data.history || [];
        data.history.push(taskData);
        data.tasks.splice(updatedTaskIdx, 1);
      }

      saveAgentTasks(data);
    }

    results.push({
      taskId: task.id,
      status: execution.success ? 'executed' : 'failed',
      result: execution.success ? execution.result : { error: execution.error },
    });
  }

  const summary = {
    processed: results.length,
    results,
    pending: allTasks.filter(t => t.status === 'pending').length,
    running: allTasks.filter(t => t.status === 'running').length,
  };

  res.status(200).json(summary);
}
