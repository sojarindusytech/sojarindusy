import "server-only";
import { headers } from "next/headers";

// ponytail: per-instance memory. On serverless each instance keeps its own counters, so this blunts
// scripted abuse but is not a global limit; move to a shared store (Redis / a DB table) if needed.
const hits = new Map<string, number[]>();

export const AUTH_LIMITS = {
  login: { max: 8, windowMs: 10 * 60_000 },
  signup: { max: 5, windowMs: 60 * 60_000 },
  /** Anything that sends an email (reset, resend): protects inboxes and the email quota. */
  email: { max: 3, windowMs: 15 * 60_000 },
} as const;

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

/**
 * Sliding-window limit per action and per caller (the IP, plus the target email when given).
 * True = allowed.
 */
export async function allowAuthAttempt(action: keyof typeof AUTH_LIMITS, email?: string): Promise<boolean> {
  const { max, windowMs } = AUTH_LIMITS[action];
  const ip = await clientIp();
  const keys = [`${action}|ip|${ip}`, ...(email ? [`${action}|email|${email.toLowerCase()}`] : [])];
  const now = Date.now();
  let allowed = true;
  for (const key of keys) {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) allowed = false;
    else recent.push(now);
    hits.set(key, recent);
  }
  // Keep the map from growing without bound.
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < 60 * 60_000)) hits.delete(k);
  return allowed;
}

export const TOO_MANY_ATTEMPTS = "Too many attempts. Please wait a few minutes and try again.";
