import { isRecord } from '../../utils/validate';

export interface SaveSettings {
  sound: boolean;
  music: boolean;
  haptic: boolean;
}

export interface SaveData {
  version: 1;
  unlockedLevel: number;
  completedLevelIds: number[];
  settings: SaveSettings;
}

export interface KVStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export function createDefaultSave(): SaveData {
  return {
    version: 1,
    unlockedLevel: 1,
    completedLevelIds: [],
    settings: { sound: true, music: true, haptic: true },
  };
}

export function normalizeSave(raw: unknown): SaveData {
  const save = createDefaultSave();
  if (!isRecord(raw) || raw.version !== 1) return save;

  if (
    typeof raw.unlockedLevel === 'number' &&
    Number.isInteger(raw.unlockedLevel) &&
    raw.unlockedLevel >= 1
  ) {
    save.unlockedLevel = raw.unlockedLevel;
  }

  if (Array.isArray(raw.completedLevelIds)) {
    const ids = raw.completedLevelIds.filter(
      (value): value is number =>
        typeof value === 'number' && Number.isInteger(value) && value >= 1,
    );
    save.completedLevelIds = [...new Set(ids)].sort((a, b) => a - b);
  }

  if (isRecord(raw.settings)) {
    const settings = raw.settings;
    if (typeof settings.sound === 'boolean') save.settings.sound = settings.sound;
    if (typeof settings.music === 'boolean') save.settings.music = settings.music;
    if (typeof settings.haptic === 'boolean') save.settings.haptic = settings.haptic;
  }

  return save;
}

export class SaveStore {
  constructor(
    private readonly kv: KVStore,
    private readonly key: string,
  ) {}

  load(): SaveData {
    try {
      const raw = this.kv.get(this.key);
      if (typeof raw !== 'string' || raw === '') return createDefaultSave();
      return normalizeSave(JSON.parse(raw));
    } catch {
      return createDefaultSave();
    }
  }

  save(data: SaveData): void {
    this.kv.set(this.key, JSON.stringify(data));
  }

  reset(): void {
    this.kv.remove(this.key);
  }
}

export function createWxStore(): KVStore {
  return {
    get: key => {
      const value = wx.getStorageSync(key);
      return typeof value === 'string' && value.length > 0 ? value : null;
    },
    set: (key, value) => wx.setStorageSync(key, value),
    remove: key => wx.removeStorageSync(key),
  };
}
