export class AnalyticsService {
  track(_event: string, _payload?: Record<string, unknown>): void {
    // MVP 不接埋点，保留接口供后续接入
  }
}
