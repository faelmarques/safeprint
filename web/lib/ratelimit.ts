// Rate limit em memória por IP (por processo). Em multi-instância usar Redis/Upstash.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(req: Request, key: string, limit: number, windowMs: number): { ok: boolean; retryAfter?: number } {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const k = `${key}:${ip}`;
  const now = Date.now();
  const b = buckets.get(k);
  if (!b || b.resetAt < now) {
    buckets.set(k, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  b.count += 1;
  if (b.count > limit) return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  return { ok: true };
}
