import { nextId } from "./db";
import { ensureSealedProductRecord, matchSealedProduct } from "./sealed-products";
import type { GemIndexDatabase, SealedSaleRecord, SealedProductType } from "./types";

export interface SealedSaleInput {
  productId?: string;
  setId?: string;
  productName?: string;
  productType?: SealedProductType;
  priceUsd: number;
  saleDate: string;
  source?: string;
  providerRef?: string;
  provider?: "SEED" | "MANUAL" | "INGESTED";
  currency?: string;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"") {
      if (inQuotes && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  out.push(current);
  return out.map((value) => value.trim());
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

export function parseSealedSalesCsv(csv: string): SealedSaleInput[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length <= 1) {
    return [];
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase());
  return lines.slice(1).flatMap((line) => {
    const values = splitCsvLine(line);
    const row = new Map<string, string>();
    headers.forEach((header, index) => {
      row.set(header, values[index] ?? "");
    });

    const priceUsd = Number(row.get("priceusd") ?? row.get("price_usd") ?? "");
    const rawSaleDate = row.get("saledate") ?? row.get("sale_date") ?? "";
    const saleDate = /^\d{4}-\d{2}-\d{2}$/.test(rawSaleDate)
      ? `${rawSaleDate}T00:00:00.000Z`
      : rawSaleDate;
    if (!Number.isFinite(priceUsd) || priceUsd <= 0 || !saleDate) {
      return [];
    }

    const productType = (row.get("producttype") ?? row.get("product_type") ?? "").toUpperCase();
    return [
      {
        productId: row.get("productid") ?? row.get("product_id") ?? undefined,
        setId: row.get("setid") ?? row.get("set_id") ?? undefined,
        productName: row.get("productname") ?? row.get("product_name") ?? undefined,
        productType: productType
          ? (productType as SealedProductType)
          : undefined,
        priceUsd,
        saleDate,
        source: row.get("source") ?? undefined,
        providerRef: row.get("providerref") ?? row.get("provider_ref") ?? undefined,
        provider: "INGESTED",
        currency: row.get("currency") ?? "USD",
      },
    ];
  });
}

export function sealedSalesToCsv(
  rows: Array<{
    id: string;
    productId: string;
    productName: string;
    productType: string;
    setCode: string;
    setName: string;
    priceUsd: number;
    saleDate: string;
    source?: string;
    provider?: string;
    providerRef?: string;
    currency?: string;
  }>,
): string {
  const headers = [
    "id",
    "productId",
    "productName",
    "productType",
    "setCode",
    "setName",
    "priceUsd",
    "saleDate",
    "source",
    "provider",
    "providerRef",
    "currency",
  ];
  const lines = rows.map((row) =>
    [
      row.id,
      row.productId,
      row.productName,
      row.productType,
      row.setCode,
      row.setName,
      row.priceUsd.toString(),
      row.saleDate,
      row.source ?? "",
      row.provider ?? "",
      row.providerRef ?? "",
      row.currency ?? "",
    ]
      .map((value) => csvEscape(value))
      .join(","),
  );

  return [headers.join(","), ...lines].join("\n");
}

export function upsertSealedSale(
  db: GemIndexDatabase,
  input: SealedSaleInput,
): { inserted: boolean; sale?: SealedSaleRecord } {
  const product =
    matchSealedProduct(db, {
      productId: input.productId,
      setId: input.setId,
      productName: input.productName,
      productType: input.productType,
    }) ??
    (input.setId && input.productName && input.productType
      ? ensureSealedProductRecord(db, {
          setId: input.setId,
          productName: input.productName,
          productType: input.productType,
          source: "MANUAL",
        })
      : null);

  if (!product) {
    throw new Error("Unknown sealed product.");
  }

  const existing = db.sealedSales.find(
    (sale) =>
      (input.providerRef && sale.providerRef === input.providerRef) ||
      (sale.productId === product.id &&
        sale.saleDate === input.saleDate &&
        sale.priceUsd === input.priceUsd),
  );
  if (existing) {
    return { inserted: false, sale: existing };
  }

  const created: SealedSaleRecord = {
    id: nextId("sealed_sale"),
    productId: product.id,
    priceUsd: input.priceUsd,
    saleDate: input.saleDate,
    source: input.source ?? "manual-sealed-admin",
    provider: input.provider ?? "MANUAL",
    providerRef: input.providerRef,
    currency: input.currency ?? "USD",
  };
  db.sealedSales.push(created);
  return { inserted: true, sale: created };
}
