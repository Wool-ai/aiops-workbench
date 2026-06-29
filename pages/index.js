import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import Swimlane from '../components/Swimlane';
import TaskPanel from '../components/TaskPanel';
import NewProjectModal from '../components/NewProjectModal';
import Sidebar from '../components/Sidebar';
import BacklogView from '../components/BacklogView';
import QueueView from '../components/QueueView';
import DailyView from '../components/DailyView';
import RemindersView from '../components/RemindersView';
import ChatBot from '../components/ChatBot';
import WorkspaceModal from '../components/WorkspaceModal';
import DashboardView from '../components/DashboardView';
import ScheduledView from '../components/ScheduledView';
import MCPView from '../components/MCPView';
import SkillsView from '../components/SkillsView';
import AgentsView from '../components/AgentsView';
import { ASSIGNEES, uid } from '../lib/data';
import styles from '../styles/Home.module.css';

const VIEW_META = {
  dashboard: {
    label: 'Dashboard',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>,
  },
  board: {
    label: 'Board',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="11" rx="1"/><rect x="17" y="3" width="4" height="7" rx="1"/></svg>,
  },
  backlog: {
    label: 'Backlog',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="3" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="3" cy="18" r="1.2" fill="currentColor" stroke="none"/></svg>,
  },
  queue: {
    label: 'AI Work Queue',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>,
  },
  daily: {
    label: 'Daily Tasks',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  },
  reminders: {
    label: 'Reminders',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  },
  scheduled: {
    label: 'Scheduled',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="8 14 11 17 16 12"/></svg>,
  },
  agents: {
    label: 'AI Agents',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/><circle cx="19" cy="19" r="3"/><line x1="19" y1="16" x2="19" y2="22"/><line x1="16" y1="19" x2="22" y2="19"/></svg>,
  },
  skills: {
    label: 'Skills & Templates',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  },
  mcp: {
    label: 'MCP Servers',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6" strokeWidth="2.5" strokeLinecap="round"/><line x1="6" y1="18" x2="6.01" y2="18" strokeWidth="2.5" strokeLinecap="round"/></svg>,
  },
};

async function loadData() {
  const res = await fetch('/api/data');
  if (!res.ok) throw new Error('Failed to load');
  return res.json();
}

async function saveData(projects, notifications, dailyTasks, reminders) {
  await fetch('/api/data', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projects, notifications, dailyTasks, reminders }),
  });
}

