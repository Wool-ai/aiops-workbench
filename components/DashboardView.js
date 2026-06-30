import { useMemo } from 'react';
import styles from '../styles/DashboardView.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function isWeekend() {
  const d = new Date().getDay();
  return d === 0 || d === 6;
}

function occursToday(task) {
  const w = isWeekend();
  if (task.days === 'both') return true;
  if (task.days === 'weekend') return w;
  return !w;
}

function relTime(iso) {
  const diff = new Date(iso) - Date.now();
  const abs = Math.abs(diff);
  const past = diff < 0;
  const m = Math.floor(abs / 60000);
  if (m < 1) return past ? 'just now' : 'in <1m';
  if (m < 60) return past ? `${m}m ago` : `in ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return past ? `${h}h ago` : `in ${h}h`;
  return past ? `${Math.floor(h / 24)}d ago` : `in ${Math.floor(h / 24)}d`;
}

function pctColor(pct) {
  if (pct >= 75) return 'var(--done-c)';
  if (pct >= 25) return 'var(--accent)';
  if (pct > 0)   return 'var(--review-c)';
  return 'var(--text3)';
}

// ── Charts ────────────────────────────────────────────────────────────────────

function DonutChart({ segments, size = 104, thickness = 12 }) {
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, sg) => s + sg.value, 0);
  const active = segments.filter(sg => sg.value > 0);
  const GAP = active.length > 1 ? 3 : 0;

  let accumulated = 0;
  const arcs = active.map(sg => {
    const full = (sg.value / total) * circ;
    const dash = Math.max(full - GAP, 0);
    const arc = { ...sg, dash, offset: accumulated + GAP / 2 };
    accumulated += full;
    return arc;
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      {total === 0 ? (
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="var(--border2)" strokeWidth={thickness} />
      ) : arcs.map((arc, i) => (
        <circle
          key={i}
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={arc.color}
          strokeWidth={thickness}
          strokeDasharray={`${arc.dash} ${circ - arc.dash}`}
          strokeDashoffset={-arc.offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          strokeLinecap="butt"
        />
      ))}
    </svg>
  );
}

function BarChart({ bars }) {
  const CHART_H = 88;
  const max = Math.max(...bars.map(b => b.value), 1);

  return (
    <div className={styles.barWrap}>
      <div className={styles.barTrack} style={{ height: CHART_H }}>
        {bars.map((b, i) => {
          const fillH = b.value > 0
            ? Math.max(Math.round((b.value / max) * (CHART_H - 20)), 6)
            : 2;
          return (
            <div key={i} className={styles.barCol}>
              {b.value > 0 && (
                <span className={styles.barCount}>{b.value}</span>
              )}
              <div className={styles.barSpacer} />
              <div
                className={`${styles.barFill} ${b.isToday ? styles.barFillToday : ''}`}
                style={{ height: fillH }}
              />
            </div>
          );
        })}
      </div>
      <div className={styles.barAxis} />
      <div className={styles.barDays}>
        {bars.map((b, i) => (
          <div key={i} className={`${styles.barDay} ${b.isToday ? styles.barDayToday : ''}`}>
            {b.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function StackedBar({ segments, total }) {
  return (
    <div className={styles.stackedBar}>
      {total === 0
        ? <div className={styles.stackedEmpty} />
        : segments.filter(s => s.value > 0).map((s, i) => (
          <div
            key={i}
            className={styles.stackedSeg}
            style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
            title={`${s.label}: ${s.value}`}
          />
        ))
      }
    </div>
  );
}

// ── Alert strip ───────────────────────────────────────────────────────────────

function AlertStrip({ items }) {
  if (!items.length) return null;
  return (
    <div className={styles.alertStrip}>
      {items.map((item, i) => (
        <button
          key={i}
          className={styles.alertChip}
          onClick={item.onClick}
          style={{ '--ac': item.color, '--ab': item.bg }}
        >
          <span className={styles.alertDot} />
          {item.label}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>
      ))}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KPICard({ icon, label, value, sub, accentColor, onClick, progress }) {
  return (
    <div
      className={`${styles.kpi} ${onClick ? styles.kpiClickable : ''}`}
      onClick={onClick}
      style={{ '--acc': accentColor || 'var(--accent)' }}
    >
      <div className={styles.kpiHeader}>
        <span className={styles.kpiLabel}>{label}</span>
        <span className={styles.kpiIconBg}>{icon}</span>
      </div>
      <div className={styles.kpiValue}>{value}</div>
      {progress !== undefined && (
        <div className={styles.kpiMiniBar}>
          <div
            className={styles.kpiMiniBarFill}
            style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
          />
        </div>
      )}
      {sub && <div className={styles.kpiSub}>{sub}</div>}
      {onClick && (
        <svg className={styles.kpiArrow} width="12" height="12" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12 5 19 12 12 19"/>
        </svg>
      )}
    </div>
  );
}

function SectionCard({ title, icon, linkLabel, onLink, children }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitleWrap}>
          {icon && <span className={styles.cardTitleIcon}>{icon}</span>}
          <span className={styles.cardTitle}>{title}</span>
        </div>
        {onLink && (
          <button className={styles.cardLink} onClick={onLink}>
            {linkLabel}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function DonutCard({ title, icon, linkLabel, onLink, segments, center, legend }) {
  return (
    <SectionCard title={title} icon={icon} linkLabel={linkLabel} onLink={onLink}>
      <div className={styles.donutWrap}>
        <div className={styles.donutCenter}>
          <DonutChart segments={segments} size={104} thickness={12} />
          <div className={styles.donutInner}>
            <span className={styles.donutBig}>{center.value}</span>
            <span className={styles.donutSub}>{center.label}</span>
          </div>
        </div>
        <div className={styles.donutLegend}>
          {legend.map(l => (
            <div key={l.label} className={styles.legendRow}>
              <span className={styles.legendDot} style={{ background: l.color }} />
              <span className={styles.legendLabel}>{l.label}</span>
              <span className={styles.legendCount}>{l.count}</span>
              <span className={styles.legendPct}>{l.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

const TYPE_META = {
  completed:   { label: 'Done',        fg: 'var(--done-c)',   bg: 'var(--done-bg)'   },
  issue:       { label: 'Issue',       fg: 'var(--review-c)', bg: 'var(--review-bg)' },
  human_input: { label: 'Needs input', fg: 'var(--inprog-c)', bg: 'var(--inprog-bg)' },
};

// ── Main view ─────────────────────────────────────────────────────────────────

export default function DashboardView({ projects, notifications, dailyTasks, reminders, onNavigate }) {
  const now = new Date();
  const today = todayKey();

  const allTasks = useMemo(
    () => projects.flatMap(p => p.tasks.map(t => ({ ...t, projectName: p.name, projectColor: p.color }))),
    [projects]
  );

  const totalTasks = allTasks.length;
  const byCol = useMemo(() => ({
    todo:   allTasks.filter(t => t.col === 'todo').length,
    inprog: allTasks.filter(t => t.col === 'inprog').length,
    review: allTasks.filter(t => t.col === 'review').length,
    done:   allTasks.filter(t => t.col === 'done').length,
  }), [allTasks]);

  const overallPct = totalTasks ? Math.round((byCol.done / totalTasks) * 100) : 0;

  const queueAll    = notifications.filter(n => n.type !== 'processing');
  const queueUnread = notifications.filter(n => !n.read && n.type !== 'processing').length;
  const queueNeeds  = notifications.filter(n => !n.read && n.type === 'human_input').length;
  const queuePerms  = notifications.filter(n => !n.read && n.type === 'permission_required').length;

  const todayTasks = (dailyTasks || []).filter(occursToday);
  const todayDone  = todayTasks.filter(t => (t.completedDates || []).includes(today)).length;

  const overdueRems  = reminders.filter(r => !r.done && new Date(r.datetime) < now);
  const upcomingRems = reminders
    .filter(r => !r.done && new Date(r.datetime) >= now)
    .sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
    .slice(0, 5);

  const aiDailyBars = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().slice(0, 10);
      return {
        label: d.toLocaleDateString([], { weekday: 'short' }).slice(0, 2),
        value: queueAll.filter(n => n.timestamp?.slice(0, 10) === key).length,
        isToday: key === today,
      };
    });
  }, [queueAll, today]);

  const taskSegments = [
    { label: 'Done',        value: byCol.done,   color: 'var(--done-c)'   },
    { label: 'In progress', value: byCol.inprog,  color: 'var(--inprog-c)' },
    { label: 'In review',   value: byCol.review,  color: 'var(--review-c)' },
    { label: 'To do',       value: byCol.todo,    color: 'var(--todo-c)'   },
  ];

  const aiCounts = {
    completed:   queueAll.filter(n => n.type === 'completed').length,
    human_input: queueAll.filter(n => n.type === 'human_input').length,
    issue:       queueAll.filter(n => n.type === 'issue').length,
  };
  const aiTotal = queueAll.length;
  const aiSegments = [
    { label: 'Completed',   value: aiCounts.completed,   color: 'var(--done-c)'   },
    { label: 'Needs input', value: aiCounts.human_input, color: 'var(--inprog-c)' },
    { label: 'Issues',      value: aiCounts.issue,       color: 'var(--review-c)' },
  ];

  const recentActivity = queueAll.slice(0, 10);
  const weekRuns = aiDailyBars.reduce((s, b) => s + b.value, 0);

  const alertItems = [
    ...(queuePerms > 0 ? [{
      label: `${queuePerms} task${queuePerms !== 1 ? 's' : ''} need${queuePerms === 1 ? 's' : ''} permission`,
      color: 'var(--mcp-c)',
      bg: 'var(--mcp-glow)',
      onClick: () => onNavigate('queue'),
    }] : []),
    ...(queueNeeds > 0 ? [{
      label: `${queueNeeds} AI task${queueNeeds !== 1 ? 's' : ''} need${queueNeeds === 1 ? 's' : ''} your input`,
      color: 'var(--inprog-c)',
      bg: 'rgba(90,203,255,0.07)',
      onClick: () => onNavigate('queue'),
    }] : []),
    ...(overdueRems.length > 0 ? [{
      label: `${overdueRems.length} overdue reminder${overdueRems.length !== 1 ? 's' : ''}`,
      color: 'var(--danger)',
      bg: 'rgba(240,112,112,0.07)',
      onClick: () => onNavigate('reminders'),
    }] : []),
  ];

  return (
    <div className={styles.dash}>

      {/* ── Alert strip ── */}
      <AlertStrip items={alertItems} />

      {/* ── KPI strip ── */}
      <div className={styles.kpiRow}>
        <KPICard
          label="Overall progress"
          value={`${overallPct}%`}
          sub={`${byCol.done} of ${totalTasks} tasks done`}
          accentColor="var(--accent)"
          progress={overallPct}
          onClick={() => onNavigate('board')}
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          }
        />
        <KPICard
          label="Projects"
          value={projects.length}
          sub={`${totalTasks} task${totalTasks !== 1 ? 's' : ''} across all`}
          accentColor="var(--accent)"
          onClick={() => onNavigate('board')}
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="11" rx="1"/><rect x="17" y="3" width="4" height="7" rx="1"/>
            </svg>
          }
        />
        <KPICard
          label="AI queue"
          value={queueUnread}
          sub={queueNeeds > 0 ? `${queueNeeds} need${queueNeeds !== 1 ? '' : 's'} your input` : 'No action needed'}
          accentColor={queueNeeds > 0 ? 'var(--inprog-c)' : 'var(--text3)'}
          onClick={() => onNavigate('queue')}
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
            </svg>
          }
        />
        <KPICard
          label="Daily today"
          value={`${todayDone}/${todayTasks.length}`}
          sub={todayTasks.length > 0 ? `${todayTasks.length - todayDone} remaining` : 'None scheduled today'}
          accentColor="var(--done-c)"
          progress={todayTasks.length > 0 ? Math.round((todayDone / todayTasks.length) * 100) : undefined}
          onClick={() => onNavigate('daily')}
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          }
        />
        <KPICard
          label="Overdue reminders"
          value={overdueRems.length}
          sub={overdueRems.length > 0 ? 'Requires attention' : 'All clear'}
          accentColor={overdueRems.length > 0 ? 'var(--danger)' : 'var(--text3)'}
          onClick={() => onNavigate('reminders')}
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          }
        />
      </div>

      {/* ── Body ── */}
      <div className={styles.body}>

        {/* ── Main column ── */}
        <div className={styles.main}>

          {/* Project health */}
          <SectionCard
            title="Project health"
            linkLabel="Open board"
            onLink={() => onNavigate('board')}
            icon={
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
            }
          >
            {projects.length === 0 ? (
              <div className={styles.emptyState}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.2 }}>
                  <rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="11" rx="1"/><rect x="17" y="3" width="4" height="7" rx="1"/>
                </svg>
                <span>No projects yet</span>
              </div>
            ) : (
              <div className={styles.projectList}>
                {projects.map(p => {
                  const t  = p.tasks.length;
                  const d  = p.tasks.filter(x => x.col === 'done').length;
                  const ip = p.tasks.filter(x => x.col === 'inprog').length;
                  const rv = p.tasks.filter(x => x.col === 'review').length;
                  const td = p.tasks.filter(x => x.col === 'todo').length;
                  const pct = t ? Math.round((d / t) * 100) : 0;
                  return (
                    <div key={p.id} className={styles.projectRow}>
                      <div className={styles.projectMeta}>
                        <span className={styles.projectSwatch} style={{ background: p.color, boxShadow: `0 0 6px ${p.color}60` }} />
                        <span className={styles.projectName}>{p.name}</span>
                        <div className={styles.projectCounts}>
                          {ip > 0 && <span className={styles.pCountChip} style={{ color: 'var(--inprog-c)', background: 'var(--inprog-bg)' }}>{ip} active</span>}
                          {rv > 0 && <span className={styles.pCountChip} style={{ color: 'var(--review-c)', background: 'var(--review-bg)' }}>{rv} review</span>}
                        </div>
                        <span className={styles.projectCount}>{d} / {t}</span>
                        <span className={styles.projectPct} style={{ color: pct > 0 ? pctColor(pct) : 'var(--text3)' }}>{pct}%</span>
                      </div>
                      <StackedBar
                        total={t}
                        segments={[
                          { label: 'Done',        value: d,  color: 'var(--done-c)'   },
                          { label: 'In review',   value: rv, color: 'var(--review-c)' },
                          { label: 'In progress', value: ip, color: 'var(--inprog-c)' },
                          { label: 'To do',       value: td, color: 'var(--surface4)'  },
                        ]}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {/* Bottom row: bar chart + activity feed */}
          <div className={styles.bottomRow}>

            <SectionCard
              title="AI activity"
              icon={
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
                  <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
                </svg>
              }
            >
              {weekRuns === 0 ? (
                <div className={styles.emptyState}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.2 }}>
                    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
                    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
                  </svg>
                  <span>No runs this week</span>
                </div>
              ) : (
                <>
                  <BarChart bars={aiDailyBars} />
                  <div className={styles.barFooter}>
                    <span className={styles.barTotal}>{weekRuns} run{weekRuns !== 1 ? 's' : ''} this week</span>
                    <button className={styles.cardLink} onClick={() => onNavigate('queue')}>
                      View queue
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </SectionCard>

            <SectionCard
              title="Recent AI activity"
              linkLabel="View all"
              onLink={() => onNavigate('queue')}
              icon={
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              }
            >
              {recentActivity.length === 0 ? (
                <div className={styles.emptyState}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.2 }}>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  <span>No AI activity yet</span>
                </div>
              ) : (
                <div className={styles.feed}>
                  {recentActivity.map(n => {
                    const meta = TYPE_META[n.type] || TYPE_META.completed;
                    return (
                      <div
                        key={n.id}
                        className={`${styles.feedRow} ${n.read ? styles.feedRead : ''}`}
                        style={{ '--row-accent': meta.fg }}
                      >
                        <div className={styles.feedBar} />
                        <div className={styles.feedBody}>
                          <div className={styles.feedTop}>
                            <span className={styles.feedBadge} style={{ color: meta.fg, background: meta.bg }}>
                              {meta.label}
                            </span>
                            {!n.read && <span className={styles.feedUnreadDot} />}
                            <span className={styles.feedTime}>{relTime(n.timestamp)}</span>
                          </div>
                          <div className={styles.feedTask}>{n.taskName}</div>
                          <div className={styles.feedProject}>
                            {n.projectName}{n.bucket ? ` · ${n.bucket}` : ''}
                          </div>
                          {n.message && (
                            <div className={styles.feedMsg}>{n.message}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>

          </div>
        </div>

        {/* ── Side column ── */}
        <div className={styles.side}>

          {/* Task status donut */}
          {totalTasks > 0 ? (
            <DonutCard
              title="Task status"
              linkLabel="Backlog"
              onLink={() => onNavigate('backlog')}
              icon={
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 2a10 10 0 0 1 10 10"/>
                </svg>
              }
              segments={taskSegments}
              center={{ value: `${overallPct}%`, label: 'done' }}
              legend={taskSegments.map(s => ({
                label: s.label,
                color: s.color,
                count: s.value,
                pct: totalTasks ? Math.round((s.value / totalTasks) * 100) : 0,
              }))}
            />
          ) : (
            <SectionCard title="Task status" linkLabel="Board" onLink={() => onNavigate('board')}>
              <div className={styles.emptyState}><span>No tasks yet</span></div>
            </SectionCard>
          )}

          {/* AI queue donut */}
          {aiTotal > 0 ? (
            <DonutCard
              title="AI queue"
              linkLabel="Queue"
              onLink={() => onNavigate('queue')}
              icon={
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              }
              segments={aiSegments}
              center={{ value: aiTotal, label: 'total' }}
              legend={aiSegments.map(s => ({
                label: s.label,
                color: s.color,
                count: s.value,
                pct: aiTotal ? Math.round((s.value / aiTotal) * 100) : 0,
              }))}
            />
          ) : (
            <SectionCard title="AI queue" linkLabel="Queue" onLink={() => onNavigate('queue')}>
              <div className={styles.emptyState}><span>No AI runs yet</span></div>
            </SectionCard>
          )}

          {/* Upcoming reminders */}
          {upcomingRems.length > 0 && (
            <SectionCard
              title="Upcoming"
              linkLabel="All reminders"
              onLink={() => onNavigate('reminders')}
              icon={
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              }
            >
              <div className={styles.miniList}>
                {upcomingRems.map(r => (
                  <div key={r.id} className={styles.miniRow}>
                    <div className={styles.miniDot} />
                    <div className={styles.miniInfo}>
                      <span className={styles.miniTitle}>{r.title}</span>
                      {r.note && <span className={styles.miniSub}>{r.note}</span>}
                    </div>
                    <span className={styles.miniTime}>{relTime(r.datetime)}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Daily tasks */}
          {todayTasks.length > 0 && (
            <SectionCard
              title="Daily — today"
              linkLabel="All"
              onLink={() => onNavigate('daily')}
              icon={
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              }
            >
              <div className={styles.miniList}>
                {todayTasks.slice(0, 6).map(t => {
                  const done = (t.completedDates || []).includes(today);
                  return (
                    <div key={t.id} className={`${styles.miniRow} ${done ? styles.miniRowDone : ''}`}>
                      <div className={`${styles.dailyCheck} ${done ? styles.dailyChecked : ''}`}>
                        {done && (
                          <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </div>
                      <span className={styles.miniTitle}>{t.name}</span>
                      {t.time && <span className={styles.miniTime}>{t.time}</span>}
                    </div>
                  );
                })}
                {todayTasks.length > 6 && (
                  <div className={styles.miniMore}>+{todayTasks.length - 6} more</div>
                )}
              </div>
            </SectionCard>
          )}

        </div>
      </div>
    </div>
  );
}
