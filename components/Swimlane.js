import { useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, rectIntersection, useDroppable } from '@dnd-kit/core';
import TaskCard from './TaskCard';
import { COLUMNS, COLUMN_LABELS } from '../lib/data';
import styles from '../styles/Swimlane.module.css';

function DroppableColWrapper({ col, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: col });
  return (
    <div ref={setNodeRef} className={`${styles.cards} ${isOver ? styles.cardsOver : ''}`}>
      {children}
    </div>
  );
}

function BucketSection({ bucketName, tasks, isFiltered, isUncategorized, onTaskClick, onAddTask, onRemoveBucket, onOpenWorkspace }) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const label = isUncategorized ? 'Uncategorized' : bucketName;

  return (
    <div className={styles.bucketSection}>
      <div className={styles.bucketHeader}>
        <span className={styles.bucketLabel}>{label}</span>
        <span className={styles.bucketCount}>{tasks.length}</span>
        <div className={styles.bucketHeaderRight}>
          {!isUncategorized && onOpenWorkspace && (
            <button className={styles.bucketWorkspaceBtn} onClick={() => onOpenWorkspace(bucketName)} title="Bucket workspace">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
          )}
          {!isUncategorized && (
            confirmRemove ? (
              <span className={styles.bucketRemoveConfirm}>
                Remove bucket?
                <button className={styles.bucketConfirmYes} onClick={() => onRemoveBucket(bucketName)}>Yes</button>
                <button className={styles.bucketConfirmNo} onClick={() => setConfirmRemove(false)}>No</button>
              </span>
            ) : (
              <button className={styles.bucketRemoveBtn} onClick={() => setConfirmRemove(true)} title="Remove bucket">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
            )
          )}
          {!isFiltered && (
            <button className={styles.bucketAddBtn} onClick={() => onAddTask('todo', bucketName)}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add task
            </button>
          )}
        </div>
      </div>
      <div className={styles.bucketCards}>
        {tasks.length === 0 ? (
          isFiltered ? (
            <p className={styles.bucketEmpty}>No matches</p>
          ) : (
            <button className={styles.bucketEmptyBtn} onClick={() => onAddTask('todo', bucketName)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add a task to this bucket
            </button>
          )
        ) : (
          tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              col={task.col}
              onClick={() => onTaskClick(task)}
              showStatus
              draggable={false}
            />
          ))
        )}
      </div>
    </div>
  );
}

function AddBucketRow({ onAdd }) {
  const [active, setActive] = useState(false);
  const [value, setValue] = useState('');

  function submit(e) {
    e.preventDefault();
    if (value.trim()) {
      onAdd(value.trim());
      setValue('');
      setActive(false);
    }
  }

  if (!active) {
    return (
      <button className={styles.addBucketTrigger} onClick={() => setActive(true)}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        New bucket
      </button>
    );
  }

  return (
    <form className={styles.addBucketForm} onSubmit={submit}>
      <input
        className={styles.addBucketInput}
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Bucket name…"
        autoFocus
        onKeyDown={e => e.key === 'Escape' && setActive(false)}
      />
      <button type="submit" className={styles.addBucketSave}>Add</button>
      <button type="button" className={styles.addBucketCancel} onClick={() => setActive(false)}>Cancel</button>
    </form>
  );
}

