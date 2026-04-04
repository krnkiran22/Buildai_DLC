/**
 * Vercel Cron Job — Keep Railway backend alive.
 *
 * This Next.js API route is called by Vercel's cron scheduler every 5 minutes
 * (configured in vercel.json). It pings the Railway backend /ping endpoint so
 * the server never idles long enough to be put to sleep.
 *
 * Vercel Hobby plan supports cron jobs on a daily schedule for free; Vercel Pro
 * supports up to 1-minute granularity. On Hobby the cron below runs as frequently
 * as allowed — adjust the schedule in vercel.json if you upgrade.
 */

import { NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://marvelous-consideration-production.up.railway.app/api/v1";

// Strip /api/v1 suffix to get the root URL for /ping
function rootUrl(base: string): string {
  return base.replace(/\/api\/v1\/?$/, "");
}

export async function GET(request: Request): Promise<NextResponse> {
  // Vercel cron requests include a special header — validate it in production
  // to prevent anyone from calling this route externally too often.
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const target = `${rootUrl(BACKEND_URL)}/ping`;
  let ok = false;
  let status = 0;
  let durationMs = 0;

  try {
    const start = Date.now();
    const res = await fetch(target, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000), // 10-second timeout
    });
    durationMs = Date.now() - start;
    status = res.status;
    ok = res.ok;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, target, error: msg, ts: new Date().toISOString() },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok,
    target,
    backendStatus: status,
    durationMs,
    ts: new Date().toISOString(),
  });
}