export default function Home() {
  const [projects, setProjects] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [dailyTasks, setDailyTasks] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTask, setActiveTask] = useState(null);
  const [workspaceTarget, setWorkspaceTarget] = useState(null); // { project, bucketName? }
  const [showNewProject, setShowNewProject] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const [search, setSearch] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [sortBy, setSortBy] = useState('default');

  // Load from data.json on mount
  useEffect(() => {
    loadData()
      .then(({ projects: raw, notifications: rawNotifs, dailyTasks: rawDaily, reminders: rawReminders }) => {
        setProjects((raw || []).map(p => ({ ...p, buckets: p.buckets || [] })));
        setNotifications(rawNotifs || []);
        setDailyTasks(rawDaily || []);
        setReminders(rawReminders || []);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  // Re-sync projects/dailyTasks/reminders from disk after an AI run — MCP tools
  // write directly to data.json, so we must reload or the debounce-save will
  // overwrite those changes with the stale in-memory state.
  const reloadFromDisk = useCallback(async () => {
    try {
      const { projects: raw, dailyTasks: rawDaily, reminders: rawReminders } = await loadData();
      setProjects((raw || []).map(p => ({ ...p, buckets: p.buckets || [] })));
      setDailyTasks(rawDaily || []);
      setReminders(rawReminders || []);
    } catch { /* non-fatal */ }
  }, []);

  // Debounce-save to data.json on every projects/notifications change (skip while loading)
  const saveTimerRef = useRef(null);
  useEffect(() => {
    if (isLoading) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveData(projects, notifications.filter(n => n.type !== 'processing'), dailyTasks, reminders).catch(console.error);
    }, 400);
    return () => clearTimeout(saveTimerRef.current);
  }, [projects, notifications, dailyTasks, reminders, isLoading]);

  // Scheduler tick — poll every 60 s, dispatch due schedules via runWithAI
  useEffect(() => {
    async function tick() {
      try {
        const res = await fetch('/api/scheduler-tick', { method: 'POST' });
        const { due } = await res.json();
        if (due && due.length > 0) {
          for (const s of due) {
            const task = {
              id: 'sched-' + s.id + '-' + Date.now(),
              name: s.name,
              desc: s.prompt,
              col: 'todo',
              bucket: '',
            };
            const projectId = s.projectId || 'scheduled';
            const tempId = 'processing-' + Date.now() + Math.random();
            setNotifications(prev => [{
              id: tempId,
              type: 'processing',
              projectId,
              projectName: s.projectName || 'Scheduled',
              taskId: task.id,
              taskName: s.name,
              bucket: '',
              message: '',
              timestamp: new Date().toISOString(),
              read: false,
              thread: [],
              scheduled: true,
              scheduleId: s.id,
            }, ...prev]);
            fetch('/api/ai-process', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                task,
                projectId,
                projectName: s.projectName || 'Scheduled',
                bucket: '',
                allowedTools: s.allowedTools?.length ? s.allowedTools : undefined,
                agentIds: s.agentIds?.length ? s.agentIds : undefined,
              }),
            })
              .then(r => r.json())
              .then(async notif => {
                await reloadFromDisk();
                setNotifications(prev => [
                  { ...notif, scheduled: true, scheduleId: s.id },
                  ...prev.filter(n => n.id !== tempId),
                ]);
                setActiveView(v => v === 'scheduled' ? 'queue' : v);
              })
              .catch(() => {
                setNotifications(prev => prev.map(n =>
                  n.id === tempId ? { ...n, type: 'issue', message: 'Scheduled task failed.' } : n
                ));
              });
          }
        }
      } catch { /* network error, ignore */ }
    }
    tick();
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, [reloadFromDisk]);

  const totalTasks = projects.reduce((sum, p) => sum + p.tasks.length, 0);
  const doneTasks = projects.reduce((sum, p) => sum + p.tasks.filter(t => t.col === 'done').length, 0);
  const pct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const isFiltered = !!(search.trim() || filterAssignee);

  const displayProjects = useMemo(() => {
    if (!isFiltered && sortBy === 'default') return projects;
    return projects.map(p => ({
      ...p,
      tasks: p.tasks
        .filter(t => {
          const q = search.trim().toLowerCase();
          const matchSearch = !q || t.name.toLowerCase().includes(q) || (t.desc || '').toLowerCase().includes(q);
          const matchAssignee = !filterAssignee || t.assignee === filterAssignee;
          return matchSearch && matchAssignee;
        })
        .sort((a, b) => {
          if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
          if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
          return 0;
        }),
    }));
  }, [projects, search, filterAssignee, sortBy, isFiltered]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        setActiveTask(null);
        setShowNewProject(false);
      }
      if (
        e.key === 'n' &&
        !activeTask &&
        !showNewProject &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)
      ) {
        setShowNewProject(true);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [activeTask, showNewProject]);

  const toggleLane = useCallback((pid) => {
    setProjects(prev => prev.map(p => p.id === pid ? { ...p, open: !p.open } : p));
  }, []);

  const openTask = useCallback((task, projectId) => {
    setActiveTask({ task: { ...task }, projectId });
  }, []);

  const openNewTask = useCallback((projectId, col = 'todo', bucket = '') => {
    const task = { id: uid(), col, name: '', desc: '', assignee: '', bucket, priority: 'medium', comments: [] };
    setProjects(prev => prev.map(p =>
      p.id === projectId ? { ...p, tasks: [...p.tasks, task] } : p
    ));
    setActiveTask({ task, projectId });
  }, []);

  const saveTask = useCallback((updatedTask) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeTask.projectId) return p;
      const exists = p.tasks.some(t => t.id === updatedTask.id);
      return {
        ...p,
        tasks: exists
          ? p.tasks.map(t => t.id === updatedTask.id ? updatedTask : t)
          : [...p.tasks, updatedTask],
      };
    }));
    setActiveTask(null);
  }, [activeTask]);

  const deleteTask = useCallback(() => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeTask.projectId) return p;
      return { ...p, tasks: p.tasks.filter(t => t.id !== activeTask.task.id) };
    }));
    setActiveTask(null);
  }, [activeTask]);

  const moveTask = useCallback((projectId, taskId, newCol) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, col: newCol } : t) };
    }));
  }, []);

  const updateTaskStatus = useCallback((task, projectId, newCol) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return { ...p, tasks: p.tasks.map(t => t.id === task.id ? { ...t, col: newCol } : t) };
    }));
  }, []);

  const addBucket = useCallback((projectId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      if (p.buckets.includes(trimmed)) return p;
      return { ...p, buckets: [...p.buckets, trimmed] };
    }));
  }, []);

  const removeBucket = useCallback((projectId, name) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        buckets: p.buckets.filter(b => b !== name),
        tasks: p.tasks.map(t => t.bucket === name ? { ...t, bucket: '' } : t),
      };
    }));
  }, []);

  const saveReminder = useCallback((reminder) => {
    setReminders(prev => {
      const exists = prev.some(r => r.id === reminder.id);
      return exists ? prev.map(r => r.id === reminder.id ? reminder : r) : [...prev, reminder];
    });
  }, []);

  const deleteReminder = useCallback((id) => {
    setReminders(prev => prev.filter(r => r.id !== id));
  }, []);

  const toggleReminderDone = useCallback((id) => {
    setReminders(prev => prev.map(r => r.id === id ? { ...r, done: !r.done } : r));
  }, []);

  // Browser notifications for due reminders
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (Notification.permission === 'default') Notification.requestPermission();
    const firedRef = new Set();
    function checkReminders() {
      const now = new Date();
      reminders.forEach(r => {
        if (r.done || firedRef.has(r.id)) return;
        const due = new Date(r.datetime);
        const diffMs = now - due;
        if (diffMs >= 0 && diffMs < 60_000) {
          firedRef.add(r.id);
          if (Notification.permission === 'granted') {
            new Notification(r.title, { body: r.note || 'Reminder from AIOps Workbench', icon: '/favicon.ico' });
          }
        }
      });
    }
    checkReminders();
    const iv = setInterval(checkReminders, 30_000);
    return () => clearInterval(iv);
  }, [reminders]);

  const saveDailyTask = useCallback((task) => {
    setDailyTasks(prev => {
      const exists = prev.some(t => t.id === task.id);
      return exists ? prev.map(t => t.id === task.id ? task : t) : [...prev, task];
    });
  }, []);

  const deleteDailyTask = useCallback((id) => {
    setDailyTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  const toggleDailyTaskDone = useCallback((task, date) => {
    const key = date.toISOString().slice(0, 10);
    setDailyTasks(prev => prev.map(t => {
      if (t.id !== task.id) return t;
      const dates = t.completedDates || [];
      return {
        ...t,
        completedDates: dates.includes(key)
          ? dates.filter(d => d !== key)
          : [...dates, key],
      };
    }));
  }, []);

  const runDailyTaskWithAI = useCallback(async (task) => {
    const tempId = 'processing-' + Date.now();
    setNotifications(prev => [{
      id: tempId,
      type: 'processing',
      projectId: 'daily',
      projectName: 'Daily Tasks',
      taskId: task.id,
      taskName: task.name,
      bucket: '',
      message: '',
      timestamp: new Date().toISOString(),
      read: false,
      thread: [],
    }, ...prev]);
    setActiveView('queue');
    try {
      const res = await fetch('/api/ai-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, projectId: 'daily', projectName: 'Daily Tasks', bucket: '' }),
      });
      const notif = await res.json();
      setNotifications(prev => [notif, ...prev.filter(n => n.id !== tempId)]);
    } catch {
      setNotifications(prev => prev.map(n =>
        n.id === tempId ? { ...n, type: 'issue', message: 'AI processing failed. Please try again.' } : n
      ));
    }
  }, []);

  const createProject = useCallback(({ name, color }) => {
    const newProject = { id: 'p' + Date.now(), name, color, open: true, buckets: [], tasks: [] };
    setProjects(prev => [...prev, newProject]);
    setShowNewProject(false);
  }, []);

  const applyAIResult = useCallback((notif) => {
    if (notif.projectId === 'daily' || !notif.taskId) return;
    if (notif.type === 'processing') return;

    const aiComment = {
      author: 'AI',
      text: notif.message,
      time: new Date(notif.timestamp).toLocaleString(),
      aiNotifId: notif.id,
      resultType: notif.type,
    };
    const newCol = notif.type === 'completed' ? 'done' : null;

    setProjects(prev => prev.map(p => {
      if (p.id !== notif.projectId) return p;
      return {
        ...p,
        tasks: p.tasks.map(t => {
          if (t.id !== notif.taskId) return t;
          return { ...t, col: newCol || t.col, comments: [...(t.comments || []), aiComment] };
        }),
      };
    }));

    setActiveTask(prev => {
      if (!prev || prev.task.id !== notif.taskId) return prev;
      return {
        ...prev,
        task: {
          ...prev.task,
          col: newCol || prev.task.col,
          comments: [...(prev.task.comments || []), aiComment],
        },
      };
    });
  }, []);

  const runWithAI = useCallback(async (task, projectId, allowedTools, instructions, agentIds) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const tempId = 'processing-' + Date.now();
    setNotifications(prev => [{
      id: tempId,
      type: 'processing',
      projectId,
      projectName: project.name,
      taskId: task.id,
      taskName: task.name,
      bucket: task.bucket || '',
      message: '',
      timestamp: new Date().toISOString(),
      read: false,
      thread: [],
    }, ...prev]);
    try {
      const res = await fetch('/api/ai-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, projectId, projectName: project.name, bucket: task.bucket || '', allowedTools: allowedTools?.length ? allowedTools : undefined, instructions: instructions || undefined, agentIds: agentIds?.length ? agentIds : undefined }),
      });
      const notif = await res.json();
      await reloadFromDisk();
      setNotifications(prev => [notif, ...prev.filter(n => n.id !== tempId)]);
      applyAIResult(notif);
      setActiveView('queue');
    } catch {
      setNotifications(prev => prev.map(n =>
        n.id === tempId ? { ...n, type: 'issue', message: 'AI processing failed. Please try again.' } : n
      ));
    }
  }, [projects, applyAIResult, reloadFromDisk]);

  const runAllWithAI = useCallback(async (projectId) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const pending = project.tasks.filter(t => t.col === 'todo');
    if (pending.length === 0) return;
    setActiveView('queue');
    const CONCURRENCY = 3;
    let i = 0;
    async function next() {
      if (i >= pending.length) return;
      const task = pending[i++];
      await runWithAI(task, projectId);
      await next();
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, next));
  }, [projects, runWithAI]);

  const approveAndRetry = useCallback(async (notif) => {
    const project = projects.find(p => p.id === notif.projectId);
    const task = project?.tasks.find(t => t.id === notif.taskId) || { id: notif.taskId, name: notif.taskName, col: 'todo' };
    const approvedTools = [...new Set((notif.deniedOperations || []).map(d => d.tool))];
    const tempId = 'processing-' + Date.now();
    setNotifications(prev => [
      { id: tempId, type: 'processing', projectId: notif.projectId, projectName: notif.projectName, taskId: notif.taskId, taskName: notif.taskName, bucket: notif.bucket, message: '', timestamp: new Date().toISOString(), read: false, thread: [] },
      ...prev.map(n => n.id === notif.id ? { ...n, read: true } : n),
    ]);
    try {
      const res = await fetch('/api/ai-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task,
          projectId: notif.projectId,
          projectName: notif.projectName,
          bucket: notif.bucket,
          approvedContext: {
            previousMessage: notif.message,
            deniedOperations: notif.deniedOperations || [],
            approvedTools,
          },
        }),
      });
      const newNotif = await res.json();
      await reloadFromDisk();
      setNotifications(prev => [newNotif, ...prev.filter(n => n.id !== tempId)]);
      applyAIResult(newNotif);
    } catch {
      setNotifications(prev => prev.filter(n => n.id !== tempId));
    }
  }, [projects, applyAIResult, reloadFromDisk]);

  const markNotifRead = useCallback((id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const dismissNotif = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const replyToNotif = useCallback(async (notif, replyText) => {
    const project = projects.find(p => p.id === notif.projectId);
    const task = project?.tasks.find(t => t.id === notif.taskId) || { id: notif.taskId, name: notif.taskName, col: 'todo' };
    const tempId = 'processing-' + Date.now();
    setNotifications(prev => [{ id: tempId, type: 'processing', projectId: notif.projectId, projectName: notif.projectName, taskId: notif.taskId, taskName: notif.taskName, bucket: notif.bucket, message: '', timestamp: new Date().toISOString(), read: false, thread: [] }, ...prev.map(n => n.id === notif.id ? { ...n, read: true } : n)]);
    try {
      const res = await fetch('/api/ai-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, projectId: notif.projectId, projectName: notif.projectName, bucket: notif.bucket, replyContext: { reply: replyText, previousMessage: notif.message } }),
      });
      const newNotif = await res.json();
      await reloadFromDisk();
      setNotifications(prev => [newNotif, ...prev.filter(n => n.id !== tempId)]);
      applyAIResult(newNotif);
    } catch {
      setNotifications(prev => prev.filter(n => n.id !== tempId));
    }
  }, [projects, applyAIResult, reloadFromDisk]);

  const activeProject = activeTask
    ? projects.find(p => p.id === activeTask.projectId)
    : null;

  const hasFilters = isFiltered || sortBy !== 'default';

  return (
    <div className={styles.appShell}>
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        queueUnread={notifications.filter(n => !n.read && n.type !== 'processing').length}
        remindersOverdue={reminders.filter(r => !r.done && new Date(r.datetime) < new Date()).length}
      />
      <div className={styles.content}>
      <header className={styles.topbar}>
        <div className={styles.topbarTop}>
          {/* App name — terminal breadcrumb */}
          <div className={styles.appName}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <polygon points="12 2 22 7 22 17 12 22 2 17 2 7" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
              <circle cx="12" cy="12" r="2" fill="currentColor"/>
            </svg>
            aiops
          </div>

          <span className={styles.topbarDivider} />

          {/* Per-view page title */}
          <div className={styles.pageTitle}>
            <span className={styles.pageTitleIcon}>{VIEW_META[activeView]?.icon}</span>
            <span className={styles.pageTitleText}>{VIEW_META[activeView]?.label}</span>
          </div>

          {/* Board / Backlog: progress + new project */}
          {(activeView === 'board' || activeView === 'backlog') && !isLoading && projects.length > 0 && (
            <div className={styles.stats}>
              <span>{projects.length} project{projects.length !== 1 ? 's' : ''}</span>
              <span className={styles.statDot} />
              <div className={styles.progressArea}>
                <span className={styles.progressLabel}>{doneTasks}/{totalTasks} done</span>
                <div className={styles.progressBarWrap}>
                  <div className={styles.progressBarFill} style={{ width: `${pct}%` }} />
                </div>
                <span className={styles.progressLabel}>{pct}%</span>
              </div>
            </div>
          )}
          {(activeView === 'board' || activeView === 'backlog') && (
            <button className={styles.newProjectBtn} onClick={() => setShowNewProject(true)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New project
            </button>
          )}

          {/* Queue: unread count */}
          {activeView === 'queue' && (() => {
            const unread = notifications.filter(n => !n.read && n.type !== 'processing').length;
            const needsInput = notifications.filter(n => !n.read && n.type === 'human_input').length;
            return unread > 0 ? (
              <div className={styles.topbarMeta}>
                <span className={styles.topbarBadge}>{unread} unread</span>
                {needsInput > 0 && (
                  <span className={styles.topbarBadgeDanger}>{needsInput} need input</span>
                )}
              </div>
            ) : (
              <span className={styles.topbarSubtle}>All caught up</span>
            );
          })()}

          {/* Daily: today's date */}
          {activeView === 'daily' && (
            <span className={styles.topbarSubtle}>
              {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
          )}

          {/* Reminders: overdue count */}
          {activeView === 'reminders' && (() => {
            const overdue = reminders.filter(r => !r.done && new Date(r.datetime) < new Date()).length;
            return overdue > 0 ? (
              <span className={styles.topbarBadgeDanger}>{overdue} overdue</span>
            ) : (
              <span className={styles.topbarSubtle}>No overdue reminders</span>
            );
          })()}

          {/* Dashboard: today's date */}
          {activeView === 'dashboard' && (
            <span className={styles.topbarSubtle}>
              {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
          )}
        </div>

        {/* Board / Backlog: search row */}
        {(activeView === 'board' || activeView === 'backlog') && (
          <div className={styles.searchRow}>
            <input
              className={styles.searchInput}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tasks…"
              aria-label="Search tasks"
            />
            <select
              className={styles.filterSelect}
              value={filterAssignee}
              onChange={e => setFilterAssignee(e.target.value)}
              aria-label="Filter by assignee"
            >
              <option value="">All assignees</option>
              {ASSIGNEES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select
              className={styles.sortSelect}
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              aria-label="Sort tasks"
            >
              <option value="default">Default order</option>
              <option value="name_asc">Name A–Z</option>
              <option value="name_desc">Name Z–A</option>
            </select>
            {hasFilters && (
              <button
                className={styles.clearFiltersBtn}
                onClick={() => { setSearch(''); setFilterAssignee(''); setSortBy('default'); }}
              >
                Clear
              </button>
            )}
          </div>
        )}
      </header>

      <main className={`${styles.main} ${activeView === 'dashboard' ? styles.mainDashboard : activeView === 'scheduled' ? styles.mainScheduled : (activeView === 'queue' || activeView === 'reminders') ? styles.mainQueue : activeView === 'daily' ? styles.mainDaily : (activeView === 'mcp' || activeView === 'skills' || activeView === 'agents') ? styles.mainScheduled : ''}`}>
        {isLoading ? (
          <div className={styles.loadingState}>
            <div className={styles.loadingSpinner} />
            Loading…
          </div>
        ) : activeView === 'dashboard' ? (
          <DashboardView
            projects={projects}
            notifications={notifications}
            dailyTasks={dailyTasks}
            reminders={reminders}
            onNavigate={setActiveView}
          />
        ) : activeView === 'reminders' ? (
          <RemindersView
            reminders={reminders}
            projects={projects}
            onSave={saveReminder}
            onDelete={deleteReminder}
            onToggleDone={toggleReminderDone}
          />
        ) : activeView === 'daily' ? (
          <DailyView
            dailyTasks={dailyTasks}
            onSave={saveDailyTask}
            onDelete={deleteDailyTask}
            onToggleDone={toggleDailyTaskDone}
            onRunWithAI={runDailyTaskWithAI}
          />
        ) : activeView === 'scheduled' ? (
          <ScheduledView
            projects={projects}
            notifications={notifications}
            onApproveRetry={approveAndRetry}
          />
        ) : activeView === 'queue' ? (
          <QueueView
            notifications={notifications}
            onMarkRead={markNotifRead}
            onDismiss={dismissNotif}
            onReply={replyToNotif}
            onApproveRetry={approveAndRetry}
            onOpenTask={(taskId, projectId) => {
              const project = projects.find(p => p.id === projectId);
              const task = project?.tasks.find(t => t.id === taskId);
              if (task) openTask(task, projectId);
            }}
          />
        ) : activeView === 'agents' ? (
          <AgentsView />
        ) : activeView === 'skills' ? (
          <SkillsView />
        ) : activeView === 'mcp' ? (
          <MCPView />
        ) : activeView === 'backlog' ? (
          <BacklogView
            displayProjects={displayProjects}
            projects={projects}
            onTaskClick={openTask}
            onAddTask={(projectId) => openNewTask(projectId, 'todo', '')}
            onStatusChange={updateTaskStatus}
            onAddBucket={addBucket}
            isFiltered={isFiltered}
            onOpenWorkspace={(project, bucketName) => setWorkspaceTarget({ project, bucketName })}
          />
        ) : projects.length === 0 ? (
          <div className={styles.empty}>
            <p>No projects yet.</p>
            <button className={styles.newProjectBtn} onClick={() => setShowNewProject(true)}>Create your first project</button>
          </div>
        ) : (
          displayProjects.map((displayProject) => {
            const project = projects.find(p => p.id === displayProject.id);
            if (!project) return null;
            return (
              <Swimlane
                key={project.id}
                project={project}
                displayTasks={displayProject.tasks}
                isFiltered={isFiltered}
                onToggle={() => toggleLane(project.id)}
                onTaskClick={(task) => openTask(task, project.id)}
                onAddTask={(col, bucket) => openNewTask(project.id, col || 'todo', bucket || '')}
                onMoveTask={(taskId, newCol) => moveTask(project.id, taskId, newCol)}
                onAddBucket={(name) => addBucket(project.id, name)}
                onRemoveBucket={(name) => removeBucket(project.id, name)}
                onOpenWorkspace={(proj, bucketName) => setWorkspaceTarget({ project: proj, bucketName })}
                onRunAll={() => runAllWithAI(project.id)}
              />
            );
          })
        )}
      </main>

      {activeTask && activeProject && (
        <>
          <div className={styles.panelBackdrop} onClick={() => setActiveTask(null)} />
          <TaskPanel
            task={activeTask.task}
            projectName={activeProject.name}
            projectBuckets={activeProject.buckets || []}
            onSave={saveTask}
            onDelete={deleteTask}
            onClose={() => setActiveTask(null)}
            onRunWithAI={(task, allowedTools, instructions, agentIds) => runWithAI(task, activeTask.projectId, allowedTools, instructions, agentIds)}
            onGoToQueue={() => { setActiveTask(null); setActiveView('queue'); }}
            onOpenWorkspace={(bucketName) => setWorkspaceTarget({ project: activeProject, bucketName })}
          />
        </>
      )}

      {showNewProject && (
        <NewProjectModal
          onSave={createProject}
          onClose={() => setShowNewProject(false)}
        />
      )}

      {workspaceTarget && (
        <WorkspaceModal
          project={workspaceTarget.project}
          bucketName={workspaceTarget.bucketName}
          onClose={() => setWorkspaceTarget(null)}
        />
      )}
      </div>

      <ChatBot />
    </div>
  );
}
