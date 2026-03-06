import { nextId, withDbMutation } from "./db";
import { fetchLivePopulationReports } from "./providers/populations";
import { fetchLiveCards, fetchLiveSets } from "./providers/pokemon-tcg";
import { fetchLiveSealedSales } from "./providers/sealed-sales";
import { syncDirectTcgplayerPrices } from "./providers/tcgplayer-direct";
import { upsertSealedSale } from "./sealed-sales";
import type {
  CardRecord,
  GemIndexDatabase,
  PokemonSetRecord,
  PopulationReportRecord,
  SaleRecord,
  SyncJobType,
} from "./types";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function todayKey(value: string): string {
  return value.slice(0, 10);
}

function makeId(prefix: string, value: string): string {
  return `${prefix}_${value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;
}

function resolveEurToUsdRate(): number {
  const raw = Number(process.env.EUR_TO_USD_RATE ?? "1.08");
  if (!Number.isFinite(raw) || raw <= 0) {
    return 1.08;
  }
  return raw;
}

function upsertSet(
  db: GemIndexDatabase,
  payload: {
    externalId: string;
    code: string;
    name: string;
    series?: string;
    releaseDate: string;
    printedTotal?: number;
    total?: number;
    symbolUrl?: string;
    logoUrl?: string;
    lastSyncedAt: string;
  },
): PokemonSetRecord {
  const existing = db.sets.find(
    (set) =>
      set.externalId === payload.externalId ||
      (set.source === "POKEMONTCG" && set.code === payload.code),
  );

  if (existing) {
    existing.code = payload.code;
    existing.name = payload.name;
    existing.series = payload.series;
    existing.releaseDate = payload.releaseDate;
    existing.printedTotal = payload.printedTotal;
    existing.total = payload.total;
    existing.symbolUrl = payload.symbolUrl;
    existing.logoUrl = payload.logoUrl;
    existing.lastSyncedAt = payload.lastSyncedAt;
    existing.externalId = payload.externalId;
    existing.source = "POKEMONTCG";
    return existing;
  }

  const created: PokemonSetRecord = {
    id: makeId("set", `ptcg-${payload.code}`),
    code: payload.code,
    name: payload.name,
    series: payload.series,
    releaseDate: payload.releaseDate,
    printedTotal: payload.printedTotal,
    total: payload.total,
    symbolUrl: payload.symbolUrl,
    logoUrl: payload.logoUrl,
    lastSyncedAt: payload.lastSyncedAt,
    source: "POKEMONTCG",
    externalId: payload.externalId,
  };

  db.sets.push(created);
  return created;
}

function upsertCard(
  db: GemIndexDatabase,
  setId: string,
  payload: {
    externalId: string;
    name: string;
    cardNumber: string;
    rarity: string;
    imageUrl?: string;
    imageLargeUrl?: string;
    supertype?: string;
    subtypes?: string[];
    tcgplayerUrl?: string;
    cardmarketUrl?: string;
    lastSyncedAt: string;
  },
): CardRecord {
  const existing = db.cards.find(
    (card) =>
      card.externalId === payload.externalId ||
      (card.setId === setId && card.cardNumber === payload.cardNumber && card.name === payload.name),
  );

  if (existing) {
    existing.setId = setId;
    existing.name = payload.name;
    existing.cardNumber = payload.cardNumber;
    existing.rarity = payload.rarity;
    existing.imageUrl = payload.imageUrl;
    existing.imageLargeUrl = payload.imageLargeUrl;
    existing.supertype = payload.supertype;
    existing.subtypes = payload.subtypes;
    existing.tcgplayerUrl = payload.tcgplayerUrl;
    existing.cardmarketUrl = payload.cardmarketUrl;
    existing.externalId = payload.externalId;
    existing.source = "POKEMONTCG";
    existing.lastSyncedAt = payload.lastSyncedAt;
    return existing;
  }

  const created: CardRecord = {
    id: makeId("card", `ptcg-${payload.externalId}`),
    setId,
    name: payload.name,
    cardNumber: payload.cardNumber,
    rarity: payload.rarity,
    imageUrl: payload.imageUrl,
    imageLargeUrl: payload.imageLargeUrl,
    supertype: payload.supertype,
    subtypes: payload.subtypes,
    tcgplayerUrl: payload.tcgplayerUrl,
    cardmarketUrl: payload.cardmarketUrl,
    source: "POKEMONTCG",
    externalId: payload.externalId,
    lastSyncedAt: payload.lastSyncedAt,
  };

  db.cards.push(created);
  return created;
}

function upsertSale(db: GemIndexDatabase, sale: SaleRecord): void {
  if (!sale.providerRef) {
    db.sales.push(sale);
    return;
  }

  const existing = db.sales.find((entry) => entry.providerRef === sale.providerRef);
  if (existing) {
    existing.priceUsd = sale.priceUsd;
    existing.saleDate = sale.saleDate;
    existing.source = sale.source;
    existing.currency = sale.currency;
    existing.provider = sale.provider;
    return;
  }

  db.sales.push(sale);
}

function normalizeLookup(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function resolveCardForPopulation(
  db: GemIndexDatabase,
  payload: {
    cardExternalId?: string;
    setCode?: string;
    cardNumber?: string;
    cardName?: string;
  },
): CardRecord | null {
  if (payload.cardExternalId) {
    const byExternal = db.cards.find((card) => card.externalId === payload.cardExternalId);
    if (byExternal) {
      return byExternal;
    }
  }

  const targetSetCode = normalizeLookup(payload.setCode);
  const targetCardNumber = normalizeLookup(payload.cardNumber);
  const targetCardName = normalizeLookup(payload.cardName);

  if (!targetSetCode && !targetCardNumber && !targetCardName) {
    return null;
  }

  return (
    db.cards.find((card) => {
      const set = db.sets.find((entry) => entry.id === card.setId);
      const setMatches = !targetSetCode || normalizeLookup(set?.code) === targetSetCode;
      const numberMatches = !targetCardNumber || normalizeLookup(card.cardNumber) === targetCardNumber;
      const nameMatches = !targetCardName || normalizeLookup(card.name) === targetCardName;
      return setMatches && numberMatches && nameMatches;
    }) ?? null
  );
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
): PopulationReportRecord {
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
    return existing;
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
  return created;
}

export async function syncLiveCatalog(options?: { pageLimit?: number }): Promise<{
  setsUpserted: number;
  cardsUpserted: number;
  tcgplayerSalesUpserted: number;
  cardmarketSalesUpserted: number;
  populationReportsUpserted: number;
  psaPopulationReportsUpserted: number;
  tagPopulationReportsUpserted: number;
}> {
  const [liveSets, liveCards, livePopulationReports] = await Promise.all([
    fetchLiveSets(),
    fetchLiveCards(options?.pageLimit),
    fetchLivePopulationReports(),
  ]);

  const eurToUsd = resolveEurToUsdRate();

  return withDbMutation((db) => {
    const setIdByExternal = new Map<string, string>();

    liveSets.forEach((liveSet) => {
      const setRecord = upsertSet(db, liveSet);
      setIdByExternal.set(liveSet.externalId, setRecord.id);
    });

    let tcgplayerSalesUpserted = 0;
    let cardmarketSalesUpserted = 0;
    let populationReportsUpserted = 0;
    let psaPopulationReportsUpserted = 0;
    let tagPopulationReportsUpserted = 0;

    liveCards.forEach((liveCard) => {
      const setId = setIdByExternal.get(liveCard.setExternalId);
      if (!setId) {
        return;
      }

      const card = upsertCard(db, setId, {
        externalId: liveCard.externalId,
        name: liveCard.name,
        cardNumber: liveCard.cardNumber,
        rarity: liveCard.rarity,
        imageUrl: liveCard.imageUrl,
        imageLargeUrl: liveCard.imageLargeUrl,
        supertype: liveCard.supertype,
        subtypes: liveCard.subtypes,
        tcgplayerUrl: liveCard.tcgplayerUrl,
        cardmarketUrl: liveCard.cardmarketUrl,
        lastSyncedAt: liveCard.priceAsOf,
      });

      if (typeof liveCard.tcgplayerRawUsd === "number" && liveCard.tcgplayerRawUsd > 0) {
        const day = todayKey(liveCard.priceAsOf);
        upsertSale(db, {
          id: nextId("sale"),
          cardId: card.id,
          condition: "RAW",
          priceUsd: round2(liveCard.tcgplayerRawUsd),
          saleDate: liveCard.priceAsOf,
          source: "PokemonTCG API - TCGplayer",
          provider: "POKEMONTCG_TCGPLAYER",
          providerRef: `ptcg_tcgplayer:${liveCard.externalId}:${day}`,
          currency: "USD",
        });
        tcgplayerSalesUpserted += 1;
      }

      if (typeof liveCard.cardmarketRawEur === "number" && liveCard.cardmarketRawEur > 0) {
        const day = todayKey(liveCard.priceAsOf);
        upsertSale(db, {
          id: nextId("sale"),
          cardId: card.id,
          condition: "RAW",
          priceUsd: round2(liveCard.cardmarketRawEur * eurToUsd),
          saleDate: liveCard.priceAsOf,
          source: "PokemonTCG API - Cardmarket",
          provider: "POKEMONTCG_CARDMARKET",
          providerRef: `ptcg_cardmarket:${liveCard.externalId}:${day}`,
          currency: "EUR",
        });
        cardmarketSalesUpserted += 1;
      }
    });

    livePopulationReports.forEach((report) => {
      const card = resolveCardForPopulation(db, report);
      if (!card) {
        return;
      }

      upsertPopulation(db, {
        cardId: card.id,
        grader: report.grader,
        totalGraded: report.totalGraded,
        grade10: report.grade10,
        asOfDate: report.asOfDate,
      });
      populationReportsUpserted += 1;
      if (report.grader === "PSA") {
        psaPopulationReportsUpserted += 1;
      } else {
        tagPopulationReportsUpserted += 1;
      }
    });

    db.sync.lastCatalogSyncAt = new Date().toISOString();
    db.sync.lastCatalogProvider = "PokemonTCG API";
    db.sync.lastSalesProviders = ["POKEMONTCG_TCGPLAYER", "POKEMONTCG_CARDMARKET"];
    db.sync.lastSalesSyncAt = new Date().toISOString();
    db.sync.lastError = undefined;

    return {
      setsUpserted: liveSets.length,
      cardsUpserted: liveCards.length,
      tcgplayerSalesUpserted,
      cardmarketSalesUpserted,
      populationReportsUpserted,
      psaPopulationReportsUpserted,
      tagPopulationReportsUpserted,
    };
  });
}

export async function syncLiveSalesOnly(options?: { pageLimit?: number }): Promise<{
  cardsProcessed: number;
  tcgplayerSalesUpserted: number;
  cardmarketSalesUpserted: number;
  sealedSalesUpserted: number;
}> {
  const [liveCards, liveSealedSales] = await Promise.all([
    fetchLiveCards(options?.pageLimit),
    fetchLiveSealedSales(),
  ]);
  const eurToUsd = resolveEurToUsdRate();

  return withDbMutation((db) => {
    const cardByExternal = new Map(db.cards.map((card) => [card.externalId, card]));

    let tcgplayerSalesUpserted = 0;
    let cardmarketSalesUpserted = 0;
    let sealedSalesUpserted = 0;

    liveCards.forEach((liveCard) => {
      const card = cardByExternal.get(liveCard.externalId);
      if (!card) {
        return;
      }

      if (typeof liveCard.tcgplayerRawUsd === "number" && liveCard.tcgplayerRawUsd > 0) {
        const day = todayKey(liveCard.priceAsOf);
        upsertSale(db, {
          id: nextId("sale"),
          cardId: card.id,
          condition: "RAW",
          priceUsd: round2(liveCard.tcgplayerRawUsd),
          saleDate: liveCard.priceAsOf,
          source: "PokemonTCG API - TCGplayer",
          provider: "POKEMONTCG_TCGPLAYER",
          providerRef: `ptcg_tcgplayer:${liveCard.externalId}:${day}`,
          currency: "USD",
        });
        tcgplayerSalesUpserted += 1;
      }

      if (typeof liveCard.cardmarketRawEur === "number" && liveCard.cardmarketRawEur > 0) {
        const day = todayKey(liveCard.priceAsOf);
        upsertSale(db, {
          id: nextId("sale"),
          cardId: card.id,
          condition: "RAW",
          priceUsd: round2(liveCard.cardmarketRawEur * eurToUsd),
          saleDate: liveCard.priceAsOf,
          source: "PokemonTCG API - Cardmarket",
          provider: "POKEMONTCG_CARDMARKET",
          providerRef: `ptcg_cardmarket:${liveCard.externalId}:${day}`,
          currency: "EUR",
        });
        cardmarketSalesUpserted += 1;
      }
    });

    liveSealedSales.forEach((sale) => {
      const result = upsertSealedSale(db, {
        ...sale,
        source: sale.source ?? "external-sealed-feed",
        provider: "INGESTED",
        currency: sale.currency ?? "USD",
      });
      if (result.inserted) {
        sealedSalesUpserted += 1;
      }
    });

    db.sync.lastSalesSyncAt = new Date().toISOString();
    db.sync.lastSalesProviders = [
      "POKEMONTCG_TCGPLAYER",
      "POKEMONTCG_CARDMARKET",
      ...(liveSealedSales.length ? ["SEALED_EXTERNAL"] : []),
    ];
    db.sync.lastSealedSalesUpserted = sealedSalesUpserted;
    db.sync.lastError = undefined;

    return {
      cardsProcessed: liveCards.length,
      tcgplayerSalesUpserted,
      cardmarketSalesUpserted,
      sealedSalesUpserted,
    };
  });
}

export async function syncDirectTcgplayer(options?: {
  cardLimit?: number;
  categoryId?: number;
}): Promise<{
  cardsEvaluated: number;
  cardsMatched: number;
  pricesUpserted: number;
  groupsLoaded: number;
}> {
  const result = await syncDirectTcgplayerPrices(options);

  await withDbMutation((db) => {
    db.sync.lastSalesSyncAt = new Date().toISOString();
    db.sync.lastSalesProviders = [
      ...(db.sync.lastSalesProviders ?? []),
      "TCGPLAYER_DIRECT",
    ].filter((value, index, all) => all.indexOf(value) === index);
    db.sync.lastError = undefined;
  });

  return result;
}

export async function runSyncJob(
  type: SyncJobType,
  options?: { pageLimit?: number; cardLimit?: number },
): Promise<Record<string, number>> {
  if (type === "CATALOG_SYNC") {
    return syncLiveCatalog({ pageLimit: options?.pageLimit });
  }

  if (type === "SALES_SYNC") {
    return syncLiveSalesOnly({ pageLimit: options?.pageLimit });
  }

  return syncDirectTcgplayer({ cardLimit: options?.cardLimit });
}
