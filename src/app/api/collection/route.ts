import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { nextId, readDb, withDbMutation } from "@/lib/db";
import { featureErrorMessage, hasFeature } from "@/lib/entitlements";
import { enrichCollection } from "@/lib/selectors";

export const runtime = "nodejs";

const RAW_CONDITIONS = ["NM", "LP", "HP", "DMG"] as const;
type RawCondition = (typeof RAW_CONDITIONS)[number];

function normalizeRawCondition(condition?: RawCondition): RawCondition {
  return condition ?? "NM";
}

const collectionSchema = z.object({
  portfolioId: z.string().optional(),
  cardId: z.string(),
  ownershipType: z.enum(["RAW", "GRADED"]),
  rawCondition: z.enum(RAW_CONDITIONS).optional(),
  grader: z.enum(["PSA", "TAG"]).optional(),
  grade: z.number().int().min(1).max(10).optional(),
  certificationNumber: z.string().max(64).optional(),
  quantity: z.number().int().min(1).default(1),
  acquisitionPriceUsd: z.number().nonnegative().optional(),
  notes: z.string().max(240).optional(),
});

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireUser(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasFeature(user, "PORTFOLIO_TRACKING")) {
    return NextResponse.json(
      { error: featureErrorMessage(user, "PORTFOLIO_TRACKING") },
      { status: 402 },
    );
  }
  const db = await readDb();
  return NextResponse.json({ items: enrichCollection(db, user.id) });
}

export async function POST(request: NextRequest) {
  const json = await request.json();
  const parse = collectionSchema.safeParse(json);

  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  const payload = parse.data;
  const rawCondition = payload.ownershipType === "RAW" ? normalizeRawCondition(payload.rawCondition) : undefined;
  let user;
  try {
    user = await requireUser(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasFeature(user, "PORTFOLIO_TRACKING")) {
    return NextResponse.json(
      { error: featureErrorMessage(user, "PORTFOLIO_TRACKING") },
      { status: 402 },
    );
  }

  try {
    await withDbMutation((db) => {
      const targetPortfolioId =
        (payload.portfolioId &&
        db.portfolios.some((portfolio) => portfolio.id === payload.portfolioId && portfolio.userId === user.id))
          ? payload.portfolioId
          : db.portfolios.find((portfolio) => portfolio.userId === user.id)?.id;
      if (!targetPortfolioId) {
        throw new Error("No portfolio is available for this account.");
      }

      const existing = db.collectionItems.find(
        (item) =>
          item.userId === user.id &&
          item.portfolioId === targetPortfolioId &&
          item.cardId === payload.cardId &&
          item.ownershipType === payload.ownershipType &&
          (payload.ownershipType === "RAW"
            ? normalizeRawCondition(item.rawCondition) === rawCondition
            : true) &&
          (item.grader ?? null) === (payload.grader ?? null) &&
          (item.grade ?? null) === (payload.grade ?? null) &&
          (item.certificationNumber ?? null) === (payload.certificationNumber ?? null),
      );

      if (existing) {
        existing.quantity += payload.quantity;
        if (payload.ownershipType === "RAW") {
          existing.rawCondition = rawCondition;
        }
        if (payload.acquisitionPriceUsd !== undefined) {
          existing.acquisitionPriceUsd = payload.acquisitionPriceUsd;
        }
        if (payload.notes) {
          existing.notes = payload.notes;
        }
        return;
      }

      db.collectionItems.push({
        id: nextId("collection"),
        userId: user.id,
        portfolioId: targetPortfolioId,
        cardId: payload.cardId,
        ownershipType: payload.ownershipType,
        rawCondition,
        grader: payload.grader,
        grade: payload.grade,
        certificationNumber: payload.certificationNumber,
        quantity: payload.quantity,
        acquisitionPriceUsd: payload.acquisitionPriceUsd,
        acquiredAt: new Date().toISOString(),
        notes: payload.notes,
      });
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to add collection item." },
      { status: 400 },
    );
  }

  const db = await readDb(true);
  return NextResponse.json({ items: enrichCollection(db, user.id) }, { status: 201 });
}
