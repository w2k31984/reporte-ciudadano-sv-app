const hits = new Map<string, number[]>();

const REPORT_WINDOW_MS = 60 * 60 * 1000;
const REPORTS_PER_DEVICE = 5;
const REPORTS_PER_IP = 40;
const CLASSIFY_WINDOW_MS = 60 * 60 * 1000;
const CLASSIFY_PER_IP = 40;

function recentHits(key: string, windowMs: number, now: number) {
  const fresh = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
  hits.set(key, fresh);
  return fresh;
}

function allow(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const fresh = recentHits(key, windowMs, now);
  if (fresh.length >= limit) return false;
  fresh.push(now);
  return true;
}

export function reportAllowed(deviceId: string, ip: string | null) {
  const now = Date.now();
  const deviceHits = recentHits(`report:device:${deviceId}`, REPORT_WINDOW_MS, now);
  const ipHits = ip ? recentHits(`report:ip:${ip}`, REPORT_WINDOW_MS, now) : [];
  return deviceHits.length < REPORTS_PER_DEVICE && ipHits.length < REPORTS_PER_IP;
}

export function rememberReport(deviceId: string, ip: string | null) {
  const now = Date.now();
  recentHits(`report:device:${deviceId}`, REPORT_WINDOW_MS, now).push(now);
  if (ip) recentHits(`report:ip:${ip}`, REPORT_WINDOW_MS, now).push(now);
}

export function allowClassify(ip: string | null) {
  return allow(`classify:${ip ?? "sin-ip"}`, CLASSIFY_PER_IP, CLASSIFY_WINDOW_MS);
}

export function clientIp(headerList: Headers) {
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const last = parts.at(-1);
    if (last) return last.slice(0, 80);
  }

  const realIp = headerList.get("x-real-ip")?.trim();
  return realIp ? realIp.slice(0, 80) : null;
}
