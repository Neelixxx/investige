import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { defaultLookbackForCondition, isPercentCondition } from "@/lib/alerts";
import { requireUser } from "@/lib/auth";
import { readDb, withDbMutation } from "@/lib/db";

export const runtime = "nodejs";

const updateAlertRuleSchema = z
  .object({
    entityLabel: z.string().min(1).max(160).optional(),
    condition: z
      .enum(["PRICE_BELOW", "PRICE_ABOVE", "PCT_CHANGE_UP", "PCT_CHANGE_DOWN"])
      .optional(),
    thresholdValue: z.number().positive().optional(),
    lookbackMonths: z.number().int().min(1).max(24).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const json = await request.json();
  const parse = updateAlertRuleSchema.safeParse(json);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  let user;
  try {
    user = await requireUser(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const payload = parse.data;
  let found = false;

  await withDbMutation((db) => {
    const rule = db.alertRules.find((item) => item.id === id && item.userId === user.id);
    if (!rule) {
      return;
    }

    found = true;
    if (payload.entityLabel !== undefined) {
      rule.entityLabel = payload.entityLabel;
    }
    if (payload.condition !== undefined) {
      rule.condition = payload.condition;
      if (!isPercentCondition(payload.condition)) {
        rule.lookbackMonths = undefined;
      } else if (!rule.lookbackMonths) {
        rule.lookbackMonths = defaultLookbackForCondition(payload.condition);
      }
      rule.lastConditionMet = false;
    }
    if (payload.thresholdValue !== undefined) {
      rule.thresholdValue = payload.thresholdValue;
      rule.lastConditionMet = false;
    }
    if (payload.lookbackMonths !== undefined) {
      rule.lookbackMonths = payload.lookbackMonths;
      rule.lastConditionMet = false;
    }
    if (payload.enabled !== undefined) {
      rule.enabled = payload.enabled;
      if (!payload.enabled) {
        rule.lastConditionMet = false;
      }
    }
    rule.updatedAt = new Date().toISOString();
  });

  if (!found) {
    return NextResponse.json({ error: "Alert rule not found" }, { status: 404 });
  }

  const db = await readDb(true);
  return NextResponse.json({
    rules: db.alertRules
      .filter((item) => item.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  let user;
  try {
    user = await requireUser(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  let removed = false;
  await withDbMutation((db) => {
    const beforeRules = db.alertRules.length;
    db.alertRules = db.alertRules.filter((item) => !(item.id === id && item.userId === user.id));
    removed = db.alertRules.length < beforeRules;
    if (removed) {
      db.alertEvents = db.alertEvents.filter((item) => item.ruleId !== id || item.userId !== user.id);
    }
  });

  if (!removed) {
    return NextResponse.json({ error: "Alert rule not found" }, { status: 404 });
  }

  const db = await readDb(true);
  return NextResponse.json({
    rules: db.alertRules
      .filter((item) => item.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  });
}
