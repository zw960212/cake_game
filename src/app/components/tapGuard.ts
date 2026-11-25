let suppressedUntil = 0;

export function suppressTaps(durationMs = 250): void {
  suppressedUntil = Math.max(suppressedUntil, Date.now() + durationMs);
}

export function tapsSuppressed(): boolean {
  return Date.now() < suppressedUntil;
}
