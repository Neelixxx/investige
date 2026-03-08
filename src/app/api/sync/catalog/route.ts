import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { enqueueSyncTask, runWorkerTick } from "@/lib/jobs";
import { logger } from "@/lib/logger";
import { requestIdFromRequest } from "@/lib/observability";
import { featureErrorMessage, hasFeature } from "@/lib/entitlements";

export const runtime = "nodejs";

const schema = z.object({
  pageLimit: z.number().int().min(1).max(200).optional(),
  runNow: z.boolean().optional(),
});

function isCronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }
  const header = request.headers.get("x-cron-secret");
  const query = request.nextUrl.searchParams.get("token");
  return header === secret || query === secret;
}

export async function POST(request: NextRequest) {
  const requestId = requestIdFromRequest(request);
  const cronAuthorized = isCronAuthorized(request);
  let user: Awaited<ReturnType<typeof requireAdmin>> | null = null;

  if (!cronAuthorized) {
    try {
      user = await requireAdmin(request);
    } catch (error) {
      if (error instanceof Error && error.message === "FORBIDDEN") {
        return NextResponse.json({ error: "Admin access required." }, { status: 403 });
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user || !hasFeature(user, "LIVE_SYNC_QUEUE")) {
      return NextResponse.json(
        { error: user ? featureErrorMessage(user, "LIVE_SYNC_QUEUE") : "Upgrade required." },
        { status: 402 },
      );
    }
  }

  const json = await request.json().catch(() => ({}));
  const parse = schema.safeParse(json);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  const task = await enqueueSyncTask({
    type: "CATALOG_SYNC",
    requestedBy: user?.id ?? "cron",
    options: { pageLimit: parse.data.pageLimit },
  });

  if (parse.data.runNow) {
    const worker = await runWorkerTick({ source: cronAuthorized ? "cron" : "manual" });
    const db = await readDb(true);
    const completedTask =
      db.syncTasks.find((entry) => entry.id === task.id) ?? null;
    logger.info(
      { requestId, taskId: task.id, runNow: true, worker, source: cronAuthorized ? "cron" : "manual" },
      "catalog sync enqueued",
    );
    return NextResponse.json({ queued: task, worker, completedTask }, { status: 202 });
  }

  logger.info(
    { requestId, taskId: task.id, runNow: false, source: cronAuthorized ? "cron" : "manual" },
    "catalog sync enqueued",
  );
  return NextResponse.json({ queued: task }, { status: 202 });
}
