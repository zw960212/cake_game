import type { ItemConfig } from '../core/types';

export const gameConfig = {
  designWidth: 750,
  saveKey: 'cake_sort_save_v1',
  items: {
    freeHintsPerAttempt: 1,
    freeBowlsPerAttempt: 1,
    rewardAmount: 1,
    maxExtraBowls: 2,
  } satisfies ItemConfig,
  ads: {
    mock: true,
    rewardedAdUnitId: '',
  },
  solver: {
    hintMaxNodes: 200_000,
    hintTimeMs: 300,
  },
  animation: {
    pourMs: 250,
    undoMs: 200,
  },
};
