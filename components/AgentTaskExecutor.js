import { useState, useEffect, useCallback } from 'react';
import {
  executeTaskWithAgent,
  queueTaskForAgent,
  getAgentTasks,
  removeAgentTask,
  processAgentQueue,
} from '../lib/agent-executor';
import styles from '../styles/AgentTaskExecutor.module.css';

export default function AgentTaskExecutor({ agentId, agentName, projectName, onTaskExecuted }) {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [taskInput, setTaskInput] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskBucket, setTaskBucket] = useState('');
  const [taskPriority, setTaskPriority] = useState('normal');
  const [autoRun, setAutoRun] = useState(false);
  const [executeMode, setExecuteMode] = useState('immediate'); // immediate or queue
  const [queueStats, setQueueStats] = useState({ pending: 0, running: 0, completed: 0, failed: 0 });

  // Load tasks on mount and periodically
  const loadTasks = useCallback(async () => {
    try {
      const data = await getAgentTasks(agentId);
      setTasks(data.tasks);
      setQueueStats(data.summary);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  }, [agentId]);

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [loadTasks]);

  const handleExecuteTask = useCallback(async () => {
    if (!taskInput.trim()) return;

    setIsLoading(true);
    try {
      if (executeMode === 'immediate') {
        // Execute immediately
        const result = await executeTaskWithAgent(
          agentId,
          taskInput,
          taskDesc,
          projectName,
          taskBucket,
          ''
        );

        // Clear input
        setTaskInput('');
        setTaskDesc('');
        setTaskBucket('');

        if (onTaskExecuted) {
          onTaskExecuted(result);
        }

        // Show success notification
        alert(`Task executed! Status: ${result.type}`);
      } else {
        // Queue for later
        await queueTaskForAgent(
          agentId,
          taskInput,
          taskDesc,
          projectName,
          taskBucket,
          '',
          taskPriority,
          autoRun
        );

        // Clear input
        setTaskInput('');
        setTaskDesc('');
        setTaskBucket('');

        // Reload tasks
        await loadTasks();
        alert('Task queued successfully!');
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [agentId, taskInput, taskDesc, taskBucket, projectName, executeMode, taskPriority, autoRun, onTaskExecuted, loadTasks]);

  const handleRemoveTask = useCallback(async (taskId) => {
    try {
      await removeAgentTask(taskId);
      await loadTasks();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  }, [loadTasks]);

  const handleProcessQueue = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await processAgentQueue(agentId, 5); // Process up to 5 tasks
      alert(`Processed ${result.processed} tasks`);
      await loadTasks();
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [agentId, loadTasks]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>{agentName} - Task Executor</h2>
        <div className={styles.stats}>
          <span className={styles.stat}>📋 {queueStats.pending} pending</span>
          <span className={styles.stat}>⚙️ {queueStats.running} running</span>
          <span className={styles.stat}>✅ {queueStats.completed} completed</span>
          <span className={styles.stat}>❌ {queueStats.failed} failed</span>
        </div>
      </div>

      <div className={styles.executor}>
        <div className={styles.inputSection}>
          <input
            type="text"
            placeholder="Task name..."
            value={taskInput}
            onChange={e => setTaskInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleExecuteTask()}
            disabled={isLoading}
            className={styles.taskInput}
          />
          <textarea
            placeholder="Task description (optional)"
            value={taskDesc}
            onChange={e => setTaskDesc(e.target.value)}
            disabled={isLoading}
            className={styles.taskDesc}
          />
          <input
            type="text"
            placeholder="Bucket (optional)"
            value={taskBucket}
            onChange={e => setTaskBucket(e.target.value)}
            disabled={isLoading}
            className={styles.taskBucket}
          />

          <div className={styles.controls}>
            <div className={styles.modeSelect}>
              <label>
                <input
                  type="radio"
                  name="mode"
                  value="immediate"
                  checked={executeMode === 'immediate'}
                  onChange={e => setExecuteMode(e.target.value)}
                  disabled={isLoading}
                />
                Execute Immediately
              </label>
              <label>
                <input
                  type="radio"
                  name="mode"
                  value="queue"
                  checked={executeMode === 'queue'}
                  onChange={e => setExecuteMode(e.target.value)}
                  disabled={isLoading}
                />
                Queue for Later
              </label>
            </div>

            {executeMode === 'queue' && (
              <div className={styles.queueOptions}>
                <select
                  value={taskPriority}
                  onChange={e => setTaskPriority(e.target.value)}
                  disabled={isLoading}
                  className={styles.prioritySelect}
                >
                  <option value="low">Low Priority</option>
                  <option value="normal">Normal Priority</option>
                  <option value="high">High Priority</option>
                </select>
                <label className={styles.autoRunCheckbox}>
                  <input
                    type="checkbox"
                    checked={autoRun}
                    onChange={e => setAutoRun(e.target.checked)}
                    disabled={isLoading}
                  />
                  Auto-run when queue processes
                </label>
              </div>
            )}
          </div>

          <div className={styles.buttonGroup}>
            <button
              onClick={handleExecuteTask}
              disabled={isLoading || !taskInput.trim()}
              className={styles.executeBtn}
            >
              {isLoading ? 'Processing...' : executeMode === 'immediate' ? '▶️ Execute' : '📎 Queue Task'}
            </button>
            {queueStats.pending > 0 && (
              <button
                onClick={handleProcessQueue}
                disabled={isLoading}
                className={styles.processBtn}
              >
                ⚡ Process Queue ({queueStats.pending})
              </button>
            )}
          </div>
        </div>

        {tasks.length > 0 && (
          <div className={styles.tasksList}>
            <h3>Queued Tasks ({tasks.length})</h3>
            <div className={styles.tasksContainer}>
              {tasks.map(task => (
                <div key={task.id} className={`${styles.taskItem} ${styles[task.status]}`}>
                  <div className={styles.taskName}>{task.taskName}</div>
                  <div className={styles.taskMeta}>
                    <span className={styles.status}>{task.status}</span>
                    <span className={styles.priority}>{task.priority}</span>
                  </div>
                  {task.taskDesc && <div className={styles.taskDesc}>{task.taskDesc}</div>}
                  <button
                    onClick={() => handleRemoveTask(task.id)}
                    disabled={isLoading}
                    className={styles.removeBtn}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
