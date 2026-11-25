export class HapticsService {
  constructor(private enabled = true) {}

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  light(): void {
    if (
      !this.enabled ||
      typeof wx === 'undefined' ||
      typeof wx.vibrateShort !== 'function'
    ) {
      return;
    }
    try {
      const result = wx.vibrateShort({ type: 'light', fail: () => {} });
      if (result && typeof result.catch === 'function') {
        result.catch(() => {});
      }
    } catch {
      // 部分机型不支持轻震动，忽略即可
    }
  }
}
