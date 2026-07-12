import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  getTasksByPlan, addTask, deleteTask, updateTask,
  getGroupsByPlan, addGroup,
  getDailyRecordsForPlan, upsertDailyRecord,
  generateDateList, formatDate,
  getTotalDurationByTask, getTimeRecordsByTask,
  addPlan, deletePlan,
  getSettings, saveSettings, getTimerDraft, clearTimerDraft,
} from '../db';
import { Task, Group, DailyRecord, TimeRecord, Plan } from '../types';
import { ToastContainer, useToast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import { Timer } from './Timer';
import { Modal } from './Modal';
import { uuid } from '../utils/uuid';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { performSync, isOnline, logout } from '../sync/client';
import { SyncAuthModal } from './SyncAuthModal';
import { HaoxueModule } from '../haoxue';

interface GanttViewProps {
  planId: string;
  plans: Plan[];
  onSwitchPlan: (planId: string) => void;
  onPlansChanged: () => void;
}

type DateRangePreset = 7 | 30 | 'custom';

function heatClass(completed: number, target: number): string {
  if (target <= 0) return completed > 0 ? 'heat-75' : 'heat-0';
  const ratio = completed / target;
  if (ratio >= 1) return 'heat-100';
  if (ratio >= 0.5) return 'heat-75';
  if (ratio >= 0.25) return 'heat-50';
  if (ratio > 0) return 'heat-25';
  return 'heat-0';
}

function formatDateHeader(d: string) {
  const date = new Date(d);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const wd = weekdays[date.getDay()];
  const today = formatDate(new Date());
  return { label: `${month}/${day}`, weekday: wd, isToday: d === today, isWeekend: date.getDay() === 0 || date.getDay() === 6 };
}

/* ─── Sortable task row (C1: mouse + touch + keyboard reorder) ─── */
interface RowProps {
  task: Task;
  dateList: string[];
  totalCompleted: number;
  getCellValue: (date: string) => number | null;
  onCellClick: (date: string) => void;
  onEdit: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onLongPress: (e: React.PointerEvent) => void;
  onMore: (e: React.MouseEvent) => void;
  onClearLongPress: () => void;
  colWidthStyle: React.CSSProperties;
  cellStyle: React.CSSProperties;
}

const SortableTaskRow: React.FC<RowProps> = ({
  task, dateList, totalCompleted, getCellValue, onCellClick, onEdit, onContextMenu, onLongPress, onMore, onClearLongPress,
  colWidthStyle, cellStyle,
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id: task.id });

  return (
    <tr ref={setNodeRef} className="border-b border-gray-100/80 group" style={{ opacity: isDragging ? 0.4 : 1 }}>
      {/* Task name + drag handle + more */}
      <td className="sticky left-0 z-[3] bg-white px-3 py-1.5 border-r border-gray-100 group-hover:bg-blue-50/20 transition-colors"
        style={colWidthStyle}>
        <div className="flex items-center gap-1">
          <button
            {...attributes}
            {...listeners}
            onClick={onEdit}
            onContextMenu={onContextMenu}
            onPointerDown={(e) => { (listeners as any)?.onPointerDown?.(e); onLongPress(e); }}
            onPointerUp={onClearLongPress}
            onPointerCancel={onClearLongPress}
            className="flex-1 text-left min-h-[36px] flex items-center touch-none"
            aria-label={`编辑任务 ${task.name}（可拖动排序）`}
          >
            <span className="text-sm font-medium text-gray-800">{task.name}</span>
          </button>
          <button onClick={onMore}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 active:bg-gray-200 transition-colors"
            aria-label={`任务 ${task.name} 的更多操作`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg>
          </button>
        </div>
      </td>
      {/* Progress - sticky left */}
      <td className="sticky z-[3] bg-white px-2 py-1.5 text-center border-r border-gray-100 group-hover:bg-blue-50/20 transition-colors"
        style={cellStyle}>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-xs font-mono font-semibold text-gray-700">
            {task.targetCount > 0 ? `${totalCompleted}/${task.targetCount}` : String(totalCompleted)}
          </span>
          {task.targetCount > 0 && (
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (totalCompleted / task.targetCount) * 100)}%` }} />
            </div>
          )}
        </div>
      </td>
      {/* Date cells (keyboard accessible, C4) */}
      {dateList.map((d) => {
        const val = getCellValue(d);
        const { isToday } = formatDateHeader(d);
        return (
          <td key={d}
            role="button" tabIndex={0}
            aria-label={`${task.name} ${d} 已完成 ${val ?? 0}`}
            onClick={() => onCellClick(d)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCellClick(d); } }}
            className={`text-center px-1 py-1.5 cursor-pointer transition-all active:scale-95 touch-manipulation min-w-[56px] min-h-[36px] ${isToday ? 'ring-1 ring-inset ring-blue-200' : ''}`}>
            <div className={`w-full min-h-[30px] flex items-center justify-center rounded-lg ${heatClass(val ?? 0, task.targetCount)} transition-colors`}>
              <span className={`text-xs font-mono ${val !== null && val > 0 ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                {val !== null ? val : '-'}
              </span>
            </div>
          </td>
        );
      })}
    </tr>
  );
};

