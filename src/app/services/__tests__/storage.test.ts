import { describe, expect, it } from 'vitest';
import {
  createDefaultSave,
  normalizeSave,
  SaveStore,
  type KVStore,
} from '../storage';

class MemoryStore implements KVStore {
  private readonly data = new Map<string, string>();

  get(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.data.set(key, value);
  }

  remove(key: string): void {
    this.data.delete(key);
  }
}

describe('normalizeSave', () => {
  it('returns defaults for invalid data', () => {
    expect(normalizeSave(null)).toEqual(createDefaultSave());
    expect(normalizeSave('nope')).toEqual(createDefaultSave());
    expect(normalizeSave({ version: 2 })).toEqual(createDefaultSave());
  });

  it('keeps valid progress and fills missing settings', () => {
    const save = normalizeSave({
      version: 1,
      unlockedLevel: 7,
      completedLevelIds: [1, 2, 3, 3],
      settings: { sound: false },
    });
    expect(save.unlockedLevel).toBe(7);
    expect(save.completedLevelIds).toEqual([1, 2, 3]);
    expect(save.settings).toEqual({ sound: false, music: true, haptic: true });
  });

  it('drops invalid entries', () => {
    const save = normalizeSave({
      version: 1,
      unlockedLevel: -3,
      completedLevelIds: [1, 'x', 2.5, 0],
      settings: { sound: 'yes', music: null, haptic: false },
    });
    expect(save.unlockedLevel).toBe(1);
    expect(save.completedLevelIds).toEqual([1]);
    expect(save.settings).toEqual({ sound: true, music: true, haptic: false });
  });
});

describe('SaveStore', () => {
  it('round-trips through the key-value store', () => {
    const kv = new MemoryStore();
    const store = new SaveStore(kv, 'test');
    const data = { ...createDefaultSave(), unlockedLevel: 5 };
    store.save(data);
    expect(store.load()).toEqual(data);
  });

  it('falls back to defaults when the stored value is corrupt', () => {
    const kv = new MemoryStore();
    kv.set('test', '{not json');
    const store = new SaveStore(kv, 'test');
    expect(store.load()).toEqual(createDefaultSave());
  });

  it('resets to defaults', () => {
    const kv = new MemoryStore();
    const store = new SaveStore(kv, 'test');
    store.save({ ...createDefaultSave(), unlockedLevel: 9 });
    store.reset();
    expect(store.load()).toEqual(createDefaultSave());
  });
});
