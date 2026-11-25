export type AdResult = 'rewarded' | 'closed' | 'error';

export interface AdService {
  isReady(): boolean;
  showRewarded(): Promise<AdResult>;
}

export interface AdsConfig {
  mock: boolean;
  rewardedAdUnitId: string;
}

export class MockAdService implements AdService {
  constructor(
    private readonly delayMs = 300,
    private readonly result: AdResult = 'rewarded',
  ) {}

  isReady(): boolean {
    return true;
  }

  showRewarded(): Promise<AdResult> {
    return new Promise(resolve => {
      setTimeout(() => resolve(this.result), this.delayMs);
    });
  }
}

class WechatAdService implements AdService {
  private readonly ad: any;
  private pending: ((result: AdResult) => void) | null = null;

  constructor(unitId: string) {
    this.ad = wx.createRewardedVideoAd({ adUnitId: unitId });
    this.ad.onClose((result: { isEnded?: boolean } | undefined) => {
      this.finish(!result || result.isEnded ? 'rewarded' : 'closed');
    });
    this.ad.onError(() => this.finish('error'));
  }

  isReady(): boolean {
    return true;
  }

  showRewarded(): Promise<AdResult> {
    return new Promise(resolve => {
      this.pending = resolve;
      this.ad.show().catch(() => {
        this.ad
          .load()
          .then(() => this.ad.show())
          .catch(() => this.finish('error'));
      });
    });
  }

  private finish(result: AdResult): void {
    const pending = this.pending;
    this.pending = null;
    if (pending) pending(result);
  }
}

export function createAdService(config: AdsConfig): AdService {
  if (
    config.mock ||
    !config.rewardedAdUnitId ||
    typeof wx === 'undefined' ||
    typeof wx.createRewardedVideoAd !== 'function'
  ) {
    return new MockAdService();
  }
  return new WechatAdService(config.rewardedAdUnitId);
}
