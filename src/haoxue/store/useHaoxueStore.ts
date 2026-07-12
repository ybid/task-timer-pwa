// haoxue React 状态层：加载当前 profile 实体、提供类型安全更新并触发云同步。
import { useCallback, useEffect, useState } from 'react';
import {
  createProfile,
  ENTITY_KEYS,
  getEntity,
  loadProfiles,
  removeProfile,
  setEntity,
  switchProfile,
  type EntityKey,
} from './profiles';
import { scheduleSync } from '../sync/bridge';
import type {
  Achievements,
  Challenges,
  Daily,
  ErrorSets,
  Errors,
  HaoxueSettings,
  Mastery,
  ProfileData,
  ProfileMeta,
  ProfilesList,
  Progress,
  SmartStats,
} from '../types';

export interface EntitiesState {
  profile: ProfileData;
  settings: HaoxueSettings;
  progress: Progress;
  mastery: Mastery;
  errorSets: ErrorSets;
  errors: Errors;
  achievements: Achievements;
  challenges: Challenges;
  daily: Daily;
  smartStats: SmartStats;
}

export function useHaoxueStore() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ProfilesList | null>(null);
  const [entities, setEntities] = useState<EntitiesState | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async (pid: string) => {
    const obj: Partial<EntitiesState> = {};
    for (const key of ENTITY_KEYS) {
      (obj as Record<string, unknown>)[key] = await getEntity(pid, key as EntityKey);
    }
    setEntities(obj as EntitiesState);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await loadProfiles();
      if (!alive) return;
      setProfiles(list);
      setActiveId(list.activeProfileId);
      await loadAll(list.activeProfileId);
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [loadAll]);

  const update = useCallback(
    async <K extends keyof EntitiesState>(key: K, value: EntitiesState[K]) => {
      if (!activeId) return;
      await setEntity(activeId, key as EntityKey, value);
      setEntities((prev) => (prev ? { ...prev, [key]: value } : prev));
      scheduleSync();
    },
    [activeId],
  );

  const refresh = useCallback(async () => {
    if (activeId) await loadAll(activeId);
  }, [activeId, loadAll]);

  const switchTo = useCallback(
    async (id: string) => {
      const list = await switchProfile(id);
      setProfiles(list);
      setActiveId(list.activeProfileId);
      await loadAll(list.activeProfileId);
    },
    [loadAll],
  );

  const create = useCallback(
    async (name: string, avatar: string) => {
      const list = await createProfile(name, avatar);
      setProfiles(list);
      setActiveId(list.activeProfileId);
      await loadAll(list.activeProfileId);
    },
    [loadAll],
  );

  const remove = useCallback(
    async (id: string) => {
      const list = await removeProfile(id);
      setProfiles(list);
      setActiveId(list.activeProfileId);
      await loadAll(list.activeProfileId);
    },
    [loadAll],
  );

  const activeProfile: ProfileMeta | null = profiles?.list.find((p) => p.id === activeId) ?? null;

  return { activeId, profiles, activeProfile, entities, loading, update, refresh, switchTo, create, remove };
}
