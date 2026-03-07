import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { nextId, withDbMutation } from "@/lib/db";
import type { GemIndexDatabase, PopulationReportRecord } from "@/lib/types";

export const runtime = "nodejs";

const schema = z.object({
  certNumbers: z.array(z.string().trim().min(1)).min(1).max(200),
  replaceExisting: z.boolean().optional(),
});

type ParsedPsaPopulation = {
  certNumber: string;
  cardExternalId?: string;
  setCode?: string;
  setName?: string;
  cardNumber?: string;
  cardName?: string;
  totalGraded: number;
  grade10: number;
  asOfDate: string;
};

function normalizeLookup(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function parseDate(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    return new Date().toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function flattenObjects(value: unknown, out: Array<Record<string, unknown>>): void {
  if (!value) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => flattenObjects(entry, out));
    return;
  }

  if (typeof value === "object") {
    const row = value as Record<string, unknown>;
    out.push(row);
    Object.values(row).forEach((entry) => flattenObjects(entry, out));
  }
}

function indexKeys(row: Record<string, unknown>): Record<string, unknown> {
  const indexed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    indexed[key.toLowerCase()] = value;
  }
  return indexed;
}

function pick(row: Record<string, unknown>, keys: string[]): unknown {
  const byLower = indexKeys(row);
  for (const key of keys) {
    if (key.toLowerCase() in byLower) {
      return byLower[key.toLowerCase()];
    }
  }
  return undefined;
}

function parsePsaResponse(certNumber: string, payload: unknown): ParsedPsaPopulation | null {
  const candidates: Array<Record<string, unknown>> = [];
  flattenObjects(payload, candidates);

  for (const row of candidates) {
    const totalGraded =
      toNumber(
        pick(row, [
          "totalGraded",
          "totalPopulation",
          "populationTotal",
          "population",
          "totalPop",
        ]),
      ) ?? 0;
    if (totalGraded <= 0) {
      continue;
    }

    const grade10 =
      toNumber(
        pick(row, [
          "grade10",
          "gemMint10",
          "gemMint",
          "gm10",
          "tens",
          "total10",
        ]),
      ) ?? 0;

    return {
      certNumber,
      cardExternalId: asString(pick(row, ["cardExternalId", "externalId", "cardId"])),
      setCode: asString(pick(row, ["setCode", "setId"]))?.toLowerCase(),
      setName: asString(pick(row, ["setName", "set", "issue"])),
      cardNumber: asString(pick(row, ["cardNumber", "number", "cardNo", "specNo"])),
      cardName: asString(pick(row, ["cardName", "subject", "title", "name", "description"])),
      totalGraded,
      grade10: Math.min(grade10, totalGraded),
      asOfDate: parseDate(pick(row, ["asOfDate", "updatedAt", "lastUpdated", "gradedDate"])),
    };
  }

  return null;
}

function resolveCardId(db: GemIndexDatabase, row: ParsedPsaPopulation): string | null {
  if (row.cardExternalId) {
    const byExternal = db.cards.find((card) => card.externalId === row.cardExternalId);
    if (byExternal) {
      return byExternal.id;
    }
  }

  const setCode = normalizeLookup(row.setCode);
  const setName = normalizeLookup(row.setName);
  const cardNumber = normalizeLookup(row.cardNumber);
  const cardName = normalizeLookup(row.cardName);

  if (!setCode && !setName && !cardNumber && !cardName) {
    return null;
  }

  const matched =
    db.cards.find((card) => {
      const set = db.sets.find((entry) => entry.id === card.setId);
      const setCodeMatches = !setCode || normalizeLookup(set?.code) === setCode;
      const setNameMatches = !setName || normalizeLookup(set?.name).includes(setName);
      const cardNumberMatches = !cardNumber || normalizeLookup(card.cardNumber) === cardNumber;
      const cardNameMatches = !cardName || normalizeLookup(card.name).includes(cardName);
      return setCodeMatches && setNameMatches && cardNumberMatches && cardNameMatches;
    }) ?? null;

  return matched?.id ?? null;
}

function upsertPopulation(
  db: GemIndexDatabase,
  payload: {
    cardId: string;
    totalGraded: number;
    grade10: number;
    asOfDate: string;
  },
): { inserted: boolean } {
  const existing = db.populationReports.find(
    (entry) =>
      entry.cardId === payload.cardId &&
      entry.grader === "PSA" &&
      entry.source === "PSA",
  );

  if (existing) {
    existing.totalGraded = payload.totalGraded;
    existing.grade10 = payload.grade10;
    existing.asOfDate = payload.asOfDate;
    existing.source = "PSA";
    return { inserted: false };
  }

  const created: PopulationReportRecord = {
    id: nextId("pop"),
    cardId: payload.cardId,
    grader: "PSA",
    totalGraded: payload.totalGraded,
    grade10: payload.grade10,
    asOfDate: payload.asOfDate,
    source: "PSA",
  };
  db.populationReports.push(created);
  return { inserted: true };
}

function bearerToken(): string | null {
  const raw = process.env.PSA_API_BEARER_TOKEN?.trim();
  if (!raw) {
    return null;
  }
  return raw.toLowerCase().startsWith("bearer ") ? raw : `Bearer ${raw}`;
}

async function fetchPsaCert(certNumber: string): Promise<unknown> {
  const token = bearerToken();
  if (!token) {
    throw new Error("PSA_API_BEARER_TOKEN is not configured.");
  }

  const base = (process.env.PSA_API_BASE_URL ?? "https://api.psacard.com").replace(/\/+$/, "");
  const url = `${base}/publicapi/cert/GetByCertNumber/${encodeURIComponent(certNumber)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: token,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`PSA cert request failed (${response.status}) for cert ${certNumber}`);
  }

  return (await response.json()) as unknown;
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parse = schema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  const certNumbers = [...new Set(parse.data.certNumbers.map((entry) => entry.trim()).filter(Boolean))];
  const rows: ParsedPsaPopulation[] = [];
  const errors: Array<{ certNumber: string; error: string }> = [];

  for (const certNumber of certNumbers) {
    try {
      const payload = await fetchPsaCert(certNumber);
      const parsedRow = parsePsaResponse(certNumber, payload);
      if (!parsedRow) {
        errors.push({
          certNumber,
          error: "No usable population values were found in PSA response.",
        });
        continue;
      }
      rows.push(parsedRow);
    } catch (error) {
      errors.push({
        certNumber,
        error: error instanceof Error ? error.message : "PSA request failed",
      });
    }
  }

  const summary = await withDbMutation((db) => {
    if (parse.data.replaceExisting) {
      db.populationReports = db.populationReports.filter(
        (entry) => !(entry.grader === "PSA" && entry.source === "PSA"),
      );
    }

    let inserted = 0;
    let updated = 0;
    let unmatched = 0;

    rows.forEach((row) => {
      const cardId = resolveCardId(db, row);
      if (!cardId) {
        unmatched += 1;
        return;
      }
      const out = upsertPopulation(db, {
        cardId,
        totalGraded: row.totalGraded,
        grade10: row.grade10,
        asOfDate: row.asOfDate,
      });
      if (out.inserted) {
        inserted += 1;
      } else {
        updated += 1;
      }
    });

    return {
      certsRequested: certNumbers.length,
      certsParsed: rows.length,
      inserted,
      updated,
      unmatched,
      failed: errors.length,
      totalPopulationReports: db.populationReports.length,
      errors: errors.slice(0, 25),
    };
  });

  return NextResponse.json(summary, { status: 200 });
}
