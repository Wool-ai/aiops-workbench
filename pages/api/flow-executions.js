import { readData, writeData } from '../../lib/datastore.js';

function uid() {
  return 'fe' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

export default function handler(req, res) {
  const data = readData();
  if (!data.flowExecutions) data.flowExecutions = [];
  if (!data.flows) data.flows = [];

  if (req.method === 'GET') {
    const { flowId } = req.query;
    if (!flowId) return res.status(400).json({ error: 'flowId required' });

    const executions = data.flowExecutions
      .filter(fe => fe.flowId === flowId)
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

    return res.json(executions);
  }

  if (req.method === 'POST') {
    const { flowId } = req.body;
    if (!flowId) return res.status(400).json({ error: 'flowId required' });

    const flow = data.flows.find(f => f.id === flowId);
    if (!flow) return res.status(404).json({ error: 'flow not found' });

    const nodeStatuses = {};
    flow.nodes.forEach(node => {
      nodeStatuses[node.taskId] = {
        status: 'pending',
        startedAt: null,
        completedAt: null,
        note: '',
      };
    });

    const execution = {
      id: uid(),
      flowId,
      startedAt: new Date().toISOString(),
      completedAt: null,
      status: 'running',
      triggeredBy: 'manual',
      nodeStatuses,
    };

    data.flowExecutions.push(execution);
    writeData(data);
    return res.status(201).json(execution);
  }

  if (req.method === 'PUT') {
    const { id, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });

    const execIndex = data.flowExecutions.findIndex(fe => fe.id === id);
    if (execIndex === -1) return res.status(404).json({ error: 'execution not found' });

    data.flowExecutions[execIndex] = { ...data.flowExecutions[execIndex], ...updates };
    writeData(data);
    return res.json(data.flowExecutions[execIndex]);
  }

  res.status(405).end();
}
