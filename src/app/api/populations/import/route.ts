import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { nextId, withDbMutation } from "@/lib/db";
import type { GemIndexDatabase, PopulationReportRecord } from "@/lib/types";

export const runtime = "nodejs";

const schema = z
  .object({
    grader: z.enum(["PSA", "TAG"]),
    payload: z.unknown().optional(),
    url: z.string().url().optional(),
    replaceExisting: z.boolean().optional(),
  })
  .refine((value) => Boolean(value.payload) || Boolean(value.url), {
    message: "Provide either payload or url.",
  });

type RawPopulationRow = {
  cardExternalId?: string;
  externalId?: string;
  cardId?: string;
  setCode?: string;
  cardNumber?: string | number;
  cardName?: string;
  name?: string;
  totalGraded?: string | number;
  total?: string | number;
  totalPopulation?: string | number;
  grade10?: string | number;
  gemMint10?: string | number;
  tens?: string | number;
  asOfDate?: string;
  date?: string;
};

type NormalizedRow = {
  grader: "PSA" | "TAG";
  cardExternalId?: string;
  setCode?: string;
  cardNumber?: string;
  cardName?: string;
  totalGraded: number;
  grade10: number;
  asOfDate: string;
};

function normalizeLookup(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeString(value: string | number | undefined): string | undefined {
  if (typeof value === "number") {
    return String(value);
  }
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeDate(value: string | undefined): string {
  if (!value) {
    return new Date().toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}

function toNumber(...values: Array<number | string | undefined>): number {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return 0;
}

function unwrapRows(raw: unknown): RawPopulationRow[] {
  if (Array.isArray(raw)) {
    return raw as RawPopulationRow[];
  }

  if (raw && typeof raw === "object") {
    const obj = raw as { items?: unknown; data?: unknown; rows?: unknown };
    if (Array.isArray(obj.items)) {
      return obj.items as RawPopulationRow[];
    }
    if (Array.isArray(obj.data)) {
      return obj.data as RawPopulationRow[];
    }
    if (Array.isArray(obj.rows)) {
      return obj.rows as RawPopulationRow[];
    }
  }

  return [];
}

function normalizeRow(grader: "PSA" | "TAG", raw: RawPopulationRow): NormalizedRow | null {
  const totalGraded = toNumber(raw.totalGraded, raw.total, raw.totalPopulation);
  const grade10 = toNumber(raw.grade10, raw.gemMint10, raw.tens);
  if (totalGraded <= 0) {
    return null;
  }

  return {
    grader,
    cardExternalId: normalizeString(raw.cardExternalId ?? raw.externalId ?? raw.cardId),
    setCode: normalizeString(raw.setCode)?.toLowerCase(),
    cardNumber: normalizeString(raw.cardNumber),
    cardName: normalizeString(raw.cardName ?? raw.name),
    totalGraded,
    grade10: Math.min(grade10, totalGraded),
    asOfDate: normalizeDate(raw.asOfDate ?? raw.date),
  };
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Population feed request failed (${response.status}) for ${url}`);
  }
  return (await response.json()) as unknown;
}

function resolveCardId(db: GemIndexDatabase, row: NormalizedRow): string | null {
  if (row.cardExternalId) {
    const byExternal = db.cards.find((card) => card.externalId === row.cardExternalId);
    if (byExternal) {
      return byExternal.id;
    }
  }

  const targetSetCode = normalizeLookup(row.setCode);
  const targetCardNumber = normalizeLookup(row.cardNumber);
  const targetCardName = normalizeLookup(row.cardName);

  if (!targetSetCode && !targetCardNumber && !targetCardName) {
    return null;
  }

  const matched =
    db.cards.find((card) => {
      const set = db.sets.find((entry) => entry.id === card.setId);
      const setMatches = !targetSetCode || normalizeLookup(set?.code) === targetSetCode;
      const numberMatches = !targetCardNumber || normalizeLookup(card.cardNumber) === targetCardNumber;
      const nameMatches = !targetCardName || normalizeLookup(card.name) === targetCardName;
      return setMatches && numberMatches && nameMatches;
    }) ?? null;

  return matched?.id ?? null;
}

function upsertPopulation(
  db: GemIndexDatabase,
  payload: {
    cardId: string;
    grader: "PSA" | "TAG";
    totalGraded: number;
    grade10: number;
    asOfDate: string;
  },
): { inserted: boolean } {
  const existing = db.populationReports.find(
    (entry) =>
      entry.cardId === payload.cardId &&
      entry.grader === payload.grader &&
      entry.source === payload.grader,
  );

  if (existing) {
    existing.totalGraded = payload.totalGraded;
    existing.grade10 = payload.grade10;
    existing.asOfDate = payload.asOfDate;
    existing.source = payload.grader;
    return { inserted: false };
  }

  const created: PopulationReportRecord = {
    id: nextId("pop"),
    cardId: payload.cardId,
    grader: payload.grader,
    totalGraded: payload.totalGraded,
    grade10: payload.grade10,
    asOfDate: payload.asOfDate,
    source: payload.grader,
  };
  db.populationReports.push(created);
  return { inserted: true };
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

  try {
    const sourcePayload = parse.data.payload ?? (await fetchJson(parse.data.url as string));
    const normalizedRows = unwrapRows(sourcePayload)
      .map((row) => normalizeRow(parse.data.grader, row))
      .filter((row): row is NormalizedRow => Boolean(row));

    const summary = await withDbMutation((db) => {
      if (parse.data.replaceExisting) {
        db.populationReports = db.populationReports.filter(
          (entry) => !(entry.grader === parse.data.grader && entry.source === parse.data.grader),
        );
      }

      let inserted = 0;
      let updated = 0;
      let unmatched = 0;

      normalizedRows.forEach((row) => {
        const cardId = resolveCardId(db, row);
        if (!cardId) {
          unmatched += 1;
          return;
        }

        const result = upsertPopulation(db, {
          cardId,
          grader: row.grader,
          totalGraded: row.totalGraded,
          grade10: row.grade10,
          asOfDate: row.asOfDate,
        });
        if (result.inserted) {
          inserted += 1;
        } else {
          updated += 1;
        }
      });

      db.sync.lastError = undefined;

      return {
        grader: parse.data.grader,
        rowsParsed: normalizedRows.length,
        inserted,
        updated,
        unmatched,
        totalPopulationReports: db.populationReports.length,
      };
    });

    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Population import failed" },
      { status: 400 },
    );
  }
}
