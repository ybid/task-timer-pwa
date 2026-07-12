// 关卡选择：12 关网格，显示解锁 / 通过 / 掌握进度
import { LEVELS, isUnlocked } from '../logic/levels';
import type { EntitiesState } from '../store/useHaoxueStore';

interface Props {
  entities: EntitiesState;
  onStart: (levelId: number) => void;
}

export function Levels({ entities, onStart }: Props) {
  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h2 className="text-heading font-semibold mb-4 text-gray-800">选择关卡</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {LEVELS.map((lv) => {
          const unlocked = isUnlocked(lv.id, entities.progress);
          const passed = entities.progress.levels[lv.id]?.passed;
          const mastered = entities.mastery.byLevel[lv.id]?.stats?.mastered ?? 0;
          const required = lv.coverageSet ? lv.coverageSet.length : 30;
          return (
            <button
              key={lv.id}
              disabled={!unlocked}
              onClick={() => onStart(lv.id)}
              className={`rounded-2xl p-4 text-left border transition-all active:scale-95 ${
                unlocked ? 'bg-white border-gray-200 hover:border-blue-300' : 'bg-gray-100 border-transparent opacity-60'
              } ${passed ? 'ring-2 ring-green-400' : ''}`}
            >
              <div className="text-3xl mb-1">{unlocked ? lv.icon : '🔒'}</div>
              <div className="text-subhead font-medium text-gray-800">{lv.name}</div>
              <div className="text-[11px] text-gray-400 mt-1">
                {passed ? '✓ 已通过' : unlocked ? `掌握 ${mastered}/${required}` : '未解锁'}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
