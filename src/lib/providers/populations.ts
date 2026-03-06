import { readFile } from "node:fs/promises";

type FeedGrader = "PSA" | "TAG";

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

export type LivePopulationRecord = {
  grader: FeedGrader;
  cardExternalId?: string;
  setCode?: string;
  cardNumber?: string;
  cardName?: string;
  totalGraded: number;
  grade10: number;
  asOfDate: string;
};

function sourceUrl(grader: FeedGrader): string | null {
  return process.env[`${grader}_POPULATION_FEED_URL`] ?? null;
}

function sourceFile(grader: FeedGrader): string | null {
  return process.env[`${grader}_POPULATION_FEED_FILE`] ?? null;
}

function timeoutMs(): number {
  const raw = Number(process.env.POPULATION_FEED_TIMEOUT_MS ?? "10000");
  if (!Number.isFinite(raw) || raw < 1000 || raw > 60000) {
    return 10000;
  }
  return Math.floor(raw);
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

function normalizeString(value: string | number | undefined): string | undefined {
  if (typeof value === "number") {
    return String(value);
  }

  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function unwrapRows(raw: unknown): RawPopulationRow[] {
  if (Array.isArray(raw)) {
    return raw as RawPopulationRow[];
  }

  if (raw && typeof raw === "object") {
    const source = raw as { items?: unknown; data?: unknown; rows?: unknown };
    if (Array.isArray(source.items)) {
      return source.items as RawPopulationRow[];
    }
    if (Array.isArray(source.data)) {
      return source.data as RawPopulationRow[];
    }
    if (Array.isArray(source.rows)) {
      return source.rows as RawPopulationRow[];
    }
  }

  return [];
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Population feed request failed (${response.status}) for ${url}`);
    }

    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

async function loadFeed(grader: FeedGrader): Promise<unknown> {
  const file = sourceFile(grader);
  if (file) {
    const raw = await readFile(file, "utf8");
    return JSON.parse(raw) as unknown;
  }

  const url = sourceUrl(grader);
  if (url) {
    return fetchJson(url);
  }

  return [];
}

function normalizeRow(grader: FeedGrader, raw: RawPopulationRow): LivePopulationRecord | null {
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

export async function fetchLivePopulationReports(): Promise<LivePopulationRecord[]> {
  const graders: FeedGrader[] = ["PSA", "TAG"];
  const results = await Promise.all(
    graders.map(async (grader) => {
      const payload = await loadFeed(grader);
      return unwrapRows(payload)
        .map((row) => normalizeRow(grader, row))
        .filter((row): row is LivePopulationRecord => Boolean(row));
    }),
  );

  return results.flat();
}
