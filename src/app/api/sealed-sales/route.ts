import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { readDb, withDbMutation } from "@/lib/db";
import { parseSealedSalesCsv, sealedSalesToCsv, upsertSealedSale } from "@/lib/sealed-sales";
import { listSealedSales } from "@/lib/selectors";

export const runtime = "nodejs";

const productTypeEnum = z.enum([
  "BOOSTER_BOX",
  "ELITE_TRAINER_BOX",
  "COLLECTION_BOX",
  "TIN",
  "BLISTER",
  "OTHER",
]);

const createSchema = z
  .object({
    productId: z.string().min(1).optional(),
    setId: z.string().optional(),
    productName: z.string().min(2).optional(),
    productType: productTypeEnum.optional(),
    priceUsd: z.number().positive(),
    saleDate: z.string().datetime(),
    source: z.string().max(120).optional(),
    providerRef: z.string().max(160).optional(),
    provider: z.enum(["SEED", "MANUAL", "INGESTED"]).optional(),
    currency: z.string().max(12).optional(),
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

const updateSchema = z.object({
  id: z.string().min(1),
  priceUsd: z.number().positive(),
  saleDate: z.string().datetime(),
  source: z.string().max(120).optional(),
  providerRef: z.string().max(160).optional(),
});

const deleteSchema = z.object({
  id: z.string().min(1),
});

async function ensureAdmin(request: NextRequest) {
  try {
    return await requireAdmin(request);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      throw new Error("FORBIDDEN");
    }
    throw new Error("UNAUTHORIZED");
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureAdmin(request);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await readDb();
  const items = listSealedSales(db, 250);
  if (request.nextUrl.searchParams.get("format") === "csv") {
    return new NextResponse(sealedSalesToCsv(items), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="gemindex-sealed-sales.csv"',
      },
    });
  }
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  try {
    await ensureAdmin(request);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let parsedItems:
    | Array<z.infer<typeof createSchema>>
    | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "CSV file is required." }, { status: 400 });
    }
    const csv = await file.text();
    const source = typeof formData.get("source") === "string" ? String(formData.get("source")) : undefined;
    const provider = typeof formData.get("provider") === "string" ? String(formData.get("provider")) : undefined;
    parsedItems = parseSealedSalesCsv(csv).map((item) => ({
      ...item,
      source: item.source ?? source,
      providerRef: item.providerRef,
      provider:
        provider === "SEED" || provider === "MANUAL" || provider === "INGESTED"
          ? provider
          : item.provider,
      currency: item.currency,
    })) as Array<z.infer<typeof createSchema>>;
  } else if (contentType.includes("text/csv")) {
    const csv = await request.text();
    parsedItems = parseSealedSalesCsv(csv) as Array<z.infer<typeof createSchema>>;
  } else {
    const json = await request.json().catch(() => ({}));
    const parse = createSchema.safeParse(json);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
    }
    parsedItems = [parse.data];
  }

  if (!parsedItems?.length) {
    return NextResponse.json({ error: "No valid sealed sales were found in the import." }, { status: 400 });
  }

  try {
    await withDbMutation((db) => {
      let inserted = 0;
      parsedItems?.forEach((payload) => {
        const parsed = createSchema.safeParse(payload);
        if (!parsed.success) {
          return;
        }
        const result = upsertSealedSale(db, {
          ...parsed.data,
          provider:
            parsed.data.provider === "SEED" ||
            parsed.data.provider === "MANUAL" ||
            parsed.data.provider === "INGESTED"
              ? parsed.data.provider
              : "MANUAL",
          currency: parsed.data.currency ?? "USD",
        });
        if (result.inserted) {
          inserted += 1;
        }
      });
      if (inserted === 0) {
        throw new Error("No new sealed sale rows were inserted.");
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to add sealed sale." },
      { status: 400 },
    );
  }

  const db = await readDb(true);
  return NextResponse.json({ items: listSealedSales(db, 250) }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureAdmin(request);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => ({}));
  const parse = updateSchema.safeParse(json);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  const updated = await withDbMutation((db) => {
    const item = db.sealedSales.find((entry) => entry.id === parse.data.id);
    if (!item) {
      return false;
    }

    item.priceUsd = parse.data.priceUsd;
    item.saleDate = parse.data.saleDate;
    item.source = parse.data.source;
    item.providerRef = parse.data.providerRef;
    item.provider = item.provider ?? "MANUAL";
    item.currency = item.currency ?? "USD";
    return true;
  });

  if (!updated) {
    return NextResponse.json({ error: "Sealed sale not found." }, { status: 404 });
  }

  const db = await readDb(true);
  return NextResponse.json({ items: listSealedSales(db, 250) });
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureAdmin(request);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => ({}));
  const parse = deleteSchema.safeParse(json);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  const removed = await withDbMutation((db) => {
    const nextItems = db.sealedSales.filter((entry) => entry.id !== parse.data.id);
    if (nextItems.length === db.sealedSales.length) {
      return false;
    }
    db.sealedSales = nextItems;
    return true;
  });

  if (!removed) {
    return NextResponse.json({ error: "Sealed sale not found." }, { status: 404 });
  }

  const db = await readDb(true);
  return NextResponse.json({ items: listSealedSales(db, 250) });
}
