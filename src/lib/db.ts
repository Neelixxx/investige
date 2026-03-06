import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { plusDays, subscriptionStatus, subscriptionTier } from "./entitlements";
import { logger } from "./logger";
import { ensureSealedProductRecord, matchSealedProduct } from "./sealed-products";
import { createSeedDatabase } from "./seed-data";
import { hasPostgresUrl, prismaClient } from "./prisma";
import type {
  GemIndexDatabase,
  PortfolioRecord,
  SyncJobRecord,
  UserRecord,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "gemindex-db.json");
const STATE_ID = "main";
const DEFAULT_PASSWORD_HASH = "$2b$10$XQr.sXlDCUQJhWKiJWPdiOzUR7RvrEq11V9damPhOQ16tp4suEiPe";

let cache: GemIndexDatabase | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();
let postgresUnavailable = false;

function normalizeEtbLabel(value: string): string {
  return value.replace(/elite trainer box/gi, "ETB");
}

function recoverTrailingJson(raw: string): unknown | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let seenRoot = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      depth += 1;
      seenRoot = true;
      continue;
    }

    if (char === "}" || char === "]") {
      depth -= 1;

      if (seenRoot && depth === 0) {
        const candidate = raw.slice(0, index + 1);
        try {
          return JSON.parse(candidate) as unknown;
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

function shouldUsePostgres(): boolean {
  return hasPostgresUrl() && !postgresUnavailable;
}

function markPostgresUnavailable(error: unknown, phase: string): void {
  if (postgresUnavailable) {
    return;
  }
  postgresUnavailable = true;
  logger.warn(
    {
      phase,
      error: error instanceof Error ? error.message : String(error),
    },
    "postgres unavailable; falling back to file storage",
  );
}

function normalizeUser(rawUser: unknown, index: number): UserRecord {
  const source = (rawUser ?? {}) as Partial<UserRecord> & { email?: string };
  const createdAt = source.createdAt ?? new Date().toISOString();
  const role = source.role ?? (index === 0 ? "ADMIN" : "USER");
  const fallbackEmail =
    index === 0
      ? "demo@gemindex.local"
      : `${(source.name ?? `user${index + 1}`).toLowerCase().replace(/[^a-z0-9]+/g, "") || "user"}@gemindex.local`;
  const defaultTier = role === "ADMIN" ? "ELITE" : "FREE";
  const defaultStatus = role === "ADMIN" ? "ACTIVE" : "TRIALING";
  const fallbackUsernameBase = (
    source.username ??
    source.email?.split("@")[0] ??
    source.name ??
    `user${index + 1}`
  )
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "")
    .slice(0, 32);
  const fallbackUsername = fallbackUsernameBase.length >= 3 ? fallbackUsernameBase : `user${index + 1}`;

  return {
    id: source.id ?? `user_${index + 1}`,
    name: source.name ?? `User ${index + 1}`,
    username: fallbackUsername,
    email: source.email ?? fallbackEmail,
    passwordHash: source.passwordHash ?? DEFAULT_PASSWORD_HASH,
    role,
    subscriptionTier: source.subscriptionTier ?? defaultTier,
    subscriptionStatus: source.subscriptionStatus ?? defaultStatus,
    subscriptionCurrentPeriodEnd:
      source.subscriptionCurrentPeriodEnd ??
      (role === "ADMIN" ? plusDays(new Date(createdAt), 365) : plusDays(new Date(createdAt), 14)),
    trialEndsAt: source.trialEndsAt ?? (role === "ADMIN" ? undefined : plusDays(new Date(createdAt), 14)),
    stripeCustomerId: source.stripeCustomerId,
    stripeSubscriptionId: source.stripeSubscriptionId,
    emailVerified: source.emailVerified ?? index === 0,
    emailVerifiedAt: source.emailVerifiedAt,
    totpEnabled: source.totpEnabled ?? false,
    totpSecret: source.totpSecret,
    createdAt,
    updatedAt: source.updatedAt ?? createdAt,
  };
}

function mergeDefaultJobs(existing: SyncJobRecord[], fallback: SyncJobRecord[]): SyncJobRecord[] {
  const out = [...existing];

  fallback.forEach((job) => {
    const already = out.find((entry) => entry.id === job.id || entry.type === job.type);
    if (!already) {
      out.push(job);
      return;
    }

    if (already.intervalMinutes <= 0) {
      already.intervalMinutes = job.intervalMinutes;
    }
    if (!already.nextRunAt) {
      already.nextRunAt = job.nextRunAt;
    }
    if (typeof already.running !== "boolean") {
      already.running = false;
    }
    if (!already.name) {
      already.name = job.name;
    }
    if (!already.options) {
      already.options = job.options;
    }
  });

  return out;
}

function mergeDefaultSealedProducts(
  existing: GemIndexDatabase["sealedProducts"],
  fallback: GemIndexDatabase["sealedProducts"],
): GemIndexDatabase["sealedProducts"] {
  const out = [...existing];

  fallback.forEach((product) => {
    const already = out.find(
      (entry) =>
        entry.id === product.id ||
        (
          entry.setId === product.setId &&
          entry.productType === product.productType &&
          entry.productName.toLowerCase() === product.productName.toLowerCase()
        ),
    );
    if (!already) {
      out.push(product);
      return;
    }

    already.imageUrl = already.imageUrl ?? product.imageUrl;
    already.releaseDate = already.releaseDate ?? product.releaseDate;
    already.upc = already.upc ?? product.upc;
    already.marketValueUsd = already.marketValueUsd ?? product.marketValueUsd;
    already.source = already.source ?? product.source;
    already.externalId = already.externalId ?? product.externalId;
  });

  return out;
}

function mergeDefaultSealedSales(
  existing: GemIndexDatabase["sealedSales"],
  fallback: GemIndexDatabase["sealedSales"],
): GemIndexDatabase["sealedSales"] {
  const out = [...existing];

  fallback.forEach((sale) => {
    const already = out.find(
      (entry) =>
        entry.id === sale.id ||
        (entry.productId === sale.productId &&
          entry.saleDate === sale.saleDate &&
          entry.priceUsd === sale.priceUsd) ||
        (sale.providerRef && entry.providerRef === sale.providerRef),
    );
    if (!already) {
      out.push(sale);
      return;
    }

    already.source = already.source ?? sale.source;
    already.provider = already.provider ?? sale.provider;
    already.providerRef = already.providerRef ?? sale.providerRef;
    already.currency = already.currency ?? sale.currency;
  });

  return out;
}

function mergeDefaultSealedSetMarketSnapshots(
  existing: GemIndexDatabase["sealedSetMarketSnapshots"],
  fallback: GemIndexDatabase["sealedSetMarketSnapshots"],
): GemIndexDatabase["sealedSetMarketSnapshots"] {
  const out = [...existing];

  fallback.forEach((snapshot) => {
    const already = out.find(
      (entry) =>
        entry.id === snapshot.id ||
        (
          entry.setId === snapshot.setId &&
          entry.snapshotDate === snapshot.snapshotDate
        ),
    );
    if (!already) {
      out.push(snapshot);
      return;
    }

    already.tcgplayerListings =
      typeof already.tcgplayerListings === "number" ? already.tcgplayerListings : snapshot.tcgplayerListings;
    already.marketValueUsd =
      typeof already.marketValueUsd === "number" ? already.marketValueUsd : snapshot.marketValueUsd;
    already.source = already.source ?? snapshot.source;
  });

  return out;
}

function mergeDefaultPortfolios(
  existing: PortfolioRecord[],
  fallback: PortfolioRecord[],
): PortfolioRecord[] {
  const out = [...existing];

  fallback.forEach((portfolio) => {
    const already = out.find(
      (entry) =>
        entry.id === portfolio.id ||
        (entry.userId === portfolio.userId && entry.name.toLowerCase() === portfolio.name.toLowerCase()),
    );
    if (!already) {
      out.push(portfolio);
      return;
    }

    already.updatedAt = already.updatedAt ?? portfolio.updatedAt;
    already.createdAt = already.createdAt ?? portfolio.createdAt;
  });

  return out;
}

function normalizeDb(raw: unknown): GemIndexDatabase {
  const seed = createSeedDatabase();
  const incoming = (raw ?? {}) as Partial<GemIndexDatabase>;
  const sealedProductsRaw = Array.isArray(incoming.sealedProducts) ? incoming.sealedProducts : [];
  const sealedProducts = mergeDefaultSealedProducts(sealedProductsRaw, seed.sealedProducts);
  const sealedSalesRaw = Array.isArray(incoming.sealedSales) ? incoming.sealedSales : [];
  const sealedSales = mergeDefaultSealedSales(sealedSalesRaw, seed.sealedSales);
  const sealedSetMarketSnapshotsRaw = Array.isArray(incoming.sealedSetMarketSnapshots)
    ? incoming.sealedSetMarketSnapshots
    : [];
  const sealedSetMarketSnapshots = mergeDefaultSealedSetMarketSnapshots(
    sealedSetMarketSnapshotsRaw,
    seed.sealedSetMarketSnapshots,
  );
  const portfoliosRaw = Array.isArray(incoming.portfolios) ? incoming.portfolios : [];
  const portfolios = mergeDefaultPortfolios(portfoliosRaw, seed.portfolios);

  const usersRaw = Array.isArray(incoming.users) ? incoming.users : [];
  const users = usersRaw.length ? usersRaw.map(normalizeUser) : seed.users;

  const result: GemIndexDatabase = {
    version: 8,
    sets: Array.isArray(incoming.sets) ? incoming.sets : seed.sets,
    cards: Array.isArray(incoming.cards) ? incoming.cards : seed.cards,
    populationReports: Array.isArray(incoming.populationReports)
      ? incoming.populationReports
      : seed.populationReports,
    sales: Array.isArray(incoming.sales) ? incoming.sales : seed.sales,
    users,
    emailVerificationTokens: Array.isArray(incoming.emailVerificationTokens)
      ? incoming.emailVerificationTokens
      : [],
    passwordResetTokens: Array.isArray(incoming.passwordResetTokens)
      ? incoming.passwordResetTokens
      : [],
    emailOutbox: Array.isArray(incoming.emailOutbox) ? incoming.emailOutbox : [],
    syncJobs: mergeDefaultJobs(
      Array.isArray(incoming.syncJobs) ? incoming.syncJobs : [],
      seed.syncJobs,
    ),
    syncTasks: Array.isArray(incoming.syncTasks) ? incoming.syncTasks : [],
    portfolios: portfolios.length ? portfolios : seed.portfolios,
    collectionItems: Array.isArray(incoming.collectionItems)
      ? incoming.collectionItems
      : seed.collectionItems,
    wishlistItems: Array.isArray(incoming.wishlistItems)
      ? incoming.wishlistItems
      : seed.wishlistItems,
    sealedProducts: sealedProducts.length ? sealedProducts : seed.sealedProducts,
    sealedSales: sealedSales.length ? sealedSales : seed.sealedSales,
    sealedSetMarketSnapshots: sealedSetMarketSnapshots.length
      ? sealedSetMarketSnapshots
      : seed.sealedSetMarketSnapshots,
    sealedInventoryItems: Array.isArray(incoming.sealedInventoryItems)
      ? incoming.sealedInventoryItems
      : seed.sealedInventoryItems,
    sealedWishlistItems: Array.isArray(incoming.sealedWishlistItems)
      ? incoming.sealedWishlistItems
      : seed.sealedWishlistItems,
    scanEvents: Array.isArray(incoming.scanEvents) ? incoming.scanEvents : seed.scanEvents,
    alertRules: Array.isArray(incoming.alertRules) ? incoming.alertRules : [],
    alertEvents: Array.isArray(incoming.alertEvents) ? incoming.alertEvents : [],
    sync: incoming.sync ?? {},
  };

  const hasTcgCreds =
    Boolean(process.env.TCGPLAYER_PUBLIC_KEY) &&
    Boolean(process.env.TCGPLAYER_PRIVATE_KEY);
  if (!hasTcgCreds) {
    result.syncJobs = result.syncJobs.map((job) =>
      job.type === "TCGPLAYER_DIRECT_SYNC" ? { ...job, enabled: false } : job,
    );
  }

  const validUserIds = new Set(result.users.map((user) => user.id));
  const fallbackUserId = result.users[0]?.id ?? "user_default";

  const nowIso = new Date().toISOString();
  result.users = result.users.map((user) => {
    const tier = subscriptionTier(user);
    const trialEndsAt =
      user.trialEndsAt ?? (user.role === "ADMIN" ? undefined : plusDays(new Date(user.createdAt), 14));
    const currentPeriodEnd =
      user.subscriptionCurrentPeriodEnd ??
      (user.role === "ADMIN" ? plusDays(new Date(user.createdAt), 365) : plusDays(new Date(user.createdAt), 14));

    let status = subscriptionStatus(user);
    if (status === "TRIALING" && trialEndsAt && trialEndsAt <= nowIso) {
      status = "PAST_DUE";
    }

    return {
      ...user,
      subscriptionTier: tier,
      subscriptionStatus: status,
      trialEndsAt,
      subscriptionCurrentPeriodEnd: currentPeriodEnd,
    };
  });

  result.portfolios = result.portfolios
    .filter((portfolio) => validUserIds.has(portfolio.userId))
    .map((portfolio) => ({
      ...portfolio,
      userId: validUserIds.has(portfolio.userId) ? portfolio.userId : fallbackUserId,
      createdAt: portfolio.createdAt ?? nowIso,
      updatedAt: portfolio.updatedAt ?? portfolio.createdAt ?? nowIso,
    }));

  const firstPortfolioByUser = new Map<string, string>();
  result.users.forEach((user) => {
    const userPortfolio =
      result.portfolios.find((portfolio) => portfolio.userId === user.id) ??
      {
        id: nextId("portfolio"),
        userId: user.id,
        name: "Main Portfolio",
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    if (!result.portfolios.some((portfolio) => portfolio.id === userPortfolio.id)) {
      result.portfolios.push(userPortfolio);
    }
    firstPortfolioByUser.set(user.id, userPortfolio.id);
  });

  const validPortfolioIds = new Set(result.portfolios.map((portfolio) => portfolio.id));

  result.collectionItems = result.collectionItems.map((item) => ({
    ...item,
    rawCondition: item.ownershipType === "RAW" ? (item.rawCondition ?? "NM") : undefined,
    userId: validUserIds.has(item.userId) ? item.userId : fallbackUserId,
    portfolioId:
      item.portfolioId && validPortfolioIds.has(item.portfolioId)
        ? item.portfolioId
        : (firstPortfolioByUser.get(validUserIds.has(item.userId) ? item.userId : fallbackUserId) ?? seed.portfolios[0].id),
  }));
  result.wishlistItems = result.wishlistItems.map((item) => ({
    ...item,
    userId: validUserIds.has(item.userId) ? item.userId : fallbackUserId,
  }));
  result.sealedProducts = result.sealedProducts.map((product) => ({
    ...product,
    productName: normalizeEtbLabel(product.productName),
  }));
  result.sealedInventoryItems = result.sealedInventoryItems.map((item) => ({
    ...item,
    userId: validUserIds.has(item.userId) ? item.userId : fallbackUserId,
    portfolioId:
      item.portfolioId && validPortfolioIds.has(item.portfolioId)
        ? item.portfolioId
        : (firstPortfolioByUser.get(validUserIds.has(item.userId) ? item.userId : fallbackUserId) ?? seed.portfolios[0].id),
    productName: normalizeEtbLabel(item.productName),
  }));
  result.sealedWishlistItems = result.sealedWishlistItems.map((item) => ({
    ...item,
    userId: validUserIds.has(item.userId) ? item.userId : fallbackUserId,
    productName: normalizeEtbLabel(item.productName),
  }));

  result.sealedInventoryItems = result.sealedInventoryItems.map((item) => {
    const matched =
      matchSealedProduct(result, {
        productId: item.productId,
        setId: item.setId,
        productName: normalizeEtbLabel(item.productName),
        productType: item.productType,
      }) ??
      ensureSealedProductRecord(result, {
        setId: item.setId,
        productName: normalizeEtbLabel(item.productName),
        productType: item.productType,
        marketValueUsd: item.estimatedValueUsd,
        source: "MANUAL",
      });

    return {
      ...item,
      productId: matched.id,
      setId: matched.setId,
      productName: matched.productName,
      productType: matched.productType,
    };
  });

  result.sealedWishlistItems = result.sealedWishlistItems.map((item) => {
    const matched =
      matchSealedProduct(result, {
        productId: item.productId,
        setId: item.setId,
        productName: normalizeEtbLabel(item.productName),
        productType: item.productType,
      }) ??
      ensureSealedProductRecord(result, {
        setId: item.setId,
        productName: normalizeEtbLabel(item.productName),
        productType: item.productType,
        marketValueUsd: item.targetPriceUsd,
        source: "MANUAL",
      });

    return {
      ...item,
      productId: matched.id,
      setId: matched.setId,
      productName: matched.productName,
      productType: matched.productType,
    };
  });
  const validProductIds = new Set(result.sealedProducts.map((product) => product.id));
  result.sealedSales = result.sealedSales
    .filter((item) => validProductIds.has(item.productId))
    .sort((a, b) => new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime());
  result.scanEvents = result.scanEvents.map((item) => ({
    ...item,
    userId: validUserIds.has(item.userId) ? item.userId : fallbackUserId,
  }));
  result.alertRules = result.alertRules
    .filter((item) => validUserIds.has(item.userId))
    .map((item) => ({
      ...item,
      enabled: item.enabled ?? true,
      updatedAt: item.updatedAt ?? item.createdAt ?? nowIso,
    }));
  const validRuleIds = new Set(result.alertRules.map((item) => item.id));
  result.alertEvents = result.alertEvents
    .filter((item) => validUserIds.has(item.userId) && validRuleIds.has(item.ruleId))
    .map((item) => ({
      ...item,
      userId: validUserIds.has(item.userId) ? item.userId : fallbackUserId,
    }));
  result.emailVerificationTokens = result.emailVerificationTokens.filter((item) =>
    validUserIds.has(item.userId),
  );
  result.passwordResetTokens = result.passwordResetTokens.filter((item) =>
    validUserIds.has(item.userId),
  );

  return result;
}

async function ensureFileDbExists(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await readFile(DB_FILE, "utf8");
  } catch {
    const seed = createSeedDatabase();
    await writeFile(DB_FILE, JSON.stringify(seed, null, 2), "utf8");
  }
}

async function ensurePostgresStateExists(): Promise<void> {
  const prisma = prismaClient();
  const existing = await prisma.appState.findUnique({ where: { id: STATE_ID } });
  if (existing) {
    return;
  }

  const seed = createSeedDatabase();
  await prisma.appState.create({
    data: {
      id: STATE_ID,
      version: seed.version,
      data: seed as unknown as object,
    },
  });
}

async function ensureStorageExists(): Promise<void> {
  if (shouldUsePostgres()) {
    try {
      await ensurePostgresStateExists();
      return;
    } catch (error) {
      markPostgresUnavailable(error, "ensure");
    }
  }

  await ensureFileDbExists();
}

async function readRawStorage(): Promise<unknown> {
  if (shouldUsePostgres()) {
    try {
      const prisma = prismaClient();
      const row = await prisma.appState.findUnique({ where: { id: STATE_ID } });
      return row?.data;
    } catch (error) {
      markPostgresUnavailable(error, "read");
      await ensureFileDbExists();
    }
  }

  const raw = await readFile(DB_FILE, "utf8");

  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    const recovered = recoverTrailingJson(raw);
    if (recovered !== null) {
      logger.warn("detected trailing garbage in file storage; rewriting sanitized database file");
      await writeFile(DB_FILE, JSON.stringify(recovered, null, 2), "utf8");
      return recovered;
    }

    throw error;
  }
}

async function writeRawStorage(db: GemIndexDatabase): Promise<void> {
  if (shouldUsePostgres()) {
    try {
      const prisma = prismaClient();
      await prisma.appState.upsert({
        where: { id: STATE_ID },
        update: {
          version: db.version,
          data: db as unknown as object,
        },
        create: {
          id: STATE_ID,
          version: db.version,
          data: db as unknown as object,
        },
      });
      return;
    } catch (error) {
      markPostgresUnavailable(error, "write");
    }
  }

  await ensureFileDbExists();
  await writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

export async function readDb(forceFresh = false): Promise<GemIndexDatabase> {
  await ensureStorageExists();

  if (!forceFresh && cache) {
    return cache;
  }

  const parsed = normalizeDb(await readRawStorage());
  cache = parsed;
  return parsed;
}

export async function writeDb(db: GemIndexDatabase): Promise<void> {
  const normalized = normalizeDb(db);
  cache = normalized;
  await writeRawStorage(normalized);
}

export async function withDbMutation<T>(
  mutate: (db: GemIndexDatabase) => Promise<T> | T,
): Promise<T> {
  writeQueue = writeQueue.then(async () => {
    const db = await readDb(true);
    const result = await mutate(db);
    await writeDb(db);
    return result;
  });

  return writeQueue as Promise<T>;
}

export function nextId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function storageMode(): "postgres" | "file" {
  return shouldUsePostgres() ? "postgres" : "file";
}
