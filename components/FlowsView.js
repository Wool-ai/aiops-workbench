import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import styles from '../styles/FlowsView.module.css';
import FlowExecutionPanel from './FlowExecutionPanel';
import FlowActivityFeed from './FlowActivityFeed';

const FlowDiagram = dynamic(() => import('./FlowDiagram'), { ssr: false });

function topologicalSort(nodeIds, edges) {
  const adj = new Map();
  const inDegree = new Map();
  nodeIds.forEach(id => { adj.set(id, []); inDegree.set(id, 0); });
  (edges || []).forEach(e => {
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

export default function FlowsView({ projects, notifications, onRunTaskWithAI }) {
  const [flows, setFlows] = useState([]);
  const [executions, setExecutions] = useState({});
  const [selectedFlowId, setSelectedFlowId] = useState(null);
  const [activeExecutionId, setActiveExecutionId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newFlowForm, setNewFlowForm] = useState({ name: '', projectId: '', bucket: '' });
  const [activeRunningTaskId, setActiveRunningTaskId] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [resumeState, setResumeState] = useState(null);

  const debounceTimer = useRef(null);
  const logBodyRef = useRef(null);
  const pauseRef = useRef(false);

  const selectedFlow = flows.find(f => f.id === selectedFlowId);
  const activeExecution = activeExecutionId ? executions[selectedFlowId]?.find(e => e.id === activeExecutionId) : null;
  const activeNotif = notifications?.find(n => n.taskId === activeRunningTaskId && n.type === 'processing') || null;

  useEffect(() => {
    if (logBodyRef.current) {
      logBodyRef.current.scrollTop = logBodyRef.current.scrollHeight;
    }
  }, [activeNotif?.streamText]);

  useEffect(() => {
    loadFlows();
  }, []);

  useEffect(() => {
    if (selectedFlowId) {
      loadExecutions(selectedFlowId);
    }
  }, [selectedFlowId]);

  const loadFlows = async () => {
    try {
      const res = await fetch('/api/flows');
      const data = await res.json();
      setFlows(data);
      if (!selectedFlowId && data.length > 0) {
        setSelectedFlowId(data[0].id);
      }
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to load flows:', err);
      setIsLoading(false);
    }
  };

  const loadExecutions = async flowId => {
    try {
      const res = await fetch(`/api/flow-executions?flowId=${flowId}`);
      const data = await res.json();
      setExecutions(prev => ({ ...prev, [flowId]: data }));
      if (data.length > 0 && !activeExecutionId) {
        const runningExec = data.find(e => e.status === 'running');
        setActiveExecutionId(runningExec?.id || null);
      }
    } catch (err) {
      console.error('Failed to load executions:', err);
    }
  };

  const handleCreateFlow = async () => {
    if (!newFlowForm.name || !newFlowForm.projectId) {
      alert('Name and project are required');
      return;
    }
    try {
      const res = await fetch('/api/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFlowForm),
      });
      const newFlow = await res.json();
      setFlows(prev => [...prev, newFlow]);
      setNewFlowForm({ name: '', projectId: '', bucket: '' });
      setIsCreating(false);
      setSelectedFlowId(newFlow.id);
    } catch (err) {
      console.error('Failed to create flow:', err);
      alert('Error creating flow');
    }
  };

  const handleDeleteFlow = async flowId => {
    if (!confirm('Delete this flow and all its executions?')) return;
    try {
      await fetch(`/api/flows?id=${flowId}`, { method: 'DELETE' });
      setFlows(prev => prev.filter(f => f.id !== flowId));
      setExecutions(prev => {
        const newExecs = { ...prev };
        delete newExecs[flowId];
        return newExecs;
      });
      if (selectedFlowId === flowId) {
        setSelectedFlowId(flows[0]?.id || null);
      }
    } catch (err) {
      console.error('Failed to delete flow:', err);
      alert('Error deleting flow');
    }
  };

  const debouncedSaveFlow = useCallback((updatedFlow) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/flows', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedFlow),
        });
        if (res.ok) {
          const saved = await res.json();
          setFlows(prev => prev.map(f => (f.id === saved.id ? saved : f)));
        }
      } catch (err) {
        console.error('Failed to save flow:', err);
      }
    }, 400);
  }, []);

  const handleUpdateFlowLayout = useCallback((nodes, edges) => {
    if (!selectedFlow) return;
    const updatedFlow = { ...selectedFlow, nodes, edges };
    setFlows(prev => prev.map(f => (f.id === selectedFlow.id ? updatedFlow : f)));
    debouncedSaveFlow(updatedFlow);
  }, [selectedFlow, debouncedSaveFlow]);

  const handleAddTask = async task => {
    if (!selectedFlow) return;
    const idx = selectedFlow.nodes.length;
    const newNode = {
      taskId: task.id,
      position: { x: (idx % 3) * 280 + 50, y: Math.floor(idx / 3) * 180 + 50 },
    };
    const updatedFlow = { ...selectedFlow, nodes: [...selectedFlow.nodes, newNode] };
    setFlows(prev => prev.map(f => (f.id === selectedFlow.id ? updatedFlow : f)));
    debouncedSaveFlow(updatedFlow);
  };

  const putExecution = async (exec) => {
    await fetch('/api/flow-executions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(exec),
    });
  };

  const runFlowLoop = async (flowId, execution, sorted, project, startIdx = 0) => {
    let updatedExecution = execution;
    setIsExecuting(true);
    setIsPaused(false);
    setResumeState(null);

    for (let i = startIdx; i < sorted.length; i++) {
      const taskId = sorted[i];
      const task = project.tasks.find(t => t.id === taskId);
      if (!task) continue;

      updatedExecution = {
        ...updatedExecution,
        nodeStatuses: {
          ...updatedExecution.nodeStatuses,
          [taskId]: { status: 'running', startedAt: new Date().toISOString(), completedAt: null, note: '' },
        },
      };
      await putExecution(updatedExecution);
      setExecutions(prev => ({
        ...prev,
        [flowId]: (prev[flowId] || []).map(e => e.id === execution.id ? updatedExecution : e),
      }));
      setActiveRunningTaskId(taskId);

      const notif = await onRunTaskWithAI(task, project.id);

      const nodeResult = notif?.type === 'completed' ? 'done' : 'skipped';
      updatedExecution = {
        ...updatedExecution,
        nodeStatuses: {
          ...updatedExecution.nodeStatuses,
          [taskId]: {
            status: nodeResult,
            startedAt: updatedExecution.nodeStatuses[taskId]?.startedAt,
            completedAt: new Date().toISOString(),
            note: '',
          },
        },
      };
      await putExecution(updatedExecution);
      setExecutions(prev => ({
        ...prev,
        [flowId]: (prev[flowId] || []).map(e => e.id === execution.id ? updatedExecution : e),
      }));

      // Check for pause request
      if (pauseRef.current) {
        pauseRef.current = false;
        setActiveRunningTaskId(null);
        setIsExecuting(false);
        setIsPaused(true);
        setResumeState({ flowId, execution: updatedExecution, sorted, project, startIdx: i + 1 });
        // Mark execution as paused in API
        const paused = { ...updatedExecution, status: 'running' };
        await putExecution(paused);
        return;
      }
    }

    // All tasks complete
    const completed = { ...updatedExecution, status: 'completed', completedAt: new Date().toISOString() };
    await putExecution(completed);
    setExecutions(prev => ({
      ...prev,
      [flowId]: (prev[flowId] || []).map(e => e.id === execution.id ? completed : e),
    }));
    setActiveRunningTaskId(null);
    setIsExecuting(false);
    setIsPaused(false);
    setResumeState(null);
  };

  const handleStartExecution = async flowId => {
    const flow = flows.find(f => f.id === flowId);
    const project = projects.find(p => p.id === flow?.projectId);
    if (!flow || !project || isExecuting) return;

    try {
      const res = await fetch('/api/flow-executions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flowId }),
      });
      const execution = await res.json();
      setExecutions(prev => ({ ...prev, [flowId]: [execution, ...(prev[flowId] || [])] }));
      setActiveExecutionId(execution.id);

      const nodeIds = (flow.nodes || []).map(n => n.taskId);
      const sorted = topologicalSort(nodeIds, flow.edges || []);

      await runFlowLoop(flowId, execution, sorted, project, 0);
    } catch (err) {
      console.error('Failed to run flow:', err);
      setActiveRunningTaskId(null);
      setIsExecuting(false);
    }
  };

  const handlePause = () => {
    pauseRef.current = true;
  };

  const handleResume = async () => {
    if (!resumeState) return;
    const { flowId, execution, sorted, project, startIdx } = resumeState;
    await runFlowLoop(flowId, execution, sorted, project, startIdx);
  };

  const handleUpdateExecution = async (executionId, updates) => {
    try {
      const res = await fetch('/api/flow-executions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: executionId, ...updates }),
      });
      const updated = await res.json();
      setExecutions(prev => ({
        ...prev,
        [selectedFlowId]: (prev[selectedFlowId] || []).map(e => (e.id === executionId ? updated : e)),
      }));
    } catch (err) {
      console.error('Failed to update execution:', err);
    }
  };

  if (isLoading) {
    return <div className={styles.root}>Loading...</div>;
  }

  const flowsByProject = {};
  flows.forEach(flow => {
    const project = projects.find(p => p.id === flow.projectId);
    const key = project?.name || 'Unknown';
    if (!flowsByProject[key]) flowsByProject[key] = [];
    flowsByProject[key].push(flow);
  });

  const runningTaskName = activeRunningTaskId
    ? projects.flatMap(p => p.tasks).find(t => t.id === activeRunningTaskId)?.name
    : null;

  return (
    <div className={styles.root}>
      <div className={styles.listCol}>
        <div className={styles.listHeader}>
          <h2>Flows</h2>
          <button onClick={() => setIsCreating(!isCreating)} className={styles.newFlowBtn}>+</button>
        </div>

        {isCreating && (
          <div className={styles.createForm}>
            <input
              type="text"
              placeholder="Flow name"
              value={newFlowForm.name}
              onChange={e => setNewFlowForm(prev => ({ ...prev, name: e.target.value }))}
              className={styles.input}
            />
            <select
              value={newFlowForm.projectId}
              onChange={e => setNewFlowForm(prev => ({ ...prev, projectId: e.target.value, bucket: '' }))}
              className={styles.input}
            >
              <option value="">Select project</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {newFlowForm.projectId && (
              <select
                value={newFlowForm.bucket}
                onChange={e => setNewFlowForm(prev => ({ ...prev, bucket: e.target.value }))}
                className={styles.input}
              >
                <option value="">Select bucket (optional)</option>
                {projects.find(p => p.id === newFlowForm.projectId)?.buckets.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            )}
            <div className={styles.formActions}>
              <button onClick={handleCreateFlow} className={styles.createBtn}>Create</button>
              <button onClick={() => setIsCreating(false)} className={styles.cancelBtn}>Cancel</button>
            </div>
          </div>
        )}

        <div className={styles.flowList}>
          {Object.entries(flowsByProject).map(([projectName, projectFlows]) => (
            <div key={projectName} className={styles.projectGroup}>
              <div className={styles.projectName}>{projectName}</div>
              {projectFlows.map(flow => (
                <div
                  key={flow.id}
                  className={`${styles.flowItem} ${selectedFlowId === flow.id ? styles.flowItemActive : ''}`}
                  onClick={() => setSelectedFlowId(flow.id)}
                >
                  <div className={styles.flowName}>{flow.name}</div>
                  {flow.bucket && <div className={styles.bucketTag}>{flow.bucket}</div>}
                  <div className={styles.flowMeta}>
                    <span className={styles.nodeCount}>{flow.nodes.length} tasks</span>
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteFlow(flow.id); }}
                      className={styles.deleteBtn}
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {flows.length === 0 && !isCreating && (
          <div className={styles.emptyState}>
            <p>No flows yet</p>
            <button onClick={() => setIsCreating(true)} className={styles.createFirstBtn}>Create one</button>
          </div>
        )}
      </div>

      {selectedFlow && (
        <>
          <div className={styles.diagramArea}>
            <div className={styles.diagramWrapper}>
              <FlowDiagram
                flow={selectedFlow}
                projects={projects}
                activeExecution={activeExecution}
                onNodesChange={handleUpdateFlowLayout}
                onEdgesChange={(edges) => {
                  const updatedFlow = { ...selectedFlow, edges };
                  setFlows(prev => prev.map(f => (f.id === selectedFlow.id ? updatedFlow : f)));
                  debouncedSaveFlow(updatedFlow);
                }}
                onConnect={(edges) => {
                  const updatedFlow = { ...selectedFlow, edges };
                  setFlows(prev => prev.map(f => (f.id === selectedFlow.id ? updatedFlow : f)));
                  debouncedSaveFlow(updatedFlow);
                }}
                onAddTask={handleAddTask}
              />
            </div>

            {(isExecuting || isPaused) && (
              <div className={styles.logPanel}>
                <div className={styles.logHeader}>
                  {isExecuting ? (
                    <>
                      <span className={styles.logDot} />
                      <span className={styles.logLabel}>Running</span>
                    </>
                  ) : (
                    <>
                      <span className={styles.logDotPaused} />
                      <span className={styles.logLabel}>Paused</span>
                    </>
                  )}
                  {runningTaskName && <span className={styles.logTask}>{runningTaskName}</span>}
                  <div className={styles.logHeaderActions}>
                    {isExecuting && (
                      <button className={styles.logPauseBtn} onClick={handlePause}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                          <rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>
                        </svg>
                        Pause
                      </button>
                    )}
                    {isPaused && (
                      <button className={styles.logResumeBtn} onClick={handleResume}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                        Resume
                      </button>
                    )}
                  </div>
                </div>
                <div className={styles.logBody} ref={logBodyRef}>
                  {isExecuting && activeNotif ? (
                    <FlowActivityFeed notif={activeNotif} />
                  ) : isPaused ? (
                    <div className={styles.pausedMsg}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.4 }}>
                        <rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>
                      </svg>
                      Flow paused — click Resume to continue
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          <FlowExecutionPanel
            flow={selectedFlow}
            executions={executions[selectedFlowId] || []}
            activeExecution={activeExecution}
            projects={projects}
            isExecuting={isExecuting}
            isPaused={isPaused}
            activeNotif={activeNotif}
            activeRunningTaskId={activeRunningTaskId}
            onStartExecution={handleStartExecution}
            onUpdateExecution={handleUpdateExecution}
            onSelectExecution={setActiveExecutionId}
            onPause={handlePause}
            onResume={handleResume}
          />
        </>
      )}

      {!selectedFlow && flows.length > 0 && (
        <div className={styles.detailCol} style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div className={styles.emptyDetail}>Select a flow to start</div>
        </div>
      )}
    </div>
  );
}
