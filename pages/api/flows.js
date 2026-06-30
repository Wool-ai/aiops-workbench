import { readData, writeData } from '../../lib/datastore.js';

function uid() {
  return 'fl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

function purgeOrphanNodes(flow, projectId, projects) {
  const project = projects.find(p => p.id === projectId);
  if (!project) return flow;

  const validTaskIds = new Set(project.tasks.map(t => t.id));
  const validNodeTaskIds = new Set(flow.nodes.map(n => n.taskId).filter(id => validTaskIds.has(id)));

  return {
    ...flow,
    nodes: flow.nodes.filter(n => validNodeTaskIds.has(n.taskId)),
    edges: flow.edges.filter(e => validNodeTaskIds.has(e.source) && validNodeTaskIds.has(e.target)),
  };
}

export default function handler(req, res) {
  const data = readData();
  if (!data.flows) data.flows = [];
  if (!data.flowExecutions) data.flowExecutions = [];

  if (req.method === 'GET') {
    const { projectId } = req.query;
    const flows = projectId
      ? data.flows.filter(f => f.projectId === projectId)
      : data.flows;
    return res.json(flows);
  }

  if (req.method === 'POST') {
    const { name, projectId, bucket = '', description = '' } = req.body;
    if (!name || !projectId) return res.status(400).json({ error: 'name and projectId required' });

    const now = new Date().toISOString();
    const flow = {
      id: uid(),
      name,
      projectId,
      bucket,
      description,
      createdAt: now,
      updatedAt: now,
      nodes: [],
      edges: [],
    };
    data.flows.push(flow);
    writeData(data);
    return res.status(201).json(flow);
  }

  if (req.method === 'PUT') {
    const { id, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });

    const flowIndex = data.flows.findIndex(f => f.id === id);
    if (flowIndex === -1) return res.status(404).json({ error: 'flow not found' });

    let updatedFlow = { ...data.flows[flowIndex], ...updates, updatedAt: new Date().toISOString() };
    updatedFlow = purgeOrphanNodes(updatedFlow, updatedFlow.projectId, data.projects);
    data.flows[flowIndex] = updatedFlow;

    writeData(data);
    return res.json(updatedFlow);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });

    data.flows = data.flows.filter(f => f.id !== id);
    data.flowExecutions = data.flowExecutions.filter(fe => fe.flowId !== id);
    writeData(data);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
