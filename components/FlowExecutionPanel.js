import { useMemo } from 'react';
import styles from '../styles/FlowExecutionPanel.module.css';
import FlowActivityFeed from './FlowActivityFeed';

function topologicalSort(nodeIds, edges) {
  const adj = new Map();
  const inDegree = new Map();
  nodeIds.forEach(id => { adj.set(id, []); inDegree.set(id, 0); });
  edges.forEach(e => {
    if (nodeIds.includes(e.source) && nodeIds.includes(e.target)) {
      adj.get(e.source).push(e.target);
      inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    }
  });
  const queue = nodeIds.filter(id => inDegree.get(id) === 0);
  const result = [];
  while (queue.length > 0) {
    const node = queue.shift();
    result.push(node);
    adj.get(node).forEach(neighbor => {
      inDegree.set(neighbor, inDegree.get(neighbor) - 1);
      if (inDegree.get(neighbor) === 0) queue.push(neighbor);
    });
  }
  return result.length === nodeIds.length ? result : nodeIds;
}

const STATUS_ICON = {
  pending:  <span className={styles.statusDot} data-s="pending">○</span>,
  running:  (
    <svg className={styles.spinIcon} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  ),
  done:     (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  skipped:  <span className={styles.statusDot} data-s="skipped">—</span>,
};

export default function FlowExecutionPanel({
  flow,
  executions,
  activeExecution,
  projects,
  isExecuting,
  isPaused,
  activeNotif,
  activeRunningTaskId,
  onStartExecution,
  onUpdateExecution,
  onSelectExecution,
  onPause,
  onResume,
}) {
  const project = projects.find(p => p.id === flow.projectId);

  const sortedNodeIds = useMemo(() => {
    if (!flow.nodes || !flow.edges) return [];
    return topologicalSort(flow.nodes.map(n => n.taskId), flow.edges);
  }, [flow.nodes, flow.edges]);

  const handleNodeStatusChange = (taskId, newStatus) => {
    if (!activeExecution) return;
    const updatedNodeStatuses = {
      ...activeExecution.nodeStatuses,
      [taskId]: {
        ...activeExecution.nodeStatuses[taskId],
        status: newStatus,
        startedAt: newStatus === 'running' ? new Date().toISOString() : activeExecution.nodeStatuses[taskId].startedAt,
        completedAt: newStatus === 'done' ? new Date().toISOString() : null,
      },
    };
    onUpdateExecution(activeExecution.id, { nodeStatuses: updatedNodeStatuses });
  };

  const handleCompleteExecution = () => {
    if (!activeExecution) return;
    onUpdateExecution(activeExecution.id, { status: 'completed', completedAt: new Date().toISOString() });
  };

  const handleAbortExecution = () => {
    if (!activeExecution) return;
    onUpdateExecution(activeExecution.id, { status: 'aborted', completedAt: new Date().toISOString() });
  };

  const getExecutionDuration = (exec) => {
    const start = new Date(exec.startedAt);
    const end = exec.completedAt ? new Date(exec.completedAt) : new Date();
    const seconds = Math.floor((end - start) / 1000);
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m`;
  };

  const getExecutionStats = (exec) => {
    const statuses = Object.values(exec.nodeStatuses || {});
    return { done: statuses.filter(s => s.status === 'done').length, total: statuses.length };
  };

  const canRun = !isExecuting && !isPaused && (!activeExecution || activeExecution.status !== 'running');

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3>Execution</h3>
        {(isExecuting || isPaused) && (
          <div className={styles.headerBadge} data-state={isPaused ? 'paused' : 'running'}>
            {isPaused ? 'Paused' : 'Running'}
          </div>
        )}
      </div>

      {/* Run / Pause / Resume controls */}
      <div className={styles.runControls}>
        {canRun && (
          <button
            onClick={() => onStartExecution(flow.id)}
            className={styles.runBtn}
            disabled={!flow.nodes || flow.nodes.length === 0}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Run Flow
          </button>
        )}
        {isExecuting && (
          <button className={styles.pauseBtn} onClick={onPause}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>
            </svg>
            Pause
          </button>
        )}
        {isPaused && (
          <button className={styles.resumeBtn} onClick={onResume}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Resume
          </button>
        )}
      </div>

      {activeExecution && (
        <div className={styles.activeExecution}>
          {/* Progress bar */}
          {(() => {
            const { done, total } = getExecutionStats(activeExecution);
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            return (
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                <span className={styles.progressLabel}>{done}/{total} tasks</span>
              </div>
            );
          })()}

          {/* Status bar */}
          <div className={styles.execStatusBar}>
            <span className={`${styles.execStatus} ${styles['status_' + activeExecution.status]}`}>
              {activeExecution.status === 'running' && isExecuting ? 'Running' :
               activeExecution.status === 'running' && isPaused ? 'Paused' :
               activeExecution.status}
            </span>
            <span className={styles.execDuration}>{getExecutionDuration(activeExecution)}</span>
          </div>

          {/* Node list */}
          <div className={styles.nodeList}>
            {sortedNodeIds.map(taskId => {
              const task = project?.tasks.find(t => t.id === taskId);
              const nodeStatus = activeExecution.nodeStatuses[taskId];
              if (!task || !nodeStatus) return null;

              const isThisRunning = nodeStatus.status === 'running' && taskId === activeRunningTaskId;

              return (
                <div key={taskId} className={styles.nodeBlock}>
                  <div className={`${styles.nodeRow} ${isThisRunning ? styles.nodeRowRunning : ''} ${nodeStatus.status === 'done' ? styles.nodeRowDone : ''}`}>
                    <span className={`${styles.nodeStatusIcon} ${styles['ns_' + nodeStatus.status]}`}>
                      {STATUS_ICON[nodeStatus.status] || STATUS_ICON.pending}
                    </span>
                    <div className={styles.nodeInfo}>
                      <span className={styles.nodeName} title={task.name}>{task.name}</span>
                      {nodeStatus.completedAt && nodeStatus.startedAt && nodeStatus.status !== 'pending' && (
                        <span className={styles.nodeTime}>
                          {Math.round((new Date(nodeStatus.completedAt) - new Date(nodeStatus.startedAt)) / 1000)}s
                        </span>
                      )}
                    </div>
                    {!isExecuting && !isPaused && nodeStatus.status !== 'done' && nodeStatus.status !== 'skipped' && (
                      <div className={styles.nodeControls}>
                        {nodeStatus.status === 'pending' && (
                          <button onClick={() => handleNodeStatusChange(taskId, 'running')} className={styles.ctrlBtn} title="Start">▶</button>
                        )}
                        {nodeStatus.status === 'running' && (
                          <button onClick={() => handleNodeStatusChange(taskId, 'done')} className={styles.ctrlBtn} title="Complete">✓</button>
                        )}
                        <button onClick={() => handleNodeStatusChange(taskId, 'skipped')} className={styles.ctrlBtn} title="Skip">—</button>
                      </div>
                    )}
                  </div>

                  {/* Inline stream log for running node */}
                  {isThisRunning && activeNotif && (
                    <div className={styles.nodeStreamLog}>
                      <FlowActivityFeed notif={activeNotif} compact />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Manual execution actions */}
          {!isExecuting && !isPaused && (
            <div className={styles.execActions}>
              <button onClick={handleCompleteExecution} className={styles.actionBtn} disabled={activeExecution.status !== 'running'}>
                Complete
              </button>
              <button onClick={handleAbortExecution} className={`${styles.actionBtn} ${styles.actionBtnDanger}`} disabled={activeExecution.status !== 'running'}>
                Abort
              </button>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {executions.length > 0 && (
        <div className={styles.history}>
          <h4>History</h4>
          <div className={styles.execList}>
            {executions.map(exec => {
              const { done, total } = getExecutionStats(exec);
              const isActive = activeExecution?.id === exec.id;
              return (
                <div
                  key={exec.id}
                  className={`${styles.execEntry} ${isActive ? styles.execEntryActive : ''}`}
                  onClick={() => onSelectExecution(exec.id)}
                >
                  <div className={styles.execEntryHeader}>
                    <span className={`${styles.execBadge} ${styles['badge_' + exec.status]}`}>
                      {exec.status === 'completed' ? (
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : exec.status === 'running' ? (
                        <svg className={styles.spinIcon} width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                      ) : exec.status === 'aborted' ? (
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      ) : null}
                      {exec.status}
                    </span>
                    <span className={styles.execTime}>{new Date(exec.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className={styles.execEntryMeta}>
                    <span className={styles.execDuration}>{getExecutionDuration(exec)}</span>
                    <div className={styles.execMiniProgress}>
                      <div className={styles.execMiniBar} style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }} />
                    </div>
                    <span className={styles.execProgress}>{done}/{total}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
