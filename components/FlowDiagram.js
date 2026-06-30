import { useCallback, useState, useMemo } from 'react';
import { ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState, MarkerType } from '@xyflow/react';
import FlowNode from './FlowNode';
import styles from '../styles/FlowDiagram.module.css';

const nodeTypes = { flowNode: FlowNode };

function hasCycle(edges, source, target) {
  const adj = new Map();
  edges.forEach(e => {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source).push(e.target);
  });
  const visited = new Set();
  const stack = [target];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === source) return true;
    if (visited.has(node)) continue;
    visited.add(node);
    (adj.get(node) || []).forEach(n => stack.push(n));
  }
  return false;
}

function FlowCanvas({ flow, project, activeExecution, onNodesChange, onEdgesChange, onConnect }) {
  const initialNodes = useMemo(() =>
    (flow.nodes || [])
      .map((n, idx) => {
        const task = project?.tasks.find(t => t.id === n.taskId);
        if (!task) return null;
        return {
          id: n.taskId,
          type: 'flowNode',
          position: n.position?.x != null ? n.position : { x: (idx % 3) * 280 + 50, y: Math.floor(idx / 3) * 180 + 50 },
          data: { task, nodeStatus: activeExecution?.nodeStatuses?.[n.taskId] },
        };
      })
      .filter(Boolean),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flow.id, flow.nodes?.length]
  );

  const initialEdges = useMemo(() =>
    (flow.edges || []).map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed },
      animated: activeExecution?.nodeStatuses?.[e.target]?.status === 'running',
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flow.id, flow.edges?.length]
  );

  const [nodes, setNodes, handleNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, handleEdgesChange] = useEdgesState(initialEdges);

  const onNodeDragStop = useCallback((_, node) => {
    const updatedNodes = nodes.map(n =>
      n.id === node.id ? { ...n, position: node.position } : n
    );
    onNodesChange(updatedNodes.map(n => ({ taskId: n.id, position: n.position })));
  }, [nodes, onNodesChange]);

  const onConnectHandler = useCallback(connection => {
    const { source, target } = connection;
    if (hasCycle(edges, source, target)) {
      alert('Cannot connect: would create a cycle');
      return;
    }
    const newEdge = { id: `e${Date.now()}`, source, target };
    setEdges(eds => {
      const updated = addEdge(newEdge, eds);
      onConnect(updated.map(e => ({ id: e.id, source: e.source, target: e.target })));
      return updated;
    });
  }, [edges, setEdges, onConnect]);

  const onEdgesChangeHandler = useCallback(changes => {
    handleEdgesChange(changes);
    const removeIds = new Set(changes.filter(c => c.type === 'remove').map(c => c.id));
    if (removeIds.size > 0) {
      const updated = edges.filter(e => !removeIds.has(e.id));
      onEdgesChange(updated.map(e => ({ id: e.id, source: e.source, target: e.target })));
    }
  }, [edges, handleEdgesChange, onEdgesChange]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={handleNodesChange}
      onEdgesChange={onEdgesChangeHandler}
      onConnect={onConnectHandler}
      onNodeDragStop={onNodeDragStop}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      attributionPosition="bottom-left"
    >
      <Background />
      <Controls />
      <MiniMap position="bottom-right" />
    </ReactFlow>
  );
}

export default function FlowDiagram({ flow, projects, activeExecution, onNodesChange, onEdgesChange, onConnect, onAddTask }) {
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const project = projects.find(p => p.id === flow.projectId);
  const hasNodes = (flow.nodes || []).length > 0;

  return (
    <div className={styles.container}>
      {hasNodes ? (
        <FlowCanvas
          key={flow.id}
          flow={flow}
          project={project}
          activeExecution={activeExecution}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
        />
      ) : (
        <div className={styles.emptyCanvas}>
          Click "+ Add Task" to get started
        </div>
      )}

      <div className={styles.toolbar}>
        <button
          onClick={() => setShowTaskPicker(true)}
          className={styles.addTaskBtn}
          disabled={!project}
        >
          + Add Task
        </button>
      </div>

      {showTaskPicker && (
        <TaskPickerModal
          project={project}
          flow={flow}
          onClose={() => setShowTaskPicker(false)}
          onSelect={task => {
            onAddTask(task);
            setShowTaskPicker(false);
          }}
        />
      )}
    </div>
  );
}

function TaskPickerModal({ project, flow, onClose, onSelect }) {
  const existingTaskIds = new Set((flow.nodes || []).map(n => n.taskId));
  const availableTasks = (project?.tasks || []).filter(
    t => (!flow.bucket || t.bucket === flow.bucket) && !existingTaskIds.has(t.id)
  );

  const colStyle = {
    todo:   { background: 'var(--todo-bg)',   color: 'var(--todo-c)' },
    inprog: { background: 'var(--inprog-bg)', color: 'var(--inprog-c)' },
    review: { background: 'var(--review-bg)', color: 'var(--review-c)' },
    done:   { background: 'var(--done-bg)',   color: 'var(--done-c)' },
  };

  const colLabel = { todo: 'To do', inprog: 'In progress', review: 'In review', done: 'Done' };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <h3>Add Task to Flow</h3>
        {availableTasks.length === 0 ? (
          <p className={styles.noTasksMsg}>All tasks in this bucket are already in the flow.</p>
        ) : (
          <div className={styles.taskList}>
            {availableTasks.map(task => (
              <div key={task.id} className={styles.taskOption} onClick={() => onSelect(task)}>
                <span className={styles.taskName}>{task.name}</span>
                <span className={styles.taskCol} style={colStyle[task.col] || colStyle.todo}>
                  {colLabel[task.col] || task.col}
                </span>
              </div>
            ))}
          </div>
        )}
        <button onClick={onClose} className={styles.closeBtn}>Cancel</button>
      </div>
    </div>
  );
}
