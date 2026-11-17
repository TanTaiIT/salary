// Giới hạn tần suất theo cửa sổ cố định, lưu trong bộ nhớ.
// Khi chạy nhiều instance, chuyển sang lưu bằng Redis.
export class RateLimiter {
  readonly limit: number;
  readonly windowMs: number;
  #hits = new Map<string, { count: number; resetAt: number }>();
  #timer: NodeJS.Timeout;

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.#timer = setInterval(() => this.#sweep(), windowMs);
    this.#timer.unref();
  }

  hit(key: string, now = Date.now()): { allowed: boolean; remaining: number; resetAt: number } {
    let entry = this.#hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + this.windowMs };
      this.#hits.set(key, entry);
    }
    entry.count++;
    return { allowed: entry.count <= this.limit, remaining: Math.max(0, this.limit - entry.count), resetAt: entry.resetAt };
  }

  #sweep(now = Date.now()): void {
    for (const [k, v] of this.#hits) if (v.resetAt <= now) this.#hits.delete(k);
  }

  close(): void {
    clearInterval(this.#timer);
  }
}
