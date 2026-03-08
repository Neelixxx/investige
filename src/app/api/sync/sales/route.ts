import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { enqueueSyncTask, runWorkerTick } from "@/lib/jobs";
import { logger } from "@/lib/logger";
import { requestIdFromRequest } from "@/lib/observability";
import { featureErrorMessage, hasFeature } from "@/lib/entitlements";

export const runtime = "nodejs";

const schema = z.object({
  pageLimit: z.number().int().min(1).max(200).optional(),
  cardLimit: z.number().int().min(1).max(1000).optional(),
  runNow: z.boolean().optional(),
  provider: z.enum(["POKEMONTCG", "TCGPLAYER_DIRECT"]).optional(),
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
  if (
    parse.data.provider === "TCGPLAYER_DIRECT" &&
    !cronAuthorized &&
    (!user || !hasFeature(user, "DIRECT_TCGPLAYER_SYNC"))
  ) {
    return NextResponse.json(
      { error: user ? featureErrorMessage(user, "DIRECT_TCGPLAYER_SYNC") : "Upgrade required." },
      { status: 402 },
    );
  }

  const task = await enqueueSyncTask({
    type: parse.data.provider === "TCGPLAYER_DIRECT" ? "TCGPLAYER_DIRECT_SYNC" : "SALES_SYNC",
    requestedBy: user?.id ?? "cron",
    options: {
      pageLimit: parse.data.pageLimit,
      cardLimit: parse.data.cardLimit,
    },
  });

  if (parse.data.runNow) {
    const worker = await runWorkerTick({ source: cronAuthorized ? "cron" : "manual" });
    logger.info(
      {
        requestId,
        taskId: task.id,
        provider: parse.data.provider ?? "POKEMONTCG",
        runNow: true,
        worker,
        source: cronAuthorized ? "cron" : "manual",
      },
      "sales sync enqueued",
    );
    return NextResponse.json({ queued: task, worker }, { status: 202 });
  }

  logger.info(
    {
      requestId,
      taskId: task.id,
      provider: parse.data.provider ?? "POKEMONTCG",
      runNow: false,
      source: cronAuthorized ? "cron" : "manual",
    },
    "sales sync enqueued",
  );
  return NextResponse.json({ queued: task }, { status: 202 });
}
