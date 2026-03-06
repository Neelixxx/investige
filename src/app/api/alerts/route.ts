import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { defaultLookbackForCondition, evaluateAlertsForUser, validAlertEntity } from "@/lib/alerts";
import { requireUser } from "@/lib/auth";
import { nextId, readDb, withDbMutation } from "@/lib/db";

export const runtime = "nodejs";

const createAlertRuleSchema = z.object({
  entityType: z.enum(["CARD", "SEALED_PRODUCT", "SET"]),
  entityId: z.string().min(1),
  entityLabel: z.string().min(1).max(160),
  condition: z.enum(["PRICE_BELOW", "PRICE_ABOVE", "PCT_CHANGE_UP", "PCT_CHANGE_DOWN"]),
  thresholdValue: z.number().positive(),
  lookbackMonths: z.number().int().min(1).max(24).optional(),
  enabled: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireUser(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload:
    | { rules: unknown[]; events: unknown[]; unreadCount: number; newlyTriggered: number }
    | null = null;
  await withDbMutation((db) => {
    payload = evaluateAlertsForUser(db, user.id);
  });

  return NextResponse.json(payload ?? { rules: [], events: [], unreadCount: 0, newlyTriggered: 0 });
}

export async function POST(request: NextRequest) {
  const json = await request.json();
  const parse = createAlertRuleSchema.safeParse(json);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  let user;
  try {
    user = await requireUser(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = parse.data;
  let exists = false;

  await withDbMutation((db) => {
    if (!validAlertEntity(payload.entityType, payload.entityId, db)) {
      return;
    }
    exists = true;
    db.alertRules.push({
      id: nextId("alert_rule"),
      userId: user.id,
      entityType: payload.entityType,
      entityId: payload.entityId,
      entityLabel: payload.entityLabel,
      condition: payload.condition,
      thresholdValue: payload.thresholdValue,
      lookbackMonths:
        payload.lookbackMonths ??
        defaultLookbackForCondition(payload.condition),
      enabled: payload.enabled ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastConditionMet: false,
    });
    evaluateAlertsForUser(db, user.id);
  });

  if (!exists) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }

  const db = await readDb(true);
  const rules = db.alertRules
    .filter((item) => item.userId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const events = db.alertEvents
    .filter((item) => item.userId === user.id)
    .sort((a, b) => b.triggeredAt.localeCompare(a.triggeredAt));
  return NextResponse.json(
    { rules, events, unreadCount: events.filter((item) => !item.readAt).length, newlyTriggered: 0 },
    { status: 201 },
  );
}