export const GanttView: React.FC<GanttViewProps> = ({ planId, plans, onSwitchPlan, onPlansChanged }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([]);
  const [datePreset, setDatePreset] = useState<DateRangePreset>(7);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [dateList, setDateList] = useState<string[]>([]);
  const [dateError, setDateError] = useState<string | null>(null);
  const [showCustom, setShowCustom] = useState(false);

  const [showAddPanel, setShowAddPanel] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskTarget, setNewTaskTarget] = useState(0);
  const [newTaskGroupText, setNewTaskGroupText] = useState('');

  const [showPlanDropdown, setShowPlanDropdown] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const planRef = useRef<HTMLDivElement>(null);

  const [cellPopup, setCellPopup] = useState<{
    taskId: string; taskName: string; date: string; completedCount: number; note: string;
  } | null>(null);

  const [editTask, setEditTask] = useState<{ id: string; name: string; targetCount: number; groupId: string | null } | null>(null);
  const [editTaskGroupText, setEditTaskGroupText] = useState('');

  const [fullscreenTimer, setFullscreenTimer] = useState<{ taskId: string; taskName: string; date: string } | null>(null);
  const [resumeStart, setResumeStart] = useState<string | null>(null);
  const [todaySessions, setTodaySessions] = useState(0);
  const [todayDuration, setTodayDuration] = useState(0);
  const [todayTimeRecords, setTodayTimeRecords] = useState<TimeRecord[]>([]);
  const [, setTaskDurations] = useState<Record<string, number>>({});

  const [taskColWidth, setTaskColWidth] = useState(160);
  const dragColRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; taskId: string; taskName: string } | null>(null);

  const [confirmState, setConfirmState] = useState<{
    title: string; message: string; onConfirm: () => void; destructive?: boolean;
  } | null>(null);
  const [, setDeleteTarget] = useState<{ id: string; name: string; type: 'task' | 'group' } | null>(null);

  // Sync state (B5)
  const [online, setOnline] = useState(isOnline());
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [subFeatureOpen, setSubFeatureOpen] = useState(false);
  const [pendingHaoxue, setPendingHaoxue] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const { toasts, show: showToast, dismiss: dismissToast } = useToast();

  const currentPlan = plans.find((p) => p.id === planId);
  const planName = currentPlan?.name ?? '';

  /* derived cell data (C4/C10 helpers) */
  const totalByTask = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of dailyRecords) m.set(r.taskId, (m.get(r.taskId) ?? 0) + r.completedCount);
    return m;
  }, [dailyRecords]);
  const cellMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of dailyRecords) m.set(`${r.taskId}@${r.date}`, r.completedCount);
    return m;
  }, [dailyRecords]);

  /* ─── load settings (A7) ─── */
  useEffect(() => {
    (async () => {
      const s = await getSettings();
      setDatePreset(s.datePreset);
      setCustomFrom(s.customFrom);
      setCustomTo(s.customTo);
      setTaskColWidth(s.taskColWidth);
      setLastSync(s.lastSync);
      setUsername(s.username);
      setLoaded(true);
    })();
  }, []);

  /* persist UI prefs (A7) */
  useEffect(() => {
    saveSettings({ datePreset, customFrom, customTo, taskColWidth });
  }, [datePreset, customFrom, customTo, taskColWidth]);

  /* online/offline listeners (B5) */
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  /* ─── load tasks/groups ─── */
  const loadData = useCallback(async () => {
    const [taskList, groupList] = await Promise.all([
      getTasksByPlan(planId), getGroupsByPlan(planId),
    ]);
    setTasks(taskList);
    setGroups(groupList);
    const durMap: Record<string, number> = {};
    for (const t of taskList) {
      durMap[t.id] = await getTotalDurationByTask(t.id);
    }
    setTaskDurations(durMap);
  }, [planId]);

  useEffect(() => { loadData(); }, [loadData]);

  /* resume unfinished timer (A8) */
  useEffect(() => {
    (async () => {
      const draft = await getTimerDraft();
      if (!draft) return;
      const age = Date.now() - new Date(draft.updatedAt).getTime();
      if (age > 12 * 60 * 60 * 1000) { await clearTimerDraft(); return; }
      const planTasks = await getTasksByPlan(planId);
      if (!planTasks.find((t) => t.id === draft.taskId)) { await clearTimerDraft(); return; }
      setConfirmState({
        title: '继续计时',
        message: `检测到「${draft.taskName}」有一个进行中的计时，是否继续？`,
        onConfirm: () => {
          setResumeStart(draft.startTime);
          setFullscreenTimer({ taskId: draft.taskId, taskName: draft.taskName, date: draft.date });
          setConfirmState(null);
        },
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── date range ─── */
  useEffect(() => {
    let from: string, to: string;
    if (datePreset === 'custom' && customFrom && customTo) {
      if (customFrom > customTo) {
        setDateError('开始日期不能晚于结束日期');
        setDateList([]);
        setDailyRecords([]);
        return;
      }
      from = customFrom; to = customTo;
    } else {
      const base = new Date();
      base.setDate(base.getDate() - 1);
      const fromDate = new Date(base);
      const toDate = new Date(base);
      toDate.setDate(base.getDate() + (datePreset as number) - 1);
      from = formatDate(fromDate); to = formatDate(toDate);
    }
    setDateError(null);
    setDateList(generateDateList(from, to));
    getDailyRecordsForPlan(planId, from, to).then(setDailyRecords);
  }, [planId, datePreset, customFrom, customTo]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (planRef.current && !planRef.current.contains(e.target as Node)) {
        setShowPlanDropdown(false);
        setNewPlanName('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  /* ─── plan management ─── */
  const handleCreatePlan = async () => {
    if (!newPlanName.trim()) { showToast({ text: '请输入计划名称', type: 'error' }); return; }
    const ts = new Date().toISOString();
    await addPlan({ id: uuid(), name: newPlanName.trim(), createdAt: ts });
    setNewPlanName('');
    setShowPlanDropdown(false);
    showToast({ text: `计划已创建`, type: 'success' });
    onPlansChanged();
  };

  const confirmDeletePlan = (id: string, name: string) => {
    setShowPlanDropdown(false);
    setConfirmState({
      title: '删除计划',
      message: `确定要删除「${name}」吗？其下所有任务和记录都将被删除。`,
      destructive: true,
      onConfirm: async () => {
        await deletePlan(id);
        showToast({ text: `已删除「${name}」`, type: 'info' });
        onPlansChanged();
      },
    });
  };

  /* ─── tasks ─── */
  const resolveGroup = async (name: string): Promise<string | null> => {
    if (!name.trim()) return null;
    const existing = groups.find((g) => g.name === name.trim());
    if (existing) return existing.id;
    const ts = new Date().toISOString();
    const g: Group = { id: uuid(), planId, name: name.trim(), sortOrder: groups.length, createdAt: ts, updatedAt: ts, deletedAt: null };
    await addGroup(g);
    setGroups((prev) => [...prev, g]);
    return g.id;
  };

  const handleAddTask = async () => {
    if (!newTaskName.trim()) { showToast({ text: '请输入任务名称', type: 'error' }); return; }
    const groupId = await resolveGroup(newTaskGroupText);
    await addTask({
      id: uuid(), planId, groupId,
      name: newTaskName.trim(), targetCount: Math.max(1, newTaskTarget || 1),
      completedCount: 0, sortOrder: tasks.length, createdAt: new Date().toISOString(),
    });
    setNewTaskName(''); setNewTaskTarget(0); setNewTaskGroupText('');
    showToast({ text: `任务已添加`, type: 'success' });
    setShowAddPanel(false);
    loadData();
  };

  const confirmDeleteTask = (id: string, name: string) => {
    setDeleteTarget({ id, name, type: 'task' });
    setConfirmState({
      title: '删除任务',
      message: `确定要删除「${name}」吗？`,
      destructive: true,
      onConfirm: async () => {
        await deleteTask(id);
        showToast({ text: `已删除「${name}」`, type: 'info' });
        setDeleteTarget(null);
        setContextMenu(null);
        loadData();
      },
    });
  };

  /* ─── cell popup ─── */
  const openCellPopup = (taskId: string, date: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const existing = dailyRecords.find((r) => r.taskId === taskId && r.date === date);
    let note = existing?.note ?? '';
    if (!note) {
      const yesterday = new Date(date);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = formatDate(yesterday);
      const yesterdayRec = dailyRecords.find((r) => r.taskId === taskId && r.date === yesterdayStr);
      if (yesterdayRec?.note) note = yesterdayRec.note;
    }
    setCellPopup({
      taskId, taskName: task.name, date,
      completedCount: existing?.completedCount ?? 0, note,
    });
    loadTodayTimerStats(taskId, date);
  };

  const loadTodayTimerStats = async (taskId: string, date: string) => {
    const records = await getTimeRecordsByTask(taskId);
    const todayRecs = records
      .filter((r) => r.date === date)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    setTodaySessions(todayRecs.length);
    setTodayDuration(todayRecs.reduce((s, r) => s + r.duration, 0));
    setTodayTimeRecords(todayRecs);
  };

  const saveCellPopup = async () => {
    if (!cellPopup) return;
    const record = {
      id: uuid(), taskId: cellPopup.taskId, date: cellPopup.date,
      completedCount: cellPopup.completedCount, note: cellPopup.note || undefined,
    };
    const saved = await upsertDailyRecord(record);
    setDailyRecords((prev) => {
      const idx = prev.findIndex((r) => r.taskId === saved.taskId && r.date === saved.date);
      if (idx >= 0) { const n = [...prev]; n[idx] = saved; return n; }
      return [...prev, saved];
    });
    setCellPopup(null);
  };

  /* ─── task edit (A4: preserve fields) ─── */
  const saveTaskEdit = async () => {
    if (!editTask || !editTask.name.trim()) { showToast({ text: '请输入任务名称', type: 'error' }); return; }
    const original = tasks.find((t) => t.id === editTask.id);
    if (!original) return;
    const groupId = await resolveGroup(editTaskGroupText);
    await updateTask({
      ...original,
      name: editTask.name.trim(),
      targetCount: Math.max(1, editTask.targetCount || 1),
      groupId,
    });
    showToast({ text: `任务已更新`, type: 'success' });
    setEditTask(null);
    loadData();
  };

  const openEdit = (task: Task) => {
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    setEditTask({ id: task.id, name: task.name, targetCount: task.targetCount, groupId: task.groupId });
    setEditTaskGroupText(groups.find((g) => g.id === task.groupId)?.name ?? '');
  };

  /* ─── fullscreen timer ─── */
  const launchTimer = (taskId: string, taskName: string, date: string) => {
    setResumeStart(null);
    setFullscreenTimer({ taskId, taskName, date });
  };

  const handleTimerEnd = async (taskId: string, _startTime: Date, _endTime: Date) => {
    if (!fullscreenTimer) return;
    loadTodayTimerStats(taskId, fullscreenTimer.date);
    setCellPopup((prev) => (prev ? { ...prev, completedCount: prev.completedCount + 1 } : null));
    showToast({ text: `计时完成`, type: 'success' });
  };

  const handleTimerClose = () => {
    if (fullscreenTimer) {
      loadTodayTimerStats(fullscreenTimer.taskId, fullscreenTimer.date);
      setFullscreenTimer(null);
    }
  };

  /* ─── context menu (C2: positioned, + more button) ─── */
  const openContextMenu = (e: React.MouseEvent, task: Task) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, taskId: task.id, taskName: task.name });
  };

  const longPressRef = useRef<{ taskId: string; taskName: string; x: number; y: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const suppressClickRef = useRef(false);

  const startLongPress = (task: Task, e: React.PointerEvent) => {
    const x = e.clientX;
    const y = e.clientY;
    const timer = setTimeout(() => {
      setContextMenu({ x, y, taskId: task.id, taskName: task.name });
      suppressClickRef.current = true;
    }, 500);
    longPressRef.current = { taskId: task.id, taskName: task.name, x, y, timer };
  };
  const clearLongPress = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current.timer);
      longPressRef.current = null;
    }
  };
  useEffect(() => () => { if (longPressRef.current) clearTimeout(longPressRef.current.timer); }, []);

  useEffect(() => {
    const close = () => setContextMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  /* ─── column resize ─── */
  const handleColDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragColRef.current = { startX: e.clientX, startWidth: taskColWidth };
    document.addEventListener('mousemove', handleColDragMove);
    document.addEventListener('mouseup', handleColDragEnd);
  };
  const handleColDragMove = (e: MouseEvent) => {
    if (!dragColRef.current) return;
    const diff = e.clientX - dragColRef.current.startX;
    setTaskColWidth(Math.max(80, dragColRef.current.startWidth + diff));
  };
  const handleColDragEnd = () => {
    dragColRef.current = null;
    document.removeEventListener('mousemove', handleColDragMove);
    document.removeEventListener('mouseup', handleColDragEnd);
  };
  useEffect(() => () => { handleColDragEnd(); }, []);

  /* ─── drag reorder (C1) ─── */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = tasks.findIndex((t) => t.id === active.id);
    const newIndex = tasks.findIndex((t) => t.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(tasks, oldIndex, newIndex);
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].sortOrder !== i) await updateTask({ ...reordered[i], sortOrder: i });
    }
    loadData();
    showToast({ text: '任务顺序已更新', type: 'success' });
  };

  /* ─── grouped tasks ─── */
  const groupedTasks: { group: Group | null; tasks: Task[] }[] = [];
  const ungrouped = tasks.filter((t) => !t.groupId);
  if (ungrouped.length > 0) groupedTasks.push({ group: null, tasks: ungrouped });
  for (const g of groups) {
    const gTasks = tasks.filter((t) => t.groupId === g.id);
    if (gTasks.length > 0) groupedTasks.push({ group: g, tasks: gTasks });
  }

  const flatIds = useMemo(() => groupedTasks.flatMap(({ tasks: ts }) => ts.map((t) => t.id)), [groupedTasks]);

  /* ─── sync (B5) ─── */
  const handleSync = async () => {
    if (syncing) return;
    const s = await getSettings();
    if (!s.username) {
      setShowAuth(true);
      return;
    }
    setSyncing(true);
    const r = await performSync();
    setSyncing(false);
    setLastSync(r.lastSync);
    if (r.ok) showToast({ text: '已同步', type: 'success' });
    else if (r.needsAuth) setShowAuth(true);
    else showToast({ text: `同步失败：${r.error}`, type: 'error' });
    loadData();
  };

  const handleLogout = async () => {
    await logout();
    setUsername(null);
    showToast({ text: '已退出登录', type: 'info' });
  };

  /* 口算训练入口：未登录先弹登录框，登录成功后自动打开 */
  const openHaoxue = () => {
    if (username) {
      setSubFeatureOpen(true);
    } else {
      setPendingHaoxue(true);
      setShowAuth(true);
    }
  };

  /* 切换账号：退出当前账号并重新登录（口算与任务共用同一账号） */
  const handleSwitchAccount = async () => {
    setSubFeatureOpen(false);
    await logout();
    setUsername(null);
    setShowAuth(true);
  };

  const colWidthStyle = { width: taskColWidth, minWidth: taskColWidth } as React.CSSProperties;
  const cellStyle = { left: taskColWidth } as React.CSSProperties;

  return (
    <>
      {!loaded ? (
        <div className="flex flex-col h-[100dvh] bg-gray-50 items-center justify-center">
          <div className="text-sm text-gray-400">加载中…</div>
        </div>
      ) : !username ? (
        /* ─── 登录门禁：未登录不显示任务列表 ─── */
        <div className="flex flex-col h-[100dvh] bg-gray-50 items-center justify-center px-6"
          style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}>
          <div className="w-full max-w-sm bg-white rounded-3xl p-7 shadow-sm border border-gray-100 text-center">
            <div className="text-4xl mb-3">📋</div>
            <div className="text-heading font-semibold text-gray-800">计划甘特表</div>
            <div className="text-sm text-gray-400 mt-1 mb-6">请先登录以查看与管理你的任务</div>
            <button
              onClick={() => setShowAuth(true)}
              className="w-full min-h-[52px] rounded-2xl bg-blue-600 text-white text-base font-semibold active:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
            >
              登录同步
            </button>
            <div className="text-[11px] text-gray-300 mt-3">登录后即可在本地与云端同步数据</div>
          </div>
        </div>
      ) : (
    <div className="flex flex-col h-[100dvh] bg-gray-50"
      style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}>
      {/* ─── Header ─── */}
      <div className="flex-shrink-0 bg-white/90 backdrop-blur-md border-b border-gray-200/80 px-4 py-2.5 flex items-center gap-2 z-20">
        <div className="relative flex-1" ref={planRef}>
          <button onClick={() => setShowPlanDropdown((v) => !v)}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors">
            <span className="text-heading text-gray-900">{planName}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showPlanDropdown && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 py-1 z-30 animate-fade-in">
              {plans.map((p) => (
                <button key={p.id} onClick={() => { onSwitchPlan(p.id); setShowPlanDropdown(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors ${
                    p.id === planId ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                  }`}>
                  <span className="flex-1 truncate">{p.name}</span>
                  {p.id === planId && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
              <div className="border-t border-gray-100 pt-1 px-3 py-2 flex gap-2">
                <input type="text" value={newPlanName} onChange={(e) => setNewPlanName(e.target.value)}
                  placeholder="新建计划..."
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:border-blue-400 outline-none transition-all" />
                <button onClick={handleCreatePlan}
                  className="min-h-[44px] px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold active:scale-95 transition-all">
                  创建
                </button>
              </div>
              {plans.length > 1 && (
                <div className="border-t border-gray-100 pt-1">
                  <button onClick={() => confirmDeletePlan(planId, planName)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    删除「{planName}」
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <button onClick={() => setShowAddPanel(true)}
          className="flex items-center justify-center w-9 h-9 rounded-xl text-blue-600 hover:bg-blue-50 active:bg-blue-100 transition-colors"
          aria-label="添加任务">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        <button onClick={openHaoxue}
          className="flex items-center justify-center w-9 h-9 rounded-xl text-blue-600 hover:bg-blue-50 active:bg-blue-100 transition-colors text-lg"
          aria-label="口算训练">
          🧮
        </button>
      </div>

      {/* ─── Date range tabs + sync ─── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-2 overflow-x-auto hide-scrollbar">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-0.5">
          {([7, 30, 'custom'] as const).map((p) => {
            const isActive = datePreset === p;
            return (
              <button key={String(p)} onClick={() => { setDatePreset(p); setShowCustom(p === 'custom'); }}
                className={`px-4 py-1.5 rounded-[10px] text-sm font-medium transition-all touch-manipulation ${
                  isActive ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
                }`}>
                {p === 7 ? '近 7 天' : p === 30 ? '近 30 天' : '自定义'}
              </button>
            );
          })}
        </div>
        {showCustom && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <input type="date" value={customFrom} onChange={(e) => { setCustomFrom(e.target.value); setDatePreset('custom'); }}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white" aria-label="开始日期" />
            <span className="text-gray-300">–</span>
            <input type="date" value={customTo} onChange={(e) => { setCustomTo(e.target.value); setDatePreset('custom'); }}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white" aria-label="结束日期" />
          </div>
        )}
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto pl-2">
          <span className={`w-2 h-2 rounded-full ${online ? 'bg-green-500' : 'bg-gray-300'}`} title={online ? '在线' : '离线'} />
          {username ? (
            <>
              <span className="text-xs text-gray-500 hidden sm:inline max-w-[88px] truncate" title={username}>{username}</span>
              <button onClick={handleLogout}
                className="min-h-[36px] px-2 rounded-xl text-gray-400 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                aria-label="退出登录" title="退出登录">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
              <button onClick={handleSync} disabled={syncing || !online}
                className="min-h-[36px] px-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium active:bg-gray-200 transition-colors disabled:opacity-50"
                aria-label="立即同步">
                {syncing ? '同步中…' : '同步'}
              </button>
            </>
          ) : (
            <button onClick={handleSync} disabled={!online}
              className="min-h-[36px] px-3 rounded-xl bg-blue-50 text-blue-600 text-sm font-medium active:bg-blue-100 transition-colors disabled:opacity-50"
              aria-label="登录并同步">
              {syncing ? '同步中…' : '登录同步'}
            </button>
          )}
          {lastSync && (
            <span className="text-[11px] text-gray-400 hidden sm:inline">
              {new Date(lastSync).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* ─── Table ─── */}
      <div className="flex-1 overflow-hidden relative">
        {dateError && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-xl bg-red-50 text-red-600 text-sm shadow">
            {dateError}
          </div>
        )}
        <div className="h-full overflow-x-auto overflow-y-auto hide-scrollbar cursor-grab active:cursor-grabbing select-none">
          <table className="w-full border-collapse" style={{ minWidth: dateList.length * 56 + taskColWidth + 56 }}>
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-gray-50 text-left px-3 py-3 text-xs font-semibold text-gray-500 border-b border-gray-200 select-none"
                  style={colWidthStyle}>
                  <div className="flex items-center justify-between">
                    <span>任务</span>
                    <div onMouseDown={handleColDragStart}
                      className="w-1.5 h-6 cursor-col-resize hover:bg-blue-400 active:bg-blue-500 rounded-full transition-colors flex-shrink-0"
                      style={{ touchAction: 'none' }} />
                  </div>
                </th>
                <th className="sticky left-0 z-10 bg-gray-50 text-center px-2 py-3 text-xs font-semibold text-gray-500 border-b border-gray-200 w-14 min-w-[56px]"
                  style={cellStyle}>
                  进度
                </th>
                {dateList.map((d) => {
                  const { label, weekday, isToday, isWeekend } = formatDateHeader(d);
                  return (
                    <th key={d}
                      className={`sticky top-0 z-[5] text-center px-1.5 py-2 text-xs border-b border-gray-200 min-w-[56px] ${isToday ? 'bg-blue-50' : isWeekend ? 'bg-gray-50/80' : 'bg-gray-50'}`}>
                      <div className={`font-semibold ${isToday ? 'text-blue-600' : 'text-gray-600'}`}>{label}</div>
                      <div className={`text-[10px] mt-0.5 ${isToday ? 'text-blue-400' : 'text-gray-400'}`}>{weekday}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={flatIds} strategy={verticalListSortingStrategy}>
                  {groupedTasks.map(({ group, tasks: gTasks }) => (
                    <React.Fragment key={group?.id ?? '__ungrouped'}>
                      {group && (
                        <tr>
                          <td colSpan={dateList.length + 2}
                            className="sticky left-0 z-[3] bg-indigo-50/80 px-3 py-2 text-xs font-semibold text-indigo-700 border-b border-indigo-100 backdrop-blur-sm flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                              <span>{group.name}</span>
                            </div>
                          </td>
                        </tr>
                      )}
                      {!group && gTasks.length > 0 && (
                        <tr>
                          <td colSpan={dateList.length + 2} className="sticky left-0 z-[3] bg-gray-50/80 px-3 py-1.5 text-[11px] text-gray-400 border-b border-gray-200">未分组</td>
                        </tr>
                      )}
                      {gTasks.map((task) => (
                        <SortableTaskRow
                          key={task.id}
                          task={task}
                          dateList={dateList}
                          totalCompleted={totalByTask.get(task.id) ?? 0}
                          getCellValue={(d) => {
                            const v = cellMap.get(`${task.id}@${d}`);
                            return v === undefined ? null : v;
                          }}
                          onCellClick={(d) => openCellPopup(task.id, d)}
                          onEdit={() => openEdit(task)}
                          onContextMenu={(e) => openContextMenu(e, task)}
                          onLongPress={(e) => startLongPress(task, e)}
                          onMore={(e) => { e.stopPropagation(); openContextMenu(e, task); }}
                          onClearLongPress={clearLongPress}
                          colWidthStyle={colWidthStyle}
                          cellStyle={cellStyle}
                        />
                      ))}
                    </React.Fragment>
                  ))}
                </SortableContext>
              </DndContext>
              {groupedTasks.length === 0 && (
                <tr>
                  <td colSpan={dateList.length + 2} className="text-center py-16 text-gray-400 text-sm">
                    还没有任务，点击右上角 + 添加
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Bottom hint bar ─── */}
      <div className="flex-shrink-0 bg-white/95 backdrop-blur-md border-t border-gray-200/80 px-4 py-2 flex items-center justify-center z-20"
        style={{ paddingBottom: 'calc(8px + var(--safe-bottom))' }}>
        <span className="text-xs text-gray-400 px-3 py-1.5 bg-gray-100 rounded-lg">点击日期格记录进度，点击右上角 + 添加任务</span>
      </div>

      {/* ─── Add task/group popup (C3 Modal) ─── */}
      <Modal open={showAddPanel} onClose={() => setShowAddPanel(false)} ariaLabel="添加任务">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-subhead text-gray-900">添加任务</h3>
          <button onClick={() => setShowAddPanel(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors" aria-label="关闭">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400" htmlFor="new-task-name">任务名称</label>
            <input id="new-task-name" type="text" value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)}
              placeholder="任务名称" autoFocus
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-xs text-gray-400" htmlFor="new-task-target">目标数</label>
              <input id="new-task-target" type="number" min={1} value={newTaskTarget || ''} onChange={(e) => setNewTaskTarget(Number(e.target.value))}
                placeholder="目标数" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:border-blue-400 outline-none transition-all" />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-xs text-gray-400" htmlFor="new-task-group">分组</label>
              <input id="new-task-group" list="add-group-list" value={newTaskGroupText} onChange={(e) => setNewTaskGroupText(e.target.value)}
                placeholder="分组（输入新名称自动创建）"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:border-blue-400 outline-none transition-all" />
              <datalist id="add-group-list">
                {groups.map((g) => <option key={g.id} value={g.name} />)}
              </datalist>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowAddPanel(false)}
              className="flex-1 min-h-[48px] rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold active:bg-gray-200 transition-colors">取消</button>
            <button onClick={handleAddTask}
              className="flex-1 min-h-[48px] rounded-xl bg-blue-600 text-white text-sm font-semibold active:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">确定添加</button>
          </div>
        </div>
      </Modal>

      {/* ─── Cell popup (C3 Modal) ─── */}
      <Modal open={cellPopup !== null} onClose={() => setCellPopup(null)} ariaLabel="记录每日进度">
        {cellPopup && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-subhead text-gray-900">{cellPopup.taskName}</h3>
                <span className="text-small text-gray-400">{cellPopup.date}</span>
              </div>
              <button onClick={() => setCellPopup(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors" aria-label="关闭">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <button onClick={() => setCellPopup((prev) => prev ? { ...prev, completedCount: Math.max(0, prev.completedCount - 1) } : null)}
                className="w-11 h-11 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 text-lg font-semibold active:bg-gray-200 transition-colors" aria-label="减少">−</button>
              <div className="flex-1 text-center">
                <input type="number" min={0} value={cellPopup.completedCount}
                  onChange={(e) => setCellPopup((prev) => prev ? { ...prev, completedCount: Math.max(0, Number(e.target.value)) } : null)}
                  className="w-20 text-center text-2xl font-bold text-gray-900 bg-transparent border-b-2 border-blue-500 outline-none mx-auto"
                  inputMode="numeric" aria-label="已完成次数" />
                <div className="text-[11px] text-gray-400 mt-1">已完成</div>
              </div>
              <button onClick={() => setCellPopup((prev) => prev ? { ...prev, completedCount: prev.completedCount + 1 } : null)}
                className="w-11 h-11 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 text-lg font-semibold active:bg-gray-200 transition-colors" aria-label="增加">+</button>
            </div>
            <input type="text" value={cellPopup.note}
              onChange={(e) => setCellPopup((prev) => prev ? { ...prev, note: e.target.value } : null)}
              placeholder="备注（可选，自动沿用上一天）"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:border-blue-400 outline-none transition-all mb-4" />
            <div className="bg-gray-50 rounded-2xl p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500">计时记录</span>
                <span className="text-xs text-gray-400">
                  {todaySessions > 0 ? `共 ${todaySessions} 次，${formatTimeShort(todayDuration)}` : '今日未计时'}
                </span>
              </div>
              {todayTimeRecords.length > 0 && (
                <div className="mb-3 space-y-1 max-h-[120px] overflow-y-auto">
                  {todayTimeRecords.map((r, i) => (
                    <div key={r.id} className="flex items-center justify-between text-xs text-gray-500 bg-white rounded-lg px-3 py-1.5">
                      <span className="font-medium text-gray-600">第{i + 1}次</span>
                      <span className="font-mono">
                        {new Date(r.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        {' - '}
                        {new Date(r.endTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="font-mono text-gray-400">{formatTimeShort(r.duration)}</span>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => launchTimer(cellPopup.taskId, cellPopup.taskName, cellPopup.date)}
                className="w-full flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-blue-600 text-white text-sm font-semibold active:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                全屏计时
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCellPopup(null)}
                className="flex-1 min-h-[48px] rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold active:bg-gray-200 transition-colors">取消</button>
              <button onClick={saveCellPopup}
                className="flex-1 min-h-[48px] rounded-xl bg-blue-600 text-white text-sm font-semibold active:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">确定</button>
            </div>
          </>
        )}
      </Modal>

      {/* ─── Edit task popup (C3 Modal) ─── */}
      <Modal open={editTask !== null} onClose={() => setEditTask(null)} ariaLabel="编辑任务">
        {editTask && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-subhead text-gray-900">编辑任务</h3>
              <button onClick={() => setEditTask(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors" aria-label="关闭">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400" htmlFor="edit-name">任务名称</label>
              <input id="edit-name" type="text" value={editTask.name}
                onChange={(e) => setEditTask((prev) => prev ? { ...prev, name: e.target.value } : null)}
                placeholder="任务名称" autoFocus
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all" />
            </div>
            <div className="flex gap-2">
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-xs text-gray-400" htmlFor="edit-target">目标数</label>
                <input id="edit-target" type="number" min={1} value={editTask.targetCount || ''}
                  onChange={(e) => setEditTask((prev) => prev ? { ...prev, targetCount: Number(e.target.value) } : null)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:border-blue-400 outline-none transition-all" />
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-xs text-gray-400" htmlFor="edit-group">分组</label>
                <input id="edit-group" list="edit-group-list" value={editTaskGroupText} onChange={(e) => setEditTaskGroupText(e.target.value)}
                  placeholder="无分组（支持新建）"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:border-blue-400 outline-none transition-all" />
                <datalist id="edit-group-list">
                  {groups.map((g) => <option key={g.id} value={g.name} />)}
                </datalist>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditTask(null)}
                className="flex-1 min-h-[48px] rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold active:bg-gray-200 transition-colors">取消</button>
              <button onClick={saveTaskEdit}
                className="flex-1 min-h-[48px] rounded-xl bg-blue-600 text-white text-sm font-semibold active:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">保存</button>
            </div>
          </div>
        )}
      </Modal>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <ConfirmDialog
        open={confirmState !== null}
        title={confirmState?.title ?? ''}
        message={confirmState?.message ?? ''}
        destructive={confirmState?.destructive}
        onConfirm={() => { confirmState?.onConfirm(); setConfirmState(null); }}
        onCancel={() => setConfirmState(null)}
      />

      {/* ─── Context menu ─── */}
      {contextMenu && (
        <div className="fixed z-50 bg-white rounded-2xl shadow-xl border border-gray-100 py-1 min-w-[140px] animate-fade-in"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}>
          <button onClick={() => {
            const task = tasks.find((t) => t.id === contextMenu.taskId);
            if (task) openEdit(task);
            setContextMenu(null);
          }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
            编辑
          </button>
          <button onClick={() => { confirmDeleteTask(contextMenu.taskId, contextMenu.taskName); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors text-left">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
            删除
          </button>
        </div>
      )}

      {/* ─── Fullscreen timer overlay ─── */}
      {fullscreenTimer && (
        <Timer
          taskId={fullscreenTimer.taskId}
          taskName={fullscreenTimer.taskName}
          date={fullscreenTimer.date}
          initialStartTime={resumeStart ?? undefined}
          onClose={handleTimerClose}
          onEnd={handleTimerEnd}
        />
      )}
    </div>
      )}

      <SyncAuthModal
        open={showAuth}
        onClose={() => {
          setShowAuth(false);
          if (!username) setPendingHaoxue(false);
        }}
        onSuccess={async () => {
          const s = await getSettings();
          setUsername(s.username);
          await handleSync();
          if (pendingHaoxue) {
            setPendingHaoxue(false);
            setSubFeatureOpen(true);
          }
        }}
      />

      {subFeatureOpen && (
        <HaoxueModule
          username={username}
          onClose={() => setSubFeatureOpen(false)}
          onSwitchAccount={handleSwitchAccount}
        />
      )}
    </>
  );
};

/* helper */
function formatTimeShort(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}分${s}秒`;
  return `${s}秒`;
}
