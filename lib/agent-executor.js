/**
 * Agent Executor - Utilities for executing tasks via AI agents
 */

/**
 * Execute a task directly using an agent
 */
export async function executeTaskWithAgent(agentId, taskName, taskDesc, projectName, bucket, instructions) {
  const response = await fetch('/api/agent-execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId,
      taskName,
      taskDesc,
      projectName,
      bucket,
      instructions,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to execute task: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Add a task to an agent's execution queue
 */
export async function queueTaskForAgent(agentId, taskName, taskDesc, projectName, bucket, instructions, priority = 'normal', autoRun = false) {
  const response = await fetch('/api/agent-tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId,
      taskName,
      taskDesc,
      projectName,
      bucket,
      instructions,
      priority,
      autoRun,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to queue task: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get all tasks for an agent
 */
export async function getAgentTasks(agentId, status) {
  const params = new URLSearchParams();
  if (agentId) params.append('agentId', agentId);
  if (status) params.append('status', status);

  const response = await fetch(`/api/agent-tasks?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch tasks: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Update a task in the queue
 */
export async function updateAgentTask(taskId, status, result, logs) {
  const response = await fetch('/api/agent-tasks', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: taskId,
      status,
      result,
      logs,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update task: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Remove a task from the queue
 */
export async function removeAgentTask(taskId) {
  const response = await fetch(`/api/agent-tasks?id=${encodeURIComponent(taskId)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Failed to remove task: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Process pending tasks in an agent's queue
 */
export async function processAgentQueue(agentId, limit = 1) {
  const response = await fetch('/api/agent-process-queue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId,
      limit,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to process queue: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Execute multiple tasks concurrently with an agent
 */
export async function executeBatchTasksWithAgent(agentId, tasks, projectName) {
  return Promise.all(
    tasks.map(task =>
      executeTaskWithAgent(
        agentId,
        task.name,
        task.desc,
        projectName,
        task.bucket,
        task.instructions
      )
    )
  );
}

/**
 * Queue multiple tasks for an agent
 */
export async function queueBatchTasksForAgent(agentId, tasks, projectName, priority = 'normal', autoRun = false) {
  return Promise.all(
    tasks.map(task =>
      queueTaskForAgent(
        agentId,
        task.name,
        task.desc,
        projectName,
        task.bucket,
        task.instructions,
        priority,
        autoRun
      )
    )
  );
}
