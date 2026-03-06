import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { sealedMarketSeries, sealedProductMetrics } from "@/lib/analytics";
import { requireAdmin, requireUser } from "@/lib/auth";
import { nextId, readDb, withDbMutation } from "@/lib/db";
import { featureErrorMessage, hasFeature } from "@/lib/entitlements";
import { ensureSealedProductRecord, matchSealedProduct } from "@/lib/sealed-products";
import { listSealedProducts } from "@/lib/selectors";

export const runtime = "nodejs";

const productTypeEnum = z.enum([
  "BOOSTER_BOX",
  "ELITE_TRAINER_BOX",
  "COLLECTION_BOX",
  "TIN",
  "BLISTER",
  "OTHER",
]);

const ingestSchema = z.object({
  items: z.array(
    z
      .object({
        productId: z.string().min(1).optional(),
        setId: z.string().optional(),
        productName: z.string().min(2).optional(),
        productType: productTypeEnum.optional(),
        priceUsd: z.number().positive(),
        saleDate: z.string().datetime(),
        source: z.string().max(120).optional(),
        providerRef: z.string().max(160).optional(),
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
      }),
  ).min(1).max(500),
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
  return NextResponse.json({
    items: listSealedProducts(db).map((item) => ({
      ...item,
      series: sealedMarketSeries(db, item.id, user.id),
      metrics: sealedProductMetrics(db, item.id, user.id),
    })),
  });
}

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAdmin(request);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasFeature(user, "LIVE_SYNC_QUEUE")) {
    return NextResponse.json(
      { error: featureErrorMessage(user, "LIVE_SYNC_QUEUE") },
      { status: 402 },
    );
  }

  const json = await request.json().catch(() => ({}));
  const parse = ingestSchema.safeParse(json);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  const inserted = await withDbMutation((db) => {
    let count = 0;

    parse.data.items.forEach((entry) => {
      const product =
        matchSealedProduct(db, {
          productId: entry.productId,
          setId: entry.setId,
          productName: entry.productName,
          productType: entry.productType,
        }) ??
        (entry.setId && entry.productName && entry.productType
          ? ensureSealedProductRecord(db, {
              setId: entry.setId,
              productName: entry.productName,
              productType: entry.productType,
              source: "MANUAL",
            })
          : null);

      if (!product) {
        return;
      }

      const exists = db.sealedSales.find(
        (sale) =>
          (entry.providerRef && sale.providerRef === entry.providerRef) ||
          (
            sale.productId === product.id &&
            sale.saleDate === entry.saleDate &&
            sale.priceUsd === entry.priceUsd
          ),
      );
      if (exists) {
        return;
      }

      db.sealedSales.push({
        id: nextId("sealed_sale"),
        productId: product.id,
        priceUsd: entry.priceUsd,
        saleDate: entry.saleDate,
        source: entry.source ?? "manual-sealed-ingest",
        provider: "INGESTED",
        providerRef: entry.providerRef,
        currency: "USD",
      });
      count += 1;
    });

    return count;
  });

  const db = await readDb(true);
  return NextResponse.json({
    inserted,
    total: db.sealedSales.length,
  });
}
