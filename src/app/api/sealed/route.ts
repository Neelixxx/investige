import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { nextId, readDb, withDbMutation } from "@/lib/db";
import { featureErrorMessage, hasFeature } from "@/lib/entitlements";
import { ensureSealedProductRecord, matchSealedProduct } from "@/lib/sealed-products";
import { enrichSealed } from "@/lib/selectors";

export const runtime = "nodejs";

const productTypeEnum = z.enum([
  "BOOSTER_BOX",
  "ELITE_TRAINER_BOX",
  "COLLECTION_BOX",
  "TIN",
  "BLISTER",
  "OTHER",
]);

const sealedSchema = z
  .object({
    portfolioId: z.string().optional(),
    productId: z.string().min(1).optional(),
    setId: z.string().optional(),
    productName: z.string().min(2).optional(),
    productType: productTypeEnum.optional(),
    grader: z.enum(["PSA", "TAG"]).optional(),
    grade: z.number().int().min(1).max(10).optional(),
    certificationNumber: z.string().max(64).optional(),
    quantity: z.number().int().min(1).default(1),
    acquisitionPriceUsd: z.number().nonnegative().optional(),
    estimatedValueUsd: z.number().nonnegative().optional(),
    notes: z.string().max(240).optional(),
  })
  .superRefine((value, context) => {
    if (value.productId) {
      return;
    }

    if (!value.setId || !value.productName || !value.productType) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide productId or setId + productName + productType.",
        path: ["productId"],
      });
    }
  });

const sealedUpdateSchema = z.object({
  id: z.string().min(1),
  quantity: z.number().int().min(1),
  acquisitionPriceUsd: z.number().nonnegative().optional(),
  estimatedValueUsd: z.number().nonnegative().optional(),
  notes: z.string().max(240).optional(),
});

const sealedDeleteSchema = z.object({
  id: z.string().min(1),
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
  return NextResponse.json({ items: enrichSealed(db, user.id) });
}

export async function POST(request: NextRequest) {
  const json = await request.json();
  const parse = sealedSchema.safeParse(json);

  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  const payload = parse.data;
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

      const product =
        matchSealedProduct(db, {
          productId: payload.productId,
          setId: payload.setId,
          productName: payload.productName,
          productType: payload.productType,
        }) ??
        (payload.setId && payload.productName && payload.productType
          ? ensureSealedProductRecord(db, {
              setId: payload.setId,
              productName: payload.productName,
              productType: payload.productType,
              marketValueUsd: payload.estimatedValueUsd,
              source: "MANUAL",
            })
          : null);

      if (!product) {
        throw new Error("Unknown sealed product.");
      }

      const existing = db.sealedInventoryItems.find(
        (item) =>
          item.userId === user.id &&
          item.portfolioId === targetPortfolioId &&
          item.productId === product.id &&
          (item.grader ?? null) === (payload.grader ?? null) &&
          (item.grade ?? null) === (payload.grade ?? null) &&
          (item.certificationNumber ?? null) === (payload.certificationNumber ?? null),
      );

      if (existing) {
        existing.quantity += payload.quantity;
        existing.acquisitionPriceUsd = payload.acquisitionPriceUsd ?? existing.acquisitionPriceUsd;
        existing.estimatedValueUsd = payload.estimatedValueUsd ?? existing.estimatedValueUsd;
        existing.notes = payload.notes ?? existing.notes;
        return;
      }

      db.sealedInventoryItems.push({
        id: nextId("sealed"),
        userId: user.id,
        portfolioId: targetPortfolioId,
        productId: product.id,
        setId: product.setId,
        productName: product.productName,
        productType: product.productType,
        grader: payload.grader,
        grade: payload.grade,
        certificationNumber: payload.certificationNumber,
        quantity: payload.quantity,
        acquisitionPriceUsd: payload.acquisitionPriceUsd,
        estimatedValueUsd: payload.estimatedValueUsd,
        acquiredAt: new Date().toISOString(),
        notes: payload.notes,
      });
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to add sealed product." },
      { status: 400 },
    );
  }

  const db = await readDb(true);
  return NextResponse.json({ items: enrichSealed(db, user.id) }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const json = await request.json();
  const parse = sealedUpdateSchema.safeParse(json);

  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

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

  const payload = parse.data;
  const updated = await withDbMutation((db) => {
    const item = db.sealedInventoryItems.find(
      (entry) => entry.id === payload.id && entry.userId === user.id,
    );
    if (!item) {
      return false;
    }

    item.quantity = payload.quantity;
    item.acquisitionPriceUsd = payload.acquisitionPriceUsd;
    item.estimatedValueUsd = payload.estimatedValueUsd;
    item.notes = payload.notes;
    return true;
  });

  if (!updated) {
    return NextResponse.json({ error: "Sealed item not found." }, { status: 404 });
  }

  const db = await readDb(true);
  return NextResponse.json({ items: enrichSealed(db, user.id) });
}

export async function DELETE(request: NextRequest) {
  const json = await request.json();
  const parse = sealedDeleteSchema.safeParse(json);

  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

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

  const payload = parse.data;
  const removed = await withDbMutation((db) => {
    const nextItems = db.sealedInventoryItems.filter(
      (entry) => !(entry.id === payload.id && entry.userId === user.id),
    );
    if (nextItems.length === db.sealedInventoryItems.length) {
      return false;
    }
    db.sealedInventoryItems = nextItems;
    return true;
  });

  if (!removed) {
    return NextResponse.json({ error: "Sealed item not found." }, { status: 404 });
  }

  const db = await readDb(true);
  return NextResponse.json({ items: enrichSealed(db, user.id) });
}