export default function Swimlane({ project, displayTasks, isFiltered, onToggle, onTaskClick, onAddTask, onMoveTask, onAddBucket, onRemoveBucket, onOpenWorkspace, onRunAll }) {
  const [viewMode, setViewMode] = useState('status');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const tasksToShow = displayTasks ?? project.tasks;

  function handleDragEnd({ active, over }) {
    if (!over) return;
    const toCol = over.id;
    const fromCol = active.data.current?.col;
    if (!fromCol || fromCol === toCol) return;
    onMoveTask(active.id, toCol);
  }

  // --- Bucket view ---
  const buckets = project.buckets || [];

  function renderBucketView() {
    const grouped = {};
    buckets.forEach(b => { grouped[b] = []; });
    grouped['__none__'] = [];

    tasksToShow.forEach(task => {
      const key = task.bucket && grouped[task.bucket] !== undefined ? task.bucket : '__none__';
      grouped[key].push(task);
    });

    const allBuckets = [...buckets, '__none__'];

    return (
      <div className={styles.bucketBody}>
        {allBuckets.map(bName => {
          const isUncategorized = bName === '__none__';
          if (isUncategorized && grouped['__none__'].length === 0 && !isFiltered) return null;
          return (
            <BucketSection
              key={bName}
              bucketName={bName}
              tasks={grouped[bName]}
              isFiltered={isFiltered}
              isUncategorized={isUncategorized}
              onTaskClick={onTaskClick}
              onAddTask={onAddTask}
              onRemoveBucket={onRemoveBucket}
              onOpenWorkspace={onOpenWorkspace ? (bn) => onOpenWorkspace(project, bn) : null}
            />
          );
        })}
        <AddBucketRow onAdd={onAddBucket} />
      </div>
    );
  }

  return (
    <div className={styles.lane}>
      <div className={styles.header} onClick={onToggle}>
        <div className={styles.left}>
          <div
            className={styles.dot}
            style={{ background: project.color, color: project.color }}
          />
          <span className={styles.name}>{project.name}</span>
          <span className={styles.count}>{project.tasks.length} task{project.tasks.length !== 1 ? 's' : ''}</span>
        </div>

        {!project.open && (
          <div className={styles.collapsedSummary}>
            {COLUMNS.map(col => {
              const count = project.tasks.filter(t => t.col === col).length;
              return (
                <span key={col} className={`${styles.collapsedCount} ${styles['collapsedCount_' + col]}`}>
                  {COLUMN_LABELS[col]} {count}
                </span>
              );
            })}
          </div>
        )}

        <div className={styles.actions} onClick={e => e.stopPropagation()}>
          {project.open && (
            <div className={styles.viewToggle}>
              <button
                className={`${styles.viewBtn} ${viewMode === 'status' ? styles.viewBtnActive : ''}`}
                onClick={() => setViewMode('status')}
                title="Group by status"
              >
                Status
              </button>
              <button
                className={`${styles.viewBtn} ${viewMode === 'bucket' ? styles.viewBtnActive : ''}`}
                onClick={() => setViewMode('bucket')}
                title="Group by work bucket"
              >
                Buckets
              </button>
            </div>
          )}
          {onOpenWorkspace && (
            <button className={styles.workspaceBtn} onClick={() => onOpenWorkspace(project, null)} title="Project Workspace">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              Workspace
            </button>
          )}
          {onRunAll && project.tasks.some(t => t.col === 'todo') && (
            <button className={styles.runAllBtn} onClick={onRunAll} title="Run all todo tasks with AI">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Run all
            </button>
          )}
          <button className={styles.addTaskBtn} onClick={() => onAddTask(null)}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add task
          </button>
          <div className={`${styles.chevron} ${project.open ? styles.chevronOpen : ''}`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
      </div>

      {project.open && viewMode === 'bucket' && renderBucketView()}

      {project.open && viewMode === 'status' && (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd} collisionDetection={rectIntersection}>
          <div className={styles.body}>
            {COLUMNS.map(col => {
              const tasks = tasksToShow.filter(t => t.col === col);
              const isEmpty = tasks.length === 0;

              // Group tasks by bucket within this column when buckets exist
              let cardContent;
              if (isEmpty) {
                cardContent = isFiltered ? (
                  <div className={styles.emptyColNoMatch}>No matches</div>
                ) : (
                  <button className={styles.emptyColBtn} onClick={() => onAddTask(col)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add a task
                  </button>
                );
              } else if (buckets.length === 0) {
                cardContent = tasks.map(task => (
                  <TaskCard key={task.id} task={task} col={col} onClick={() => onTaskClick(task)} />
                ));
              } else {
                const grouped = {};
                buckets.forEach(b => { grouped[b] = []; });
                const uncat = [];
                tasks.forEach(t => {
                  if (t.bucket && grouped[t.bucket] !== undefined) grouped[t.bucket].push(t);
                  else uncat.push(t);
                });
                const hasBucketedTasks = buckets.some(b => grouped[b].length > 0);

                cardContent = (
                  <>
                    {buckets.map(b => grouped[b].length === 0 ? null : (
                      <div key={b} className={styles.colBucketGroup}>
                        <div className={styles.colBucketLabel}>
                          <span>{b}</span>
                          {onOpenWorkspace && (
                            <button
                              className={styles.colBucketWorkspaceBtn}
                              onClick={() => onOpenWorkspace(project, b)}
                              title={`Workspace: ${b}`}
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                              </svg>
                            </button>
                          )}
                        </div>
                        {grouped[b].map(task => (
                          <TaskCard key={task.id} task={task} col={col} onClick={() => onTaskClick(task)} />
                        ))}
                      </div>
                    ))}
                    {uncat.length > 0 && (
                      <div className={styles.colBucketGroup}>
                        {hasBucketedTasks && <div className={styles.colBucketLabel}>Other</div>}
                        {uncat.map(task => (
                          <TaskCard key={task.id} task={task} col={col} onClick={() => onTaskClick(task)} />
                        ))}
                      </div>
                    )}
                  </>
                );
              }

              return (
                <div key={col} className={styles.col}>
                  <div className={styles.colHeader}>
                    <span className={`${styles.colLabel} ${styles['label_' + col]}`}>
                      {COLUMN_LABELS[col]}
                    </span>
                    <span className={styles.colCount}>{tasks.length}</span>
                  </div>
                  <DroppableColWrapper col={col}>
                    {cardContent}
                  </DroppableColWrapper>
                  {!isEmpty && (
                    <button className={styles.addCardBtn} onClick={() => onAddTask(col)}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Add
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </DndContext>
      )}
    </div>
  );
}
