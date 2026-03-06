import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { featureSnapshot, subscriptionStatus, subscriptionTier } from "@/lib/entitlements";
import { sealedSalesFeedStatus } from "@/lib/providers/sealed-sales";
import { ensureSchedulerStarted } from "@/lib/scheduler";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  let user;

  try {
    user = await requireUser(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  ensureSchedulerStarted();

  const db = await readDb();
  const sealedFeed = sealedSalesFeedStatus();
  return NextResponse.json({
    sync: db.sync,
    sealedFeed: {
      configured: sealedFeed.configured,
      mode: sealedFeed.mode,
      target: sealedFeed.target,
      lastImportedCount: db.sync.lastSealedSalesUpserted ?? 0,
      lastSalesSyncAt: db.sync.lastSalesSyncAt,
      lastRunIncludedFeed: Boolean(db.sync.lastSalesProviders?.includes("SEALED_EXTERNAL")),
    },
    totals: {
      sets: db.sets.length,
      cards: db.cards.length,
      sales: db.sales.length,
      populations: db.populationReports.length,
    },
    jobs: {
      configured: db.syncJobs.length,
      queued: db.syncTasks.filter((task) => task.status === "PENDING").length,
      running: db.syncTasks.filter((task) => task.status === "RUNNING").length,
    },
    role: user.role,
    subscription: {
      tier: subscriptionTier(user),
      status: subscriptionStatus(user),
      currentPeriodEnd: user.subscriptionCurrentPeriodEnd,
      trialEndsAt: user.trialEndsAt,
    },
    features: featureSnapshot(user),
  });
}
