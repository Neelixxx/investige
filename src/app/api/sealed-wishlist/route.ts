import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { nextId, readDb, withDbMutation } from "@/lib/db";
import { featureErrorMessage, hasFeature } from "@/lib/entitlements";
import { ensureSealedProductRecord, matchSealedProduct } from "@/lib/sealed-products";
import { enrichSealedWishlist } from "@/lib/selectors";

export const runtime = "nodejs";

const productTypeEnum = z.enum([
  "BOOSTER_BOX",
  "ELITE_TRAINER_BOX",
  "COLLECTION_BOX",
  "TIN",
  "BLISTER",
  "OTHER",
]);

const sealedWishlistSchema = z
  .object({
    productId: z.string().min(1).optional(),
    setId: z.string().optional(),
    productName: z.string().min(2).optional(),
    productType: productTypeEnum.optional(),
    targetPriceUsd: z.number().nonnegative().optional(),
    priority: z.number().int().min(1).max(5).default(2),
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

const sealedWishlistUpdateSchema = z.object({
  id: z.string().min(1),
  targetPriceUsd: z.number().nonnegative().optional(),
  priority: z.number().int().min(1).max(5),
  notes: z.string().max(240).optional(),
});

const sealedWishlistDeleteSchema = z.object({
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
  return NextResponse.json({ items: enrichSealedWishlist(db, user.id) });
}

export async function POST(request: NextRequest) {
  const json = await request.json();
  const parse = sealedWishlistSchema.safeParse(json);

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
              marketValueUsd: payload.targetPriceUsd,
              source: "MANUAL",
            })
          : null);

      if (!product) {
        throw new Error("Unknown sealed product.");
      }

      const existing = db.sealedWishlistItems.find(
        (item) => item.userId === user.id && item.productId === product.id,
      );

      if (existing) {
        existing.targetPriceUsd = payload.targetPriceUsd ?? existing.targetPriceUsd;
        existing.priority = payload.priority;
        existing.notes = payload.notes ?? existing.notes;
        return;
      }

      db.sealedWishlistItems.push({
        id: nextId("sealed_wishlist"),
        userId: user.id,
        productId: product.id,
        setId: product.setId,
        productName: product.productName,
        productType: product.productType,
        targetPriceUsd: payload.targetPriceUsd,
        priority: payload.priority,
        createdAt: new Date().toISOString(),
        notes: payload.notes,
      });
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to add sealed wishlist item." },
      { status: 400 },
    );
  }

  const db = await readDb(true);
  return NextResponse.json({ items: enrichSealedWishlist(db, user.id) }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const json = await request.json();
  const parse = sealedWishlistUpdateSchema.safeParse(json);

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
    const item = db.sealedWishlistItems.find(
      (entry) => entry.id === payload.id && entry.userId === user.id,
    );
    if (!item) {
      return false;
    }

    item.targetPriceUsd = payload.targetPriceUsd;
    item.priority = payload.priority;
    item.notes = payload.notes;
    return true;
  });

  if (!updated) {
    return NextResponse.json({ error: "Sealed wishlist item not found." }, { status: 404 });
  }

  const db = await readDb(true);
  return NextResponse.json({ items: enrichSealedWishlist(db, user.id) });
}

export async function DELETE(request: NextRequest) {
  const json = await request.json();
  const parse = sealedWishlistDeleteSchema.safeParse(json);

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
    const nextItems = db.sealedWishlistItems.filter(
      (entry) => !(entry.id === payload.id && entry.userId === user.id),
    );
    if (nextItems.length === db.sealedWishlistItems.length) {
      return false;
    }
    db.sealedWishlistItems = nextItems;
    return true;
  });

  if (!removed) {
    return NextResponse.json({ error: "Sealed wishlist item not found." }, { status: 404 });
  }

  const db = await readDb(true);
  return NextResponse.json({ items: enrichSealedWishlist(db, user.id) });
}
