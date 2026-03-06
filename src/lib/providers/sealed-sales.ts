import { readFile } from "node:fs/promises";
import path from "node:path";

import { parseSealedSalesCsv, type SealedSaleInput } from "../sealed-sales";
import type { SealedProductType } from "../types";

type RawSealedSale = {
  productId?: string;
  setId?: string;
  productName?: string;
  productType?: string;
  priceUsd?: number | string;
  saleDate?: string;
  source?: string;
  providerRef?: string;
  currency?: string;
};

function parseTimeoutMs(): number {
  const raw = Number(process.env.SEALED_SALES_FEED_TIMEOUT_MS ?? "12000");
  if (!Number.isFinite(raw) || raw < 1000) {
    return 12000;
  }
  return raw;
}

function normalizeType(value: string | undefined): SealedProductType | undefined {
  const normalized = (value ?? "").trim().toUpperCase().replace(/[^A-Z]+/g, "_").replace(/(^_|_$)/g, "");
  if (
    normalized === "BOOSTER_BOX" ||
    normalized === "ELITE_TRAINER_BOX" ||
    normalized === "COLLECTION_BOX" ||
    normalized === "TIN" ||
    normalized === "BLISTER" ||
    normalized === "OTHER"
  ) {
    return normalized;
  }
  return undefined;
}

function normalizeJsonRows(payload: unknown): SealedSaleInput[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object"
      ? ((payload as { items?: unknown; data?: unknown; rows?: unknown }).items ??
          (payload as { data?: unknown }).data ??
          (payload as { rows?: unknown }).rows)
      : [];

  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.flatMap((entry) => {
    const row = entry as RawSealedSale;
    const priceUsd = Number(row.priceUsd);
    const saleDate = row.saleDate;
    if (!Number.isFinite(priceUsd) || priceUsd <= 0 || !saleDate) {
      return [];
    }

    return [
      {
        productId: row.productId,
        setId: row.setId,
        productName: row.productName,
        productType: normalizeType(row.productType),
        priceUsd,
        saleDate: /^\d{4}-\d{2}-\d{2}$/.test(saleDate) ? `${saleDate}T00:00:00.000Z` : saleDate,
        source: row.source ?? "external-sealed-feed",
        providerRef: row.providerRef,
        provider: "INGESTED" as const,
        currency: row.currency ?? "USD",
      },
    ];
  });
}

async function readConfiguredFeed(): Promise<{ body: string; contentType: string }> {
  const filePath = process.env.SEALED_SALES_FEED_FILE;
  if (filePath) {
    const body = await readFile(filePath, "utf8");
    const contentType = filePath.toLowerCase().endsWith(".csv") ? "text/csv" : "application/json";
    return { body, contentType };
  }

  const url = process.env.SEALED_SALES_FEED_URL;
  if (!url) {
    return { body: "", contentType: "" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), parseTimeoutMs());
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json, text/csv;q=0.9, text/plain;q=0.8" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Sealed sales feed request failed (${response.status})`);
    }
    return {
      body: await response.text(),
      contentType: response.headers.get("content-type") ?? "",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function sealedSalesFeedStatus(): {
  configured: boolean;
  mode: "FILE" | "URL" | "NONE";
  target?: string;
} {
  const filePath = process.env.SEALED_SALES_FEED_FILE?.trim();
  if (filePath) {
    return {
      configured: true,
      mode: "FILE",
      target: path.basename(filePath),
    };
  }

  const url = process.env.SEALED_SALES_FEED_URL?.trim();
  if (url) {
    try {
      const parsed = new URL(url);
      return {
        configured: true,
        mode: "URL",
        target: parsed.host || parsed.origin,
      };
    } catch {
      return {
        configured: true,
        mode: "URL",
        target: url,
      };
    }
  }

  return {
    configured: false,
    mode: "NONE",
  };
}

export async function fetchLiveSealedSales(): Promise<SealedSaleInput[]> {
  const { body, contentType } = await readConfiguredFeed();
  if (!body.trim()) {
    return [];
  }

  if (contentType.includes("csv") || (!contentType && body.includes(",") && body.includes("\n"))) {
    return parseSealedSalesCsv(body).map((entry) => ({
      ...entry,
      source: entry.source ?? "external-sealed-feed",
      provider: "INGESTED",
      currency: entry.currency ?? "USD",
    }));
  }

  const parsed = JSON.parse(body) as unknown;
  return normalizeJsonRows(parsed);
}
