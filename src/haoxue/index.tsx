// haoxue 子模块根组件：顶部工具栏 + 页面切换 + 同步按钮
// 与任务系统共用同一登录账号（无独立"切换孩子"），顶部统一 同步 / 切换账号
import { useState } from 'react';
import { useHaoxueStore } from './store/useHaoxueStore';
import { Home } from './components/Home';
import { Levels } from './components/Levels';
import { Training } from './components/Training';
import { ParentPanel } from './components/ParentPanel';
import { syncNow } from './sync/bridge';

type Page = 'home' | 'levels' | 'training' | 'report';

interface Props {
  username: string | null;
  onClose: () => void;
  onSwitchAccount: () => void;
}

export function HaoxueModule({ username, onClose, onSwitchAccount }: Props) {
  const store = useHaoxueStore();
  const [page, setPage] = useState<Page>('home');
  const [trainingLevel, setTrainingLevel] = useState<number | null>(null);

  if (store.loading || !store.entities) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-50 flex items-center justify-center text-gray-400">
        加载中…
      </div>
    );
  }

  const openTraining = (id: number) => {
    setTrainingLevel(id);
    setPage('training');
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
      {page !== 'training' && page !== 'report' && (
        <div className="flex items-center gap-2 px-4 h-14 bg-white/90 backdrop-blur-md border-b border-gray-200/80">
          <button
            onClick={onClose}
            className="min-h-[40px] px-2 rounded-xl text-gray-500 active:bg-gray-100 text-sm"
          >
            ‹ 返回
          </button>
          <span className="text-subhead font-semibold text-gray-800">口算训练</span>
          <div className="ml-auto flex items-center gap-2">
            {username && <span className="text-xs text-gray-400 hidden sm:inline">{username}</span>}
            <button
              onClick={() => setPage('report')}
              className="min-h-[40px] px-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium active:bg-gray-200 transition-colors"
              title="家长面板"
            >
              📊 报告
            </button>
            <SyncButton />
            <button
              onClick={onSwitchAccount}
              className="min-h-[40px] px-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium active:bg-gray-200 transition-colors"
              title="切换账号"
            >
              切换账号
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {page === 'home' && (
          <Home
            entities={store.entities}
            username={username}
            onStartLevel={openTraining}
            onOpenLevels={() => setPage('levels')}
          />
        )}
        {page === 'levels' && <Levels entities={store.entities} onStart={openTraining} />}
        {page === 'training' && trainingLevel !== null && (
          <Training
            levelId={trainingLevel}
            entities={store.entities}
            update={store.update}
            onExit={() => setPage('home')}
          />
        )}
        {page === 'report' && (
          <ParentPanel
            entities={store.entities}
            onStartLevel={openTraining}
            onBack={() => setPage('home')}
          />
        )}
      </div>
    </div>
  );
}

function SyncButton() {
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const doSync = async () => {
    setSyncing(true);
    const r = await syncNow();
    setSyncing(false);
    if (r.needsAuth) setMsg('请先在主界面登录');
    else if (r.ok) setMsg('已同步');
    else setMsg(r.error ?? '失败');
    setTimeout(() => setMsg(null), 2000);
  };

  return (
    <div className="relative">
      <button
        onClick={doSync}
        disabled={syncing}
        className="min-h-[40px] px-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium active:bg-gray-200 transition-colors disabled:opacity-50"
      >
        {syncing ? '同步中…' : '同步'}
      </button>
      {msg && (
        <div className="absolute right-0 top-11 whitespace-nowrap bg-gray-800 text-white text-xs px-2 py-1 rounded-lg z-10">
          {msg}
        </div>
      )}
    </div>
  );
}
