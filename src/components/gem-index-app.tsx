"use client";

import Image from "next/image";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";

import type { DashboardData, DataQualitySnapshot, PublicUser, SetMetrics, SyncState } from "@/lib/types";

type CardApi = {
  cardId: string;
  cardName: string;
  cardNumber: string;
  setCode: string;
  setName: string;
  setLogoUrl?: string;
  setSymbolUrl?: string;
  imageUrl?: string;
  imageLargeUrl?: string;
  rawPrice: number;
  psa10Price: number;
  tag10Price: number;
  gemRateBlended: number;
  liquidityScore: number;
  scarcityScore: number;
  roi12m: number;
  gradingArbitrageUsd: number;
  series: Array<{ date: string; raw?: number; psa10?: number; tag10?: number }>;
};

type CardsResponse = {
  items: CardApi[];
  dataQuality: DataQualitySnapshot;
};

type SetSealedHistory = {
  setId: string;
  setCode: string;
  setName: string;
  series: Array<{ date: string; tcgplayerListings: number; marketValueUsd: number }>;
};

type SetsResponse = {
  items: SetMetrics[];
  dataQuality: DataQualitySnapshot;
  sealedSetHistory?: SetSealedHistory[];
};

type AlertRuleApi = {
  id: string;
  userId: string;
  entityType: "CARD" | "SEALED_PRODUCT" | "SET";
  entityId: string;
  entityLabel: string;
  condition: "PRICE_BELOW" | "PRICE_ABOVE" | "PCT_CHANGE_UP" | "PCT_CHANGE_DOWN";
  thresholdValue: number;
  lookbackMonths?: number;
  enabled: boolean;
  lastConditionMet?: boolean;
  lastEvaluatedValue?: number;
  lastTriggeredAt?: string;
  createdAt: string;
  updatedAt: string;
};

type AlertEventApi = {
  id: string;
  userId: string;
  ruleId: string;
  entityType: "CARD" | "SEALED_PRODUCT" | "SET";
  entityId: string;
  entityLabel: string;
  condition: "PRICE_BELOW" | "PRICE_ABOVE" | "PCT_CHANGE_UP" | "PCT_CHANGE_DOWN";
  thresholdValue: number;
  currentValue: number;
  baselineValue?: number;
  percentChange?: number;
  message: string;
  triggeredAt: string;
  readAt?: string;
};

type AlertsResponse = {
  rules: AlertRuleApi[];
  events: AlertEventApi[];
  unreadCount: number;
  newlyTriggered: number;
};

type SyncStatus = {
  sync: SyncState;
  sealedFeed?: {
    configured: boolean;
    mode: "FILE" | "URL" | "NONE";
    target?: string;
    lastImportedCount: number;
    lastSalesSyncAt?: string;
    lastRunIncludedFeed: boolean;
  };
  totals: { sets: number; cards: number; sales: number; populations: number };
  jobs: { configured: number; queued: number; running: number };
  role: "ADMIN" | "USER";
  subscription: {
    tier: "FREE" | "PRO" | "ELITE";
    status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";
    currentPeriodEnd?: string;
    trialEndsAt?: string;
  };
  features: {
    PORTFOLIO_TRACKING: boolean;
    CARD_SCANNER_TEXT: boolean;
    CARD_SCANNER_OCR: boolean;
    LIVE_SYNC_QUEUE: boolean;
    DIRECT_TCGPLAYER_SYNC: boolean;
    ADVANCED_ANALYTICS: boolean;
  };
};

type SyncTaskApi = {
  id: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  result?: Record<string, number>;
  resultSummary?: string;
  error?: string;
};

type HeaderBackgroundId =
  | "DEFAULT"
  | "BULBASAUR_FOREST"
  | "GRENINJA_TIDE"
  | "MEW_NEON"
  | "MEWTWO_COSMIC"
  | "PIKACHU_GROVE"
  | "UMBREON_ALLEY";

type PortfolioApi = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type RawCardCondition = "NM" | "LP" | "HP" | "DMG";

type CollectionItem = {
  id: string;
  portfolioId?: string;
  portfolioName?: string;
  quantity: number;
  ownershipType: "RAW" | "GRADED";
  rawCondition?: RawCardCondition;
  grader?: "PSA" | "TAG";
  grade?: number;
  certificationNumber?: string;
  card: { name: string; cardNumber: string; setCode: string; setName?: string; imageUrl?: string; imageLargeUrl?: string } | null;
};

type WishlistItem = {
  id: string;
  priority: number;
  targetPriceUsd?: number;
  card: { name: string; cardNumber: string; setCode: string; setName?: string; imageUrl?: string; imageLargeUrl?: string } | null;
};

type SealedCatalogProduct = {
  id: string;
  setId: string;
  setCode: string;
  setName: string;
  productName: string;
  productType: string;
  imageUrl?: string;
  releaseDate?: string;
  upc?: string;
  marketValueUsd?: number;
  series: Array<{ date: string; market?: number; tracked?: number; target?: number }>;
  metrics: {
    latestMarketPrice: number;
    averageSalePrice: number;
    roi12m: number;
    volatility: number;
    liquidityScore: number;
    salesLast90d: number;
    trackedValue?: number;
    targetValue?: number;
  };
  source?: "SEED" | "MANUAL" | "SCANNER";
  setLogoUrl?: string;
  setSymbolUrl?: string;
};

type SealedItem = {
  id: string;
  portfolioId?: string;
  portfolioName?: string;
  productId?: string;
  setId: string;
  productName: string;
  quantity: number;
  setCode: string;
  setName?: string;
  productType?: string;
  imageUrl?: string;
  releaseDate?: string;
  upc?: string;
  marketValueUsd?: number;
  setLogoUrl?: string;
  setSymbolUrl?: string;
  estimatedValueUsd?: number;
  acquisitionPriceUsd?: number;
  notes?: string;
  product?: SealedCatalogProduct | null;
};

type SealedWishlistItem = {
  id: string;
  productId?: string;
  setId: string;
  productName: string;
  setCode: string;
  setName?: string;
  productType?: string;
  imageUrl?: string;
  releaseDate?: string;
  upc?: string;
  marketValueUsd?: number;
  setLogoUrl?: string;
  setSymbolUrl?: string;
  priority: number;
  targetPriceUsd?: number;
  notes?: string;
  product?: SealedCatalogProduct | null;
};

type SealedSearchMatch = {
  id: string;
  productId: string;
  productName: string;
  setCode: string;
  setName?: string;
  productType?: string;
  series: Array<{ date: string; market?: number; tracked?: number; target?: number }>;
  metrics: SealedCatalogProduct["metrics"];
  meta: string;
  valueLabel: string;
  score: number;
  imageUrl?: string;
  inventoryQuantity: number;
  wishlistCount: number;
  wishlistPriority?: number;
  marketValueUsd?: number;
  releaseDate?: string;
  upc?: string;
};

type SealedSaleAdminItem = {
  id: string;
  productId: string;
  productName: string;
  productType: string;
  setCode: string;
  setName: string;
  imageUrl?: string;
  priceUsd: number;
  saleDate: string;
  source?: string;
  provider?: "SEED" | "MANUAL" | "INGESTED";
  providerRef?: string;
  currency?: string;
};

type ImageScanResponse = {
  actionPreview?: boolean;
  destination?: "COLLECTION" | "WISHLIST" | "PRICE_CHECK";
  itemKind: "RAW_CARD" | "GRADED_SLAB" | "SEALED_PRODUCT" | "UNKNOWN";
  ocr?: { text: string; confidence: number };
  barcode?: { value: string; format?: string; detectedCount?: number } | null;
  barcodeCandidates?: Array<{ value: string; format?: string; detectedCount?: number }>;
  slab?: { grader?: "PSA" | "TAG"; grade?: number };
  sealed?: {
    productId?: string;
    setId?: string;
    setCode?: string;
    setName?: string;
    productType?: string;
    productName?: string;
    imageUrl?: string;
    releaseDate?: string;
    upc?: string;
    marketValueUsd?: number;
  } | null;
  sealedCandidates?: Array<{
    id: string;
    productId: string;
    setId?: string;
    setCode?: string;
    setName?: string;
    productType?: string;
    productName?: string;
    imageUrl?: string;
    releaseDate?: string;
    upc?: string;
    marketValueUsd?: number;
    confidence?: number;
    reason?: string;
    viaBarcode?: boolean;
  }>;
  match?: {
    confidence: number;
    reason: string;
    card?: { id?: string; name?: string; cardNumber?: string; setCode?: string } | null;
  } | null;
  setMatch?: { id?: string; name?: string; code?: string; confidence?: number; reason?: string } | null;
  priceCheck?: {
    card?: { raw?: number; psa10?: number; tag10?: number; gemRateBlended?: number } | null;
    set?: { name?: string; totalSetValue?: number } | null;
    sealedEstimateUsd?: number | null;
  } | null;
};

type OutboxEmail = {
  id: string;
  to: string;
  subject: string;
  template: "VERIFY_EMAIL" | "PASSWORD_RESET" | "USERNAME_RECOVERY";
  body: string;
  createdAt: string;
};

type ApiError = Error & { status?: number };
type ChartRangeOption = "3M" | "6M" | "12M" | "ALL";
type SealedMarketTypeFilter = "BOOSTER_BOX" | "BOOSTER_BUNDLE" | "ETB" | "PC_ETB";
type DualAxisValueFormat = "currency" | "number" | "percent";
type HomeTab =
  | "ANALYTICS_DASHBOARD"
  | "CARD_DETAILS"
  | "SEALED_PRODUCT_DETAILS"
  | "SEALED_ANALYTICS"
  | "SET_VALUES"
  | "CARDS_TOP_60"
  | "CARD_INDEX"
  | "ARBITRAGE"
  | "SIGNALS"
  | "PORTFOLIO_PERFORMANCE"
  | "PERSONAL_COLLECTION"
  | "WISHLIST"
  | "SEALED_INVENTORY"
  | "QUICK_PORTFOLIO_ACTIONS"
  | "SETTINGS";

const ANALYTICS_HOME_TABS: Array<{ id: HomeTab; label: string }> = [
  { id: "ANALYTICS_DASHBOARD", label: "Dashboard" },
  { id: "CARD_DETAILS", label: "Card Analytics" },
  { id: "SEALED_ANALYTICS", label: "Sealed Analytics" },
  { id: "SET_VALUES", label: "Set Values" },
];

const MARKET_RESEARCH_HOME_TABS: Array<{ id: HomeTab; label: string }> = [
  { id: "CARD_INDEX", label: "Card Index" },
  { id: "ARBITRAGE", label: "Grading Arbitrage" },
  { id: "SIGNALS", label: "Signals" },
  { id: "CARDS_TOP_60", label: "Cards (Top 50)" },
];

const PORTFOLIO_HOME_TABS: Array<{ id: HomeTab; label: string }> = [
  { id: "PERSONAL_COLLECTION", label: "Portfolio Overview" },
  { id: "WISHLIST", label: "Wishlist" },
  { id: "SEALED_INVENTORY", label: "Sealed Collection" },
];

const SETTINGS_HOME_TABS: Array<{
  label: string;
  subsection: "ACCOUNT" | "HEADER_BACKGROUND" | "BILLING_INFORMATION" | "ALERTS";
}> = [
  { label: "Account", subsection: "ACCOUNT" },
  { label: "Header Background", subsection: "HEADER_BACKGROUND" },
  { label: "Billing Information", subsection: "BILLING_INFORMATION" },
  { label: "Alerts", subsection: "ALERTS" },
];

const PRIMARY_HOME_TABS: Array<{ id: HomeTab; label: string }> = [
  { id: "PERSONAL_COLLECTION", label: "Portfolio" },
  { id: "SETTINGS", label: "Settings" },
];

const HEADER_BACKGROUND_STORAGE_KEY = "gemindex.headerBackgroundId";

const HEADER_BACKGROUND_OPTIONS: Array<{
  id: HeaderBackgroundId;
  label: string;
  description: string;
  imageUrl?: string;
}> = [
  {
    id: "DEFAULT",
    label: "Default Glow",
    description: "Uses the built-in Investige gradient shell.",
  },
  {
    id: "BULBASAUR_FOREST",
    label: "Bulbasaur Forest",
    description: "Bulbasaur header artwork.",
    imageUrl: "/header-backgrounds/Bulbasaur_Background_cropped.webp",
  },
  {
    id: "GRENINJA_TIDE",
    label: "Greninja Tide",
    description: "Greninja header artwork.",
    imageUrl: "/header-backgrounds/Greninja_Background_cropped.jpg",
  },
  {
    id: "MEW_NEON",
    label: "Mew Neon",
    description: "Mew header artwork.",
    imageUrl: "/header-backgrounds/Mew_Background_cropped.jpg",
  },
  {
    id: "MEWTWO_COSMIC",
    label: "Mewtwo Cosmic",
    description: "Mewtwo header artwork.",
    imageUrl: "/header-backgrounds/Mewtwo_Background_cropped.jpeg",
  },
  {
    id: "PIKACHU_GROVE",
    label: "Pikachu Grove",
    description: "Pikachu header artwork.",
    imageUrl: "/header-backgrounds/Pikachu_Background_cropped.webp",
  },
  {
    id: "UMBREON_ALLEY",
    label: "Umbreon Alley",
    description: "Umbreon header artwork.",
    imageUrl: "/header-backgrounds/Umbreon_Background_cropped.jpg",
  },
];

const SEALED_MARKET_TYPE_OPTIONS: Array<{ value: SealedMarketTypeFilter; label: string }> = [
  { value: "BOOSTER_BOX", label: "Booster Box" },
  { value: "BOOSTER_BUNDLE", label: "Booster Bundle" },
  { value: "ETB", label: "ETB" },
  { value: "PC_ETB", label: "PC ETB" },
];

const ALERT_CONDITION_OPTIONS: Array<{
  value: AlertRuleApi["condition"];
  label: string;
}> = [
  { value: "PRICE_BELOW", label: "Price Below" },
  { value: "PRICE_ABOVE", label: "Price Above" },
  { value: "PCT_CHANGE_UP", label: "% Change Up" },
  { value: "PCT_CHANGE_DOWN", label: "% Change Down" },
];

const RAW_CARD_CONDITION_OPTIONS: Array<{ value: RawCardCondition; label: string }> = [
  { value: "NM", label: "Near Mint (NM)" },
  { value: "LP", label: "Lightly Played (LP)" },
  { value: "HP", label: "Heavily Played (HP)" },
  { value: "DMG", label: "Damaged (DMG)" },
];

const RAW_CARD_CONDITION_MULTIPLIERS: Record<RawCardCondition, number> = {
  NM: 1,
  LP: 0.85,
  HP: 0.7,
  DMG: 0.5,
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = 15_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) {
      const err = new Error((json as { error?: string }).error ?? `Request failed (${res.status})`) as ApiError;
      err.status = res.status;
      throw err;
    }
    return json;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs / 1000} seconds`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function usd(v: number | undefined): string {
  return typeof v === "number"
    ? `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "-";
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeRawCardCondition(value?: RawCardCondition): RawCardCondition {
  return value ?? "NM";
}

function rawConditionAdjustedPrice(rawNmPrice: number | undefined, condition?: RawCardCondition): number {
  if (typeof rawNmPrice !== "number" || !Number.isFinite(rawNmPrice)) {
    return 0;
  }

  const normalized = normalizeRawCardCondition(condition);
  return rawNmPrice * RAW_CARD_CONDITION_MULTIPLIERS[normalized];
}

function splitUserName(value: string): { firstName: string; lastName: string } {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function chartRangeLimit(range: ChartRangeOption): number | null {
  if (range === "ALL") {
    return null;
  }

  return Number.parseInt(range.replace("M", ""), 10);
}

function formatSealedProductType(value?: string): string {
  if (!value) {
    return "Unknown";
  }

  if (value === "ELITE_TRAINER_BOX") {
    return "ETB";
  }

  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function pctOfSetValue(productPrice: number | undefined, totalSetValue: number): number | undefined {
  if (typeof productPrice !== "number" || !Number.isFinite(productPrice) || totalSetValue <= 0) {
    return undefined;
  }

  return (productPrice / totalSetValue) * 100;
}

function matchesSealedMarketTypeFilter(product: SealedCatalogProduct, filter: SealedMarketTypeFilter): boolean {
  const name = normalizeSearchText(product.productName);
  const isEtb =
    product.productType === "ELITE_TRAINER_BOX" || name.includes("etb") || name.includes("elite trainer box");
  const isPokemonCenter = name.includes("pokemon center");

  if (filter === "BOOSTER_BOX") {
    return product.productType === "BOOSTER_BOX" || name.includes("booster box");
  }

  if (filter === "BOOSTER_BUNDLE") {
    return name.includes("booster bundle");
  }

  if (filter === "ETB") {
    return isEtb && !isPokemonCenter;
  }

  return isEtb && isPokemonCenter;
}

function isPercentAlertCondition(
  condition: AlertRuleApi["condition"] | "PRICE_BELOW" | "PRICE_ABOVE" | "PCT_CHANGE_UP" | "PCT_CHANGE_DOWN",
): boolean {
  return condition === "PCT_CHANGE_UP" || condition === "PCT_CHANGE_DOWN";
}

function formatAlertCondition(
  condition: AlertRuleApi["condition"] | "PRICE_BELOW" | "PRICE_ABOVE" | "PCT_CHANGE_UP" | "PCT_CHANGE_DOWN",
): string {
  switch (condition) {
    case "PRICE_BELOW":
      return "Price Below";
    case "PRICE_ABOVE":
      return "Price Above";
    case "PCT_CHANGE_UP":
      return "% Change Up";
    case "PCT_CHANGE_DOWN":
      return "% Change Down";
    default:
      return condition;
  }
}

function relevanceScore(query: string, candidate: string): number {
  const q = normalizeSearchText(query);
  const c = normalizeSearchText(candidate);

  if (!q || !c) {
    return -1;
  }

  if (c === q) {
    return 400;
  }

  if (c.startsWith(q)) {
    return 300 - Math.max(0, c.length - q.length);
  }

  const wordIndex = c.indexOf(` ${q}`);
  if (wordIndex >= 0) {
    return 220 - wordIndex;
  }

  const containsIndex = c.indexOf(q);
  if (containsIndex >= 0) {
    return 140 - containsIndex;
  }

  return -1;
}

function formatChartValue(value: number, mode: "number" | "currency"): string {
  if (mode === "currency") {
    return usd(value);
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value: number, digits = 2): string {
  const rounded = Number(value.toFixed(digits));
  if (rounded === 100) {
    return "100%";
  }
  return `${rounded.toFixed(digits)}%`;
}

function formatDualAxisValue(value: number, mode: DualAxisValueFormat): string {
  if (mode === "percent") {
    return formatPercent(value);
  }
  return formatChartValue(value, mode === "currency" ? "currency" : "number");
}

function ProductThumbnail({
  imageUrl,
  alt,
  fallback,
  className = "h-16 w-12",
}: {
  imageUrl?: string;
  alt: string;
  fallback: string;
  className?: string;
}) {
  const fallbackText = fallback
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);

  return (
    <div
      className={`overflow-hidden rounded-lg border border-white/10 bg-[radial-gradient(circle_at_30%_20%,rgba(56,189,248,0.24),transparent_30%),radial-gradient(circle_at_70%_10%,rgba(217,70,239,0.18),transparent_28%),linear-gradient(160deg,rgba(8,47,73,0.9),rgba(15,23,42,0.95))] ${className}`}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full w-full items-center justify-center px-1 text-center text-xs font-semibold text-slate-100">
          {fallbackText || "GI"}
        </div>
      )}
    </div>
  );
}

function CardCell({
  imageUrl,
  name,
  number,
}: {
  imageUrl?: string;
  name: string;
  number?: string;
}) {
  return (
    <span className="flex w-full items-center justify-start gap-3 text-left">
      <ProductThumbnail
        imageUrl={imageUrl}
        alt={number ? `${name} ${number}` : name}
        fallback={name}
        className="h-14 w-10 shrink-0"
      />
      <span>
        {name}
        {number ? ` ${number}` : ""}
      </span>
    </span>
  );
}

function SealedCell({
  imageUrl,
  name,
}: {
  imageUrl?: string;
  name: string;
}) {
  return (
    <span className="flex w-full items-center justify-start gap-3 text-left">
      <ProductThumbnail imageUrl={imageUrl} alt={name} fallback={name} className="h-14 w-10 shrink-0" />
      <span>{name}</span>
    </span>
  );
}

function SignalDetailContent({
  alert,
}: {
  alert: DashboardData["topUndervalued"][number];
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-100">{alert.reason}</p>
      {alert.details?.length ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {alert.details.map((detail) => (
            <div key={`${alert.cardId}-${detail.label}`} className="rounded-lg bg-white/[0.04] px-3 py-2">
              <p className="text-[10px] capitalize tracking-wide text-slate-400">{detail.label}</p>
              <p className="mt-1 text-sm font-semibold text-slate-100">{detail.value}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400">No additional model inputs are available for this signal yet.</p>
      )}
    </div>
  );
}

function ExplainableMetricCard({
  id,
  expandedId,
  onToggle,
  title,
  value,
  status,
  summary,
  context,
  whyItMatters,
  methodology,
}: {
  id: string;
  expandedId: string | null;
  onToggle: (id: string | null) => void;
  title: string;
  value: string;
  status: string;
  summary: string;
  context: string;
  whyItMatters: string;
  methodology: string;
}) {
  const expanded = expandedId === id;

  return (
    <button
      type="button"
      onClick={() => onToggle(expanded ? null : id)}
      className={`rounded-xl p-3 text-left transition ${
        expanded ? "bg-cyan-500/10 ring-1 ring-cyan-300/30" : "bg-white/[0.035] hover:bg-white/[0.05]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="group/title relative inline-flex max-w-full">
            <span className="text-xs text-slate-300 underline decoration-dotted underline-offset-3">
              {title}
            </span>
            <span className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-64 rounded-lg border border-white/10 bg-slate-950/95 px-3 py-2 text-[11px] normal-case text-slate-100 shadow-lg shadow-black/35 group-hover/title:block">
              {summary}
            </span>
          </span>
          <p className="mt-1 text-lg font-semibold text-slate-100">{value}</p>
        </div>
        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold capitalize tracking-wide text-slate-200">
          {status}
        </span>
      </div>
      <p className="mt-2 text-xs text-cyan-100">{context}</p>
      <p className="mt-2 text-[11px] capitalize tracking-wide text-slate-400">
        {expanded ? "Hide Details" : "Click For Details"}
      </p>
      {expanded ? (
        <div className="mt-3 space-y-2 rounded-lg bg-black/20 p-3">
          <div>
            <p className="text-[10px] font-semibold capitalize tracking-wide text-slate-400">Why It Matters</p>
            <p className="mt-1 text-xs text-slate-200">{whyItMatters}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold capitalize tracking-wide text-slate-400">How It Is Calculated</p>
            <p className="mt-1 text-xs text-slate-200">{methodology}</p>
          </div>
        </div>
      ) : null}
    </button>
  );
}

function flipperMomentumClass(value: number): string {
  if (value >= 25) {
    return "text-emerald-200";
  }
  if (value >= 15) {
    return "text-cyan-200";
  }
  return "text-amber-200";
}

function flipperLiquidityClass(value: number): string {
  if (value >= 80) {
    return "text-emerald-200";
  }
  if (value >= 65) {
    return "text-cyan-200";
  }
  return "text-amber-200";
}

type AnalyticsTableColumn<T> = {
  key: string;
  label: string;
  value: (row: T) => string | number;
  render?: (row: T) => ReactNode;
  cellClassName?: string;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  filterable?: boolean;
};

function AnalyticsDataTable<T>({
  rows,
  columns,
  getRowId,
  emptyMessage,
  gridClassName,
  maxHeightClassName = "max-h-[30rem]",
  expandableColumnKey,
  renderExpandedRow,
  controlMode = "singleFilterHeaderSort",
}: {
  rows: T[];
  columns: AnalyticsTableColumn<T>[];
  getRowId: (row: T) => string;
  emptyMessage: string;
  gridClassName: string;
  maxHeightClassName?: string;
  expandableColumnKey?: string;
  renderExpandedRow?: (row: T) => ReactNode;
  controlMode?: "default" | "singleFilterHeaderSort";
}) {
  const resolveColumnAlign = (column: AnalyticsTableColumn<T>): "left" | "center" | "right" => {
    if (column.align) {
      return column.align;
    }
    if (column.label === "Card" || column.key === "cardName" || column.key === "card" || column.key === "productName") {
      return "left";
    }
    return "center";
  };

  const alignClassName = (align: "left" | "center" | "right"): string => {
    if (align === "left") {
      return "justify-start text-left";
    }
    if (align === "right") {
      return "justify-end text-right";
    }
    return "justify-center text-center";
  };

  const [sortKey, setSortKey] = useState(
    columns.find((column) => column.sortable !== false)?.key ?? columns[0]?.key ?? "",
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [singleFilterKey, setSingleFilterKey] = useState(
    columns.find((column) => column.filterable !== false)?.key ?? columns[0]?.key ?? "",
  );
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const sortableColumns = useMemo(
    () => columns.filter((column) => column.sortable !== false),
    [columns],
  );
  const filterableColumns = useMemo(
    () => columns.filter((column) => column.filterable !== false),
    [columns],
  );

  useEffect(() => {
    if (!sortableColumns.length) {
      if (sortKey) {
        setSortKey("");
      }
      return;
    }

    if (!sortableColumns.some((column) => column.key === sortKey)) {
      setSortKey(sortableColumns[0].key);
      setSortDirection("asc");
    }
  }, [sortKey, sortableColumns]);

  useEffect(() => {
    if (!filterableColumns.length) {
      if (singleFilterKey) {
        setSingleFilterKey("");
      }
      return;
    }

    if (!filterableColumns.some((column) => column.key === singleFilterKey)) {
      setSingleFilterKey(filterableColumns[0].key);
    }
  }, [filterableColumns, singleFilterKey]);

  const processedRows = useMemo(() => {
    const activeFilters =
      controlMode === "singleFilterHeaderSort"
        ? singleFilterKey && (filters[singleFilterKey] ?? "").trim()
          ? [[singleFilterKey, filters[singleFilterKey] ?? ""]]
          : []
        : Object.entries(filters).filter(([, value]) => value.trim());
    const sortColumn =
      sortableColumns.find((column) => column.key === sortKey) ??
      sortableColumns[0];
    const filtered = rows.filter((row) =>
      activeFilters.every(([key, filterValue]) => {
        const column = columns.find((entry) => entry.key === key);
        if (!column || column.filterable === false) {
          return true;
        }

        return String(column.value(row)).toLowerCase().includes(filterValue.trim().toLowerCase());
      }),
    );

    if (!sortColumn) {
      return filtered;
    }

    return filtered.slice().sort((left, right) => {
      const leftValue = sortColumn.value(left);
      const rightValue = sortColumn.value(right);

      let comparison = 0;
      if (typeof leftValue === "number" && typeof rightValue === "number") {
        comparison = leftValue - rightValue;
      } else {
        comparison = String(leftValue).localeCompare(String(rightValue), undefined, {
          numeric: true,
          sensitivity: "base",
        });
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [columns, controlMode, filters, rows, singleFilterKey, sortDirection, sortKey, sortableColumns]);

  return (
    <div className="space-y-2">
      {controlMode === "default" && sortableColumns.length ? (
        <div className="flex flex-col gap-2 rounded-xl bg-white/[0.025] px-3 py-2 text-xs text-slate-300">
          <label className="flex flex-col gap-1 sm:min-w-52">
            <span className="text-[10px] tracking-wide text-slate-400">Sort By</span>
            <select
              value={sortKey}
              onChange={(event) => {
                setSortKey(event.target.value);
                setSortDirection("asc");
              }}
              className="rounded-lg border border-white/10 bg-slate-950/40 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-300/40"
            >
              {sortableColumns.map((column) => (
                <option key={column.key} value={column.key}>
                  {column.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      {controlMode === "singleFilterHeaderSort" && filterableColumns.length ? (
        <div className="flex flex-col gap-2 rounded-xl bg-white/[0.025] px-3 py-2 text-xs text-slate-300">
          <span className="text-[10px] tracking-wide text-slate-400">Filter</span>
          <input
            value={singleFilterKey ? filters[singleFilterKey] ?? "" : ""}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                [singleFilterKey]: event.target.value,
              }))
            }
            placeholder={
              singleFilterKey
                ? `Search ${filterableColumns.find((column) => column.key === singleFilterKey)?.label ?? "Item"}`
                : "Search"
            }
            className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-2 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/40"
          />
          <select
            value={singleFilterKey}
            onChange={(event) => setSingleFilterKey(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-300/40"
          >
            {filterableColumns.map((column) => (
              <option key={column.key} value={column.key}>
                {column.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className={`grid ${gridClassName} items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-xs font-semibold capitalize tracking-wide text-slate-300`}>
        {columns.map((column) => (
          ((align) =>
          column.sortable === false ? (
            <span key={column.key} className={alignClassName(align)}>
              {column.label}
            </span>
          ) : (
            <button
              key={column.key}
              type="button"
              onClick={() => {
                if (sortKey === column.key) {
                  setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
                  return;
                }

                setSortKey(column.key);
                setSortDirection("asc");
              }}
              className={`${alignClassName(align)} hover:text-slate-100`}
            >
              {controlMode === "singleFilterHeaderSort" ? (
                <span className="block text-[9px] tracking-wide text-slate-500">Sort By</span>
              ) : null}
              {column.label}
              {sortKey === column.key ? (sortDirection === "asc" ? " ^" : " v") : ""}
            </button>
          ))(resolveColumnAlign(column))
        ))}
      </div>
      {controlMode === "default" ? (
        <div className={`grid ${gridClassName} gap-2 rounded-xl bg-white/[0.02] px-3 py-2`}>
          {columns.map((column) => (
            column.filterable === false ? (
              <div key={column.key} />
            ) : (
              <input
                key={column.key}
                value={filters[column.key] ?? ""}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    [column.key]: event.target.value,
                  }))
                }
                placeholder={`Filter ${column.label.toLowerCase()}`}
                className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-2 py-1 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/40"
              />
            )
          ))}
        </div>
      ) : null}
      <div className={`${maxHeightClassName} overflow-auto rounded-xl bg-white/[0.035] text-sm`}>
        {processedRows.length ? (
          processedRows.map((row) => {
            const rowId = getRowId(row);
            const isExpanded = expandedRowId === rowId;

            return (
              <div key={rowId} className="border-b border-white/5">
                <div className={`grid ${gridClassName} items-center gap-2 px-3 py-2 text-slate-100`}>
                  {columns.map((column) => {
                    const content = column.render ? column.render(row) : String(column.value(row));
                    const align = resolveColumnAlign(column);
                    const alignClass = alignClassName(align);
                    if (renderExpandedRow && expandableColumnKey === column.key) {
                      return (
                        <button
                          key={column.key}
                          type="button"
                          className={`flex h-full w-full items-center ${alignClass} ${column.cellClassName ?? ""} ${isExpanded ? "text-slate-50" : "hover:text-cyan-100"}`}
                          onClick={() => setExpandedRowId((current) => (current === rowId ? null : rowId))}
                        >
                          <span className="inline-flex items-center gap-2">
                            <span>{content}</span>
                            <span className="mt-0.5 text-[10px] capitalize tracking-wide text-slate-400">
                              {isExpanded ? "Hide" : "Details"}
                            </span>
                          </span>
                        </button>
                      );
                    }

                    return (
                      <div
                        key={column.key}
                        className={`flex h-full w-full items-center ${alignClass} ${column.cellClassName ?? ""}`}
                      >
                        {content}
                      </div>
                    );
                  })}
                </div>
                {renderExpandedRow && isExpanded ? (
                  <div className="px-3 pb-3">
                    <div className="section-panel-soft rounded-xl p-3 text-xs text-slate-200">
                      {renderExpandedRow(row)}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <p className="p-3 text-sm text-slate-300">{emptyMessage}</p>
        )}
      </div>
    </div>
  );
}

function SealedCollectionEditor({
  item,
  onSave,
  onRemove,
}: {
  item: SealedItem;
  onSave: (changes: {
    quantity: number;
    acquisitionPriceUsd?: number;
    estimatedValueUsd?: number;
    notes?: string;
  }) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [acquisitionPrice, setAcquisitionPrice] = useState(
    item.acquisitionPriceUsd?.toString() ?? "",
  );
  const [estimatedValue, setEstimatedValue] = useState(item.estimatedValueUsd?.toString() ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setQuantity(String(item.quantity));
    setAcquisitionPrice(item.acquisitionPriceUsd?.toString() ?? "");
    setEstimatedValue(item.estimatedValueUsd?.toString() ?? "");
    setNotes(item.notes ?? "");
  }, [item]);

  async function save() {
    const parsedQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
    const parsedAcquisition = acquisitionPrice.trim() ? Number(acquisitionPrice) : undefined;
    const parsedEstimated = estimatedValue.trim() ? Number(estimatedValue) : undefined;

    setBusy(true);
    try {
      await onSave({
        quantity: parsedQuantity,
        acquisitionPriceUsd:
          typeof parsedAcquisition === "number" && Number.isFinite(parsedAcquisition)
            ? parsedAcquisition
            : undefined,
        estimatedValueUsd:
          typeof parsedEstimated === "number" && Number.isFinite(parsedEstimated)
            ? parsedEstimated
            : undefined,
        notes: notes.trim() || undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await onRemove();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-4">
        <label className="space-y-1">
          <span className="text-[10px] capitalize tracking-wide text-slate-400">Quantity</span>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-2 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] capitalize tracking-wide text-slate-400">Acquisition Price</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={acquisitionPrice}
            onChange={(event) => setAcquisitionPrice(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-2 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] capitalize tracking-wide text-slate-400">Estimated Value</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={estimatedValue}
            onChange={(event) => setEstimatedValue(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-2 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] capitalize tracking-wide text-slate-400">Notes</span>
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-2 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-lg border border-cyan-300/30 bg-cyan-500/15 px-3 py-2 text-xs font-semibold capitalize tracking-wide text-cyan-100 disabled:opacity-60"
        >
          {busy ? "Saving..." : "Save Changes"}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="rounded-lg border border-rose-300/30 bg-rose-500/15 px-3 py-2 text-xs font-semibold capitalize tracking-wide text-rose-100 disabled:opacity-60"
        >
          Remove Item
        </button>
      </div>
    </div>
  );
}

function SealedWishlistEditor({
  item,
  onSave,
  onRemove,
}: {
  item: SealedWishlistItem;
  onSave: (changes: { targetPriceUsd?: number; priority: number; notes?: string }) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [targetPrice, setTargetPrice] = useState(item.targetPriceUsd?.toString() ?? "");
  const [priority, setPriority] = useState(String(item.priority));
  const [notes, setNotes] = useState(item.notes ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTargetPrice(item.targetPriceUsd?.toString() ?? "");
    setPriority(String(item.priority));
    setNotes(item.notes ?? "");
  }, [item]);

  async function save() {
    const parsedTarget = targetPrice.trim() ? Number(targetPrice) : undefined;
    const parsedPriority = Math.min(5, Math.max(1, Math.floor(Number(priority) || item.priority || 2)));

    setBusy(true);
    try {
      await onSave({
        targetPriceUsd:
          typeof parsedTarget === "number" && Number.isFinite(parsedTarget) ? parsedTarget : undefined,
        priority: parsedPriority,
        notes: notes.trim() || undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await onRemove();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-3">
        <label className="space-y-1">
          <span className="text-[10px] capitalize tracking-wide text-slate-400">Target Price</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={targetPrice}
            onChange={(event) => setTargetPrice(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-2 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] capitalize tracking-wide text-slate-400">Priority</span>
          <input
            type="number"
            min={1}
            max={5}
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-2 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] capitalize tracking-wide text-slate-400">Notes</span>
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-2 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-lg border border-cyan-300/30 bg-cyan-500/15 px-3 py-2 text-xs font-semibold capitalize tracking-wide text-cyan-100 disabled:opacity-60"
        >
          {busy ? "Saving..." : "Save Changes"}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="rounded-lg border border-rose-300/30 bg-rose-500/15 px-3 py-2 text-xs font-semibold capitalize tracking-wide text-rose-100 disabled:opacity-60"
        >
          Remove Item
        </button>
      </div>
    </div>
  );
}

function SealedSaleEditor({
  item,
  onSave,
  onRemove,
}: {
  item: SealedSaleAdminItem;
  onSave: (changes: {
    priceUsd: number;
    saleDate: string;
    source?: string;
    providerRef?: string;
  }) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [priceUsd, setPriceUsd] = useState(item.priceUsd.toString());
  const [saleDate, setSaleDate] = useState(item.saleDate.slice(0, 10));
  const [source, setSource] = useState(item.source ?? "");
  const [providerRef, setProviderRef] = useState(item.providerRef ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPriceUsd(item.priceUsd.toString());
    setSaleDate(item.saleDate.slice(0, 10));
    setSource(item.source ?? "");
    setProviderRef(item.providerRef ?? "");
  }, [item]);

  async function save() {
    const parsedPrice = Number(priceUsd);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      return;
    }

    setBusy(true);
    try {
      await onSave({
        priceUsd: parsedPrice,
        saleDate: new Date(`${saleDate}T00:00:00.000Z`).toISOString(),
        source: source.trim() || undefined,
        providerRef: providerRef.trim() || undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await onRemove();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-4">
        <label className="space-y-1">
          <span className="text-[10px] capitalize tracking-wide text-slate-400">Price</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={priceUsd}
            onChange={(event) => setPriceUsd(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-2 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] capitalize tracking-wide text-slate-400">Sale Date</span>
          <input
            type="date"
            value={saleDate}
            onChange={(event) => setSaleDate(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-2 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] capitalize tracking-wide text-slate-400">Source</span>
          <input
            value={source}
            onChange={(event) => setSource(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-2 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] capitalize tracking-wide text-slate-400">Provider Ref</span>
          <input
            value={providerRef}
            onChange={(event) => setProviderRef(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-2 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-lg border border-cyan-300/30 bg-cyan-500/15 px-3 py-2 text-xs font-semibold capitalize tracking-wide text-cyan-100 disabled:opacity-60"
        >
          {busy ? "Saving..." : "Save Changes"}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="rounded-lg border border-rose-300/30 bg-rose-500/15 px-3 py-2 text-xs font-semibold capitalize tracking-wide text-rose-100 disabled:opacity-60"
        >
          Remove Sale
        </button>
      </div>
    </div>
  );
}

function seriesPath(
  values: Array<number | undefined>,
  width: number,
  height: number,
  xOffset = 0,
  yOffset = 0,
  yMin?: number,
  yMax?: number,
): string {
  const points = values
    .map((value, index) => ({ value, index }))
    .filter((point): point is { value: number; index: number } => typeof point.value === "number");

  if (!points.length) {
    return "";
  }

  const max = typeof yMax === "number" ? yMax : Math.max(...points.map((point) => point.value));
  const min = typeof yMin === "number" ? yMin : Math.min(...points.map((point) => point.value));
  const range = max - min || 1;
  const xStep = values.length > 1 ? width / (values.length - 1) : width;

  return points
    .map((point, idx) => {
      const x = xOffset + point.index * xStep;
      const y = yOffset + height - ((point.value - min) / range) * height;
      return `${idx === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function chartPointPosition(
  values: Array<number | undefined>,
  index: number,
  width: number,
  height: number,
  xOffset = 0,
  yOffset = 0,
  yMin?: number,
  yMax?: number,
): { x: number; y: number; value: number } | null {
  const value = values[index];
  if (typeof value !== "number") {
    return null;
  }

  const points = values.filter((point): point is number => typeof point === "number");
  if (!points.length) {
    return null;
  }

  const max = typeof yMax === "number" ? yMax : Math.max(...points);
  const min = typeof yMin === "number" ? yMin : Math.min(...points);
  const range = max - min || 1;
  const xStep = values.length > 1 ? width / (values.length - 1) : width / 2;
  const x = values.length > 1 ? xOffset + index * xStep : xOffset + width / 2;
  const y = yOffset + height - ((value - min) / range) * height;

  return { x, y, value };
}

function MultiSeriesChart({
  labels,
  series,
  valueMode = "number",
  defaultRange = "12M",
  showRangeControls = true,
}: {
  labels: string[];
  series: Array<{ label: string; color: string; values: Array<number | undefined> }>;
  valueMode?: "number" | "currency";
  defaultRange?: ChartRangeOption;
  showRangeControls?: boolean;
}) {
  const [range, setRange] = useState<ChartRangeOption>(defaultRange);
  const plotTop = 12;
  const plotHeight = 148;
  const innerPlotHeight = plotHeight - plotTop;
  const axisHeight = 32;
  const height = plotHeight + axisHeight;
  const plotPadding = 28;
  const rangeLimit = chartRangeLimit(range);
  const startIndex = rangeLimit === null ? 0 : Math.max(0, labels.length - rangeLimit);
  const visibleLabels = labels.slice(startIndex);
  const visibleSeries = series.map((entry) => ({
    ...entry,
    values: entry.values.slice(startIndex),
  }));
  const pointSpacing = 88;
  const width = Math.max(
    560,
    plotPadding * 2 + (visibleLabels.length > 1 ? (visibleLabels.length - 1) * pointSpacing : 260),
  );
  const plotLeft = plotPadding;
  const plotRight = width - plotPadding;
  const plotWidth = plotRight - plotLeft;
  const activeSeries = visibleSeries.filter((item) => item.values.some((value) => typeof value === "number"));
  const activeSeriesValues = activeSeries.flatMap((item) =>
    item.values.filter((value): value is number => typeof value === "number"),
  );
  const yMin = activeSeriesValues.length ? Math.min(...activeSeriesValues) : 0;
  const yMax = activeSeriesValues.length ? Math.max(...activeSeriesValues) : 1;
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const xStep = visibleLabels.length > 1 ? plotWidth / (visibleLabels.length - 1) : plotWidth / 2;

  if (!visibleLabels.length || !activeSeries.length) {
    return <p className="text-sm text-slate-300">Not enough market history to chart yet.</p>;
  }

  const hoveredLabel = hoverIndex !== null ? visibleLabels[hoverIndex] : null;
  const hoveredPoints =
    hoverIndex !== null
        ? activeSeries
            .map((entry) => ({
              entry,
              point: chartPointPosition(
                entry.values,
                hoverIndex,
                plotWidth,
                innerPlotHeight,
                plotLeft,
                plotTop,
                yMin,
                yMax,
              ),
            }))
          .filter(
            (
              item,
            ): item is {
              entry: { label: string; color: string; values: Array<number | undefined> };
              point: { x: number; y: number; value: number };
            } => item.point !== null,
          )
      : [];
  const hoveredX = hoveredPoints[0]?.point.x ?? null;

  return (
    <div className="space-y-3">
      {showRangeControls ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {(["3M", "6M", "12M", "ALL"] as ChartRangeOption[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setRange(option);
                  setHoverIndex(null);
                }}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold text-slate-100 transition ${
                  range === option
                    ? "border-cyan-300/40 bg-cyan-500/18 text-cyan-100"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400">Range</p>
        </div>
      ) : null}
      <div className="relative overflow-x-auto pb-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-48 rounded-xl bg-slate-950/30"
          style={{ width: `${width}px`, minWidth: "100%" }}
          role="img"
          aria-label="Market price history chart"
          onMouseLeave={() => setHoverIndex(null)}
        >
          {[0.25, 0.5, 0.75].map((ratio) => (
            <line
              key={ratio}
              x1={plotLeft}
              x2={plotRight}
              y1={plotTop + innerPlotHeight * ratio}
              y2={plotTop + innerPlotHeight * ratio}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
            />
          ))}
          {activeSeries.map((entry) => {
            const path = seriesPath(
              entry.values,
              plotWidth,
              innerPlotHeight,
              plotLeft,
              plotTop,
              yMin,
              yMax,
            );
            return path ? (
              <path
                key={entry.label}
                d={path}
                fill="none"
                stroke={entry.color}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null;
          })}
          {activeSeries.flatMap((entry) =>
            entry.values.map((value, index) => {
              if (typeof value !== "number") {
                return null;
              }
              const point = chartPointPosition(
                entry.values,
                index,
                plotWidth,
                innerPlotHeight,
                plotLeft,
                plotTop,
                yMin,
                yMax,
              );
              if (!point) {
                return null;
              }
              return (
                <circle
                  key={`${entry.label}-marker-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r="2.75"
                  fill={entry.color}
                  stroke="rgba(15,23,42,0.92)"
                  strokeWidth="1.5"
                  pointerEvents="none"
                />
              );
            }),
          )}
          {hoveredX !== null ? (
            <line
              x1={hoveredX}
              x2={hoveredX}
              y1={plotTop}
              y2={plotHeight}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          ) : null}
          <line
            x1={plotLeft}
            x2={plotRight}
            y1={plotHeight}
            y2={plotHeight}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1"
          />
          {hoveredPoints.map(({ entry, point }) => (
            <circle
              key={`${entry.label}-${hoverIndex}`}
              cx={point.x}
              cy={point.y}
              r="4"
              fill={entry.color}
              stroke="rgba(15,23,42,0.95)"
              strokeWidth="2"
            />
          ))}
          {visibleLabels.map((label, index) => {
            const x = visibleLabels.length > 1 ? plotLeft + index * xStep : plotLeft + plotWidth / 2;
            const xStart =
              visibleLabels.length === 1
                ? plotLeft
                : Math.max(plotLeft, index === 0 ? plotLeft : x - xStep / 2);
            const rectWidth =
              visibleLabels.length === 1
                ? plotWidth
                : Math.min(
                    plotRight - xStart,
                    index === visibleLabels.length - 1 ? plotRight - xStart : xStep,
                  );

            return (
              <g key={label}>
                <line
                  x1={x}
                  x2={x}
                  y1={plotHeight}
                  y2={plotHeight + 6}
                  stroke="rgba(255,255,255,0.14)"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={height - 8}
                  textAnchor="middle"
                  fill={hoverIndex === index ? "rgba(226,232,240,1)" : "rgba(148,163,184,0.9)"}
                  fontSize="11"
                >
                  {label}
                </text>
                <rect
                  x={xStart}
                  y="0"
                  width={rectWidth}
                  height={height}
                  fill="transparent"
                  onMouseEnter={() => setHoverIndex(index)}
                  onFocus={() => setHoverIndex(index)}
                  onClick={() => setHoverIndex(index)}
                />
              </g>
            );
          })}
        </svg>
        {hoverIndex !== null && hoveredLabel ? (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-lg border border-white/10 bg-slate-950/90 px-3 py-2 text-xs text-slate-100 shadow-lg shadow-black/30"
            style={{
              left: hoveredX !== null ? `${Math.min(92, Math.max(8, (hoveredX / width) * 100))}%` : "50%",
              transform: "translateX(-50%)",
            }}
          >
            <p className="font-semibold text-slate-50">{hoveredLabel}</p>
            <div className="mt-1 space-y-1">
              {hoveredPoints.map(({ entry, point }) => (
                <div key={`${entry.label}-tooltip`} className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-slate-200">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: entry.color }}
                      aria-hidden="true"
                    />
                    {entry.label}
                  </span>
                  <span className="font-medium text-slate-50">{formatChartValue(point.value, valueMode)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-slate-300">
        {activeSeries.map((entry) => (
          <span key={entry.label} className="inline-flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: entry.color }}
              aria-hidden="true"
            />
            {entry.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ComboSeriesChart({
  labels,
  bars,
  line,
  showRangeControls = true,
}: {
  labels: string[];
  bars: { label: string; color: string; values: Array<number | undefined> };
  line: { label: string; color: string; values: Array<number | undefined> };
  showRangeControls?: boolean;
}) {
  const [range, setRange] = useState<ChartRangeOption>("12M");
  const plotTop = 12;
  const width = 560;
  const plotHeight = 156;
  const innerPlotHeight = plotHeight - plotTop;
  const axisHeight = 32;
  const height = plotHeight + axisHeight;
  const plotPadding = 18;
  const rangeLimit = chartRangeLimit(range);
  const startIndex = rangeLimit === null ? 0 : Math.max(0, labels.length - rangeLimit);
  const visibleLabels = labels.slice(startIndex);
  const visibleBarValues = bars.values.slice(startIndex);
  const visibleLineValues = line.values.slice(startIndex);
  const plotLeft = plotPadding;
  const plotRight = width - plotPadding;
  const plotWidth = plotRight - plotLeft;
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const barPoints = visibleBarValues.filter((value): value is number => typeof value === "number" && value > 0);
  const linePoints = visibleLineValues.filter((value): value is number => typeof value === "number");
  const maxBar = Math.max(1, ...barPoints);
  const maxLine = Math.max(1, ...linePoints);
  const bandWidth = visibleLabels.length ? plotWidth / visibleLabels.length : plotWidth;

  if (!visibleLabels.length || (!barPoints.length && !linePoints.length)) {
    return <p className="text-sm text-slate-300">Not enough sealed market history to chart yet.</p>;
  }

  const hoveredLabel = hoverIndex !== null ? visibleLabels[hoverIndex] : null;
  const hoveredBar = hoverIndex !== null ? visibleBarValues[hoverIndex] : undefined;
  const hoveredLine = hoverIndex !== null ? visibleLineValues[hoverIndex] : undefined;
  const hoveredX =
    hoverIndex !== null
      ? Math.min(plotRight - bandWidth / 2, plotLeft + hoverIndex * bandWidth + bandWidth / 2)
      : null;
  const linePath = visibleLineValues
    .map((value, index) => {
      if (typeof value !== "number") {
        return null;
      }
      const x = Math.min(plotRight - bandWidth / 2, plotLeft + index * bandWidth + bandWidth / 2);
      const y = plotTop + innerPlotHeight - (value / maxLine) * innerPlotHeight;
      return `${index === 0 || typeof visibleLineValues[index - 1] !== "number" ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .filter((segment): segment is string => Boolean(segment))
    .join(" ");

  return (
    <div className="space-y-3">
      {showRangeControls ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {(["3M", "6M", "12M", "ALL"] as ChartRangeOption[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setRange(option);
                  setHoverIndex(null);
                }}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold text-slate-100 transition ${
                  range === option
                    ? "border-cyan-300/40 bg-cyan-500/18 text-cyan-100"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400">Range</p>
        </div>
      ) : null}
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-52 w-full rounded-xl bg-slate-950/30"
          role="img"
          aria-label="Sealed supply and market value chart"
          onMouseLeave={() => setHoverIndex(null)}
        >
          {[0.25, 0.5, 0.75].map((ratio) => (
            <line
              key={ratio}
              x1={plotLeft}
              x2={plotRight}
              y1={plotTop + innerPlotHeight * ratio}
              y2={plotTop + innerPlotHeight * ratio}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
            />
          ))}
          {visibleBarValues.map((value, index) => {
            if (typeof value !== "number" || value <= 0) {
              return null;
            }
            const barWidth = Math.max(10, bandWidth * 0.56);
            const x = Math.min(
              plotRight - barWidth,
              Math.max(plotLeft, plotLeft + index * bandWidth + (bandWidth - barWidth) / 2),
            );
            const barHeight = (value / maxBar) * innerPlotHeight;
            const y = plotTop + innerPlotHeight - barHeight;
            return (
              <rect
                key={`${bars.label}-${visibleLabels[index]}`}
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx="8"
                fill={bars.color}
                opacity={hoverIndex === index ? 0.95 : 0.72}
              />
            );
          })}
          {linePath ? (
            <path
              d={linePath}
              fill="none"
              stroke={line.color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {visibleLineValues.map((value, index) => {
            if (typeof value !== "number") {
              return null;
            }
            const x = Math.min(plotRight - bandWidth / 2, plotLeft + index * bandWidth + bandWidth / 2);
            const y = plotTop + innerPlotHeight - (value / maxLine) * innerPlotHeight;
            return (
              <circle
                key={`${line.label}-marker-${index}`}
                cx={x}
                cy={y}
                r="2.9"
                fill={line.color}
                stroke="rgba(15,23,42,0.92)"
                strokeWidth="1.5"
                pointerEvents="none"
              />
            );
          })}
          {hoveredX !== null ? (
            <line
              x1={hoveredX}
              x2={hoveredX}
              y1={plotTop}
              y2={plotHeight}
              stroke="rgba(255,255,255,0.16)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          ) : null}
          {hoverIndex !== null && typeof hoveredLine === "number" && hoveredX !== null ? (
            <circle
              cx={hoveredX}
              cy={plotTop + innerPlotHeight - (hoveredLine / maxLine) * innerPlotHeight}
              r="4.5"
              fill={line.color}
              stroke="rgba(15,23,42,0.95)"
              strokeWidth="2"
            />
          ) : null}
          <line
            x1={plotLeft}
            x2={plotRight}
            y1={plotHeight}
            y2={plotHeight}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1"
          />
          {visibleLabels.map((label, index) => {
            const xCenter = Math.min(plotRight - bandWidth / 2, plotLeft + index * bandWidth + bandWidth / 2);
            const xStart = Math.max(plotLeft, plotLeft + index * bandWidth);
            const rectWidth = Math.min(plotRight - xStart, bandWidth);

            return (
              <g key={`${label}-${index}`}>
                <line
                  x1={xCenter}
                  x2={xCenter}
                  y1={plotHeight}
                  y2={plotHeight + 6}
                  stroke="rgba(255,255,255,0.14)"
                  strokeWidth="1"
                />
                <text
                  x={xCenter}
                  y={height - 8}
                  textAnchor="middle"
                  fill={hoverIndex === index ? "rgba(226,232,240,1)" : "rgba(148,163,184,0.9)"}
                  fontSize="11"
                >
                  {label}
                </text>
                <rect
                  x={xStart}
                  y="0"
                  width={rectWidth}
                  height={height}
                  fill="transparent"
                  onMouseEnter={() => setHoverIndex(index)}
                  onFocus={() => setHoverIndex(index)}
                  onClick={() => setHoverIndex(index)}
                />
              </g>
            );
          })}
        </svg>
        {hoverIndex !== null && hoveredLabel ? (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-44 rounded-lg border border-white/10 bg-slate-950/90 px-3 py-2 text-xs text-slate-100 shadow-lg shadow-black/30"
            style={{
              left: hoveredX !== null ? `${Math.min(92, Math.max(8, (hoveredX / width) * 100))}%` : "50%",
              transform: "translateX(-50%)",
            }}
          >
            <p className="font-semibold text-slate-50">{hoveredLabel}</p>
            <div className="mt-1 space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-slate-200">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: bars.color }}
                    aria-hidden="true"
                  />
                  {bars.label}
                </span>
                <span className="font-medium text-slate-50">
                  {typeof hoveredBar === "number" ? formatChartValue(hoveredBar, "number") : "No data"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-slate-200">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: line.color }}
                    aria-hidden="true"
                  />
                  {line.label}
                </span>
                <span className="font-medium text-slate-50">
                  {typeof hoveredLine === "number" ? formatChartValue(hoveredLine, "currency") : "No data"}
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: bars.color }}
            aria-hidden="true"
          />
          {bars.label}
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: line.color }}
            aria-hidden="true"
          />
          {line.label}
        </span>
      </div>
    </div>
  );
}

function DualAxisLineChart({
  labels,
  left,
  right,
  showRangeControls = true,
}: {
  labels: string[];
  left: { label: string; color: string; values: Array<number | undefined>; valueFormat: DualAxisValueFormat };
  right: { label: string; color: string; values: Array<number | undefined>; valueFormat: DualAxisValueFormat };
  showRangeControls?: boolean;
}) {
  const [range, setRange] = useState<ChartRangeOption>("12M");
  const plotTop = 12;
  const width = 560;
  const plotHeight = 156;
  const innerPlotHeight = plotHeight - plotTop;
  const axisHeight = 32;
  const height = plotHeight + axisHeight;
  const plotPadding = 18;
  const rangeLimit = chartRangeLimit(range);
  const startIndex = rangeLimit === null ? 0 : Math.max(0, labels.length - rangeLimit);
  const visibleLabels = labels.slice(startIndex);
  const leftValues = left.values.slice(startIndex);
  const rightValues = right.values.slice(startIndex);
  const plotLeft = plotPadding;
  const plotRight = width - plotPadding;
  const plotWidth = plotRight - plotLeft;
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const bandWidth = visibleLabels.length ? plotWidth / visibleLabels.length : plotWidth;

  const leftPoints = leftValues.filter((value): value is number => typeof value === "number");
  const rightPoints = rightValues.filter((value): value is number => typeof value === "number");

  if (!visibleLabels.length || (!leftPoints.length && !rightPoints.length)) {
    return <p className="text-sm text-slate-300">Not enough market history to chart yet.</p>;
  }

  const leftMin = leftPoints.length ? Math.min(...leftPoints) : 0;
  const leftMax = leftPoints.length ? Math.max(...leftPoints) : 1;
  const rightMin = rightPoints.length ? Math.min(...rightPoints) : 0;
  const rightMax = rightPoints.length ? Math.max(...rightPoints) : 1;

  const leftPath = seriesPath(leftValues, plotWidth, innerPlotHeight, plotLeft, plotTop, leftMin, leftMax);
  const rightPath = seriesPath(
    rightValues,
    plotWidth,
    innerPlotHeight,
    plotLeft,
    plotTop,
    rightMin,
    rightMax,
  );

  const hoveredLabel = hoverIndex !== null ? visibleLabels[hoverIndex] : null;
  const hoveredX =
    hoverIndex !== null
      ? Math.min(plotRight - bandWidth / 2, plotLeft + hoverIndex * bandWidth + bandWidth / 2)
      : null;
  const hoveredLeftPoint =
    hoverIndex !== null
      ? chartPointPosition(leftValues, hoverIndex, plotWidth, innerPlotHeight, plotLeft, plotTop, leftMin, leftMax)
      : null;
  const hoveredRightPoint =
    hoverIndex !== null
      ? chartPointPosition(
          rightValues,
          hoverIndex,
          plotWidth,
          innerPlotHeight,
          plotLeft,
          plotTop,
          rightMin,
          rightMax,
        )
      : null;

  return (
    <div className="space-y-3">
      {showRangeControls ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {(["3M", "6M", "12M", "ALL"] as ChartRangeOption[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setRange(option);
                  setHoverIndex(null);
                }}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold text-slate-100 transition ${
                  range === option
                    ? "border-cyan-300/40 bg-cyan-500/18 text-cyan-100"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400">Range</p>
        </div>
      ) : null}
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-52 w-full rounded-xl bg-slate-950/30"
          role="img"
          aria-label="Dual-axis line chart"
          onMouseLeave={() => setHoverIndex(null)}
        >
          {[0.25, 0.5, 0.75].map((ratio) => (
            <line
              key={ratio}
              x1={plotLeft}
              x2={plotRight}
              y1={plotTop + innerPlotHeight * ratio}
              y2={plotTop + innerPlotHeight * ratio}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
            />
          ))}
          {leftPath ? (
            <path
              d={leftPath}
              fill="none"
              stroke={left.color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {leftValues.map((value, index) => {
            if (typeof value !== "number") {
              return null;
            }
            const point = chartPointPosition(
              leftValues,
              index,
              plotWidth,
              innerPlotHeight,
              plotLeft,
              plotTop,
              leftMin,
              leftMax,
            );
            if (!point) {
              return null;
            }
            return (
              <circle
                key={`${left.label}-marker-${index}`}
                cx={point.x}
                cy={point.y}
                r="2.9"
                fill={left.color}
                stroke="rgba(15,23,42,0.92)"
                strokeWidth="1.5"
                pointerEvents="none"
              />
            );
          })}
          {rightPath ? (
            <path
              d={rightPath}
              fill="none"
              stroke={right.color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {rightValues.map((value, index) => {
            if (typeof value !== "number") {
              return null;
            }
            const point = chartPointPosition(
              rightValues,
              index,
              plotWidth,
              innerPlotHeight,
              plotLeft,
              plotTop,
              rightMin,
              rightMax,
            );
            if (!point) {
              return null;
            }
            return (
              <circle
                key={`${right.label}-marker-${index}`}
                cx={point.x}
                cy={point.y}
                r="2.9"
                fill={right.color}
                stroke="rgba(15,23,42,0.92)"
                strokeWidth="1.5"
                pointerEvents="none"
              />
            );
          })}
          {hoveredX !== null ? (
            <line
              x1={hoveredX}
              x2={hoveredX}
              y1={plotTop}
              y2={plotHeight}
              stroke="rgba(255,255,255,0.16)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          ) : null}
          {hoveredLeftPoint ? (
            <circle
              cx={hoveredLeftPoint.x}
              cy={hoveredLeftPoint.y}
              r="4.5"
              fill={left.color}
              stroke="rgba(15,23,42,0.95)"
              strokeWidth="2"
            />
          ) : null}
          {hoveredRightPoint ? (
            <circle
              cx={hoveredRightPoint.x}
              cy={hoveredRightPoint.y}
              r="4.5"
              fill={right.color}
              stroke="rgba(15,23,42,0.95)"
              strokeWidth="2"
            />
          ) : null}
          <line
            x1={plotLeft}
            x2={plotRight}
            y1={plotHeight}
            y2={plotHeight}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1"
          />
          {visibleLabels.map((label, index) => {
            const xCenter = Math.min(plotRight - bandWidth / 2, plotLeft + index * bandWidth + bandWidth / 2);
            const xStart = Math.max(plotLeft, plotLeft + index * bandWidth);
            const rectWidth = Math.min(plotRight - xStart, bandWidth);

            return (
              <g key={`${label}-${index}`}>
                <line
                  x1={xCenter}
                  x2={xCenter}
                  y1={plotHeight}
                  y2={plotHeight + 6}
                  stroke="rgba(255,255,255,0.14)"
                  strokeWidth="1"
                />
                <text
                  x={xCenter}
                  y={height - 8}
                  textAnchor="middle"
                  fill={hoverIndex === index ? "rgba(226,232,240,1)" : "rgba(148,163,184,0.9)"}
                  fontSize="11"
                >
                  {label}
                </text>
                <rect
                  x={xStart}
                  y="0"
                  width={rectWidth}
                  height={height}
                  fill="transparent"
                  onMouseEnter={() => setHoverIndex(index)}
                  onFocus={() => setHoverIndex(index)}
                  onClick={() => setHoverIndex(index)}
                />
              </g>
            );
          })}
        </svg>
        {hoverIndex !== null && hoveredLabel ? (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-44 rounded-lg border border-white/10 bg-slate-950/90 px-3 py-2 text-xs text-slate-100 shadow-lg shadow-black/30"
            style={{
              left: hoveredX !== null ? `${Math.min(92, Math.max(8, (hoveredX / width) * 100))}%` : "50%",
              transform: "translateX(-50%)",
            }}
          >
            <p className="font-semibold text-slate-50">{hoveredLabel}</p>
            <div className="mt-1 space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-slate-200">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: left.color }}
                    aria-hidden="true"
                  />
                  {left.label}
                </span>
                <span className="font-medium text-slate-50">
                  {hoveredLeftPoint ? formatDualAxisValue(hoveredLeftPoint.value, left.valueFormat) : "No data"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-slate-200">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: right.color }}
                    aria-hidden="true"
                  />
                  {right.label}
                </span>
                <span className="font-medium text-slate-50">
                  {hoveredRightPoint ? formatDualAxisValue(hoveredRightPoint.value, right.valueFormat) : "No data"}
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: left.color }}
            aria-hidden="true"
          />
          {left.label}
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: right.color }}
            aria-hidden="true"
          />
          {right.label}
        </span>
      </div>
    </div>
  );
}

export function GemIndexApp() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [loginIdentifier, setLoginIdentifier] = useState("demo");
  const [loginPassword, setLoginPassword] = useState("demo1234");
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPasswordConfirm, setRegPasswordConfirm] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [showVerificationPanel, setShowVerificationPanel] = useState(false);
  const [showRecoveryPanel, setShowRecoveryPanel] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [recoveryResetToken, setRecoveryResetToken] = useState("");
  const [recoveryNewPassword, setRecoveryNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [cards, setCards] = useState<CardApi[]>([]);
  const [sets, setSets] = useState<SetMetrics[]>([]);
  const [sealedSetHistory, setSealedSetHistory] = useState<SetSealedHistory[]>([]);
  const [portfolios, setPortfolios] = useState<PortfolioApi[]>([]);
  const [dataQuality, setDataQuality] = useState<DataQualitySnapshot | null>(null);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [collection, setCollection] = useState<CollectionItem[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [sealedProducts, setSealedProducts] = useState<SealedCatalogProduct[]>([]);
  const [adminSealedSales, setAdminSealedSales] = useState<SealedSaleAdminItem[]>([]);
  const [sealed, setSealed] = useState<SealedItem[]>([]);
  const [sealedWishlist, setSealedWishlist] = useState<SealedWishlistItem[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRuleApi[]>([]);
  const [alertEvents, setAlertEvents] = useState<AlertEventApi[]>([]);
  const [alertUnreadCount, setAlertUnreadCount] = useState(0);
  const [outbox, setOutbox] = useState<OutboxEmail[]>([]);
  const [scanText, setScanText] = useState("");
  const [scanDest, setScanDest] = useState<"COLLECTION" | "WISHLIST" | "PRICE_CHECK">("COLLECTION");
  const [scanImageFile, setScanImageFile] = useState<File | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [scanResult, setScanResult] = useState<ImageScanResponse | null>(null);
  const [scanSelectedSealedId, setScanSelectedSealedId] = useState("");
  const [scannerActionBusy, setScannerActionBusy] = useState(false);
  const [planBusy, setPlanBusy] = useState(false);
  const [syncPageLimit, setSyncPageLimit] = useState(25);
  const [manualCatalogResult, setManualCatalogResult] = useState<SyncTaskApi | null>(null);
  const [quickCardId, setQuickCardId] = useState("");
  const [quickSealedId, setQuickSealedId] = useState("");
  const [quickSealedProductId, setQuickSealedProductId] = useState("");
  const [sealedSaleProductId, setSealedSaleProductId] = useState("");
  const [sealedSalePrice, setSealedSalePrice] = useState("");
  const [sealedSaleDate, setSealedSaleDate] = useState("2026-02-28");
  const [sealedSaleSource, setSealedSaleSource] = useState("manual-sealed-admin");
  const [sealedSaleProviderRef, setSealedSaleProviderRef] = useState("");
  const [sealedSalesCsvFile, setSealedSalesCsvFile] = useState<File | null>(null);
  const [expandedDashboardKpi, setExpandedDashboardKpi] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<HomeTab>("ANALYTICS_DASHBOARD");
  const [quickActionMode, setQuickActionMode] = useState<"RAW" | "SEALED" | "GRADED">("RAW");
  const [quickRawName, setQuickRawName] = useState("");
  const [quickRawNumber, setQuickRawNumber] = useState("");
  const [quickRawSelectedCardId, setQuickRawSelectedCardId] = useState("");
  const [quickRawCondition, setQuickRawCondition] = useState<RawCardCondition>("NM");
  const [quickSealedSetName, setQuickSealedSetName] = useState("");
  const [quickSealedType, setQuickSealedType] = useState<
    "ALL" | "BOOSTER_BOX" | "ELITE_TRAINER_BOX" | "COLLECTION_BOX" | "TIN" | "BLISTER" | "OTHER"
  >("ALL");
  const [quickSealedSelectedProductId, setQuickSealedSelectedProductId] = useState("");
  const [quickGradedQuery, setQuickGradedQuery] = useState("");
  const [quickGradedSelectedValue, setQuickGradedSelectedValue] = useState("");
  const [quickGradedGrader, setQuickGradedGrader] = useState<"PSA" | "TAG">("PSA");
  const [quickGradedCertificationNumber, setQuickGradedCertificationNumber] = useState("");
  const [quickGradedGrade, setQuickGradedGrade] = useState("10");
  const [selectedPortfolioView, setSelectedPortfolioView] = useState<"ALL" | string>("ALL");
  const [newPortfolioName, setNewPortfolioName] = useState("");
  const [selectedSealedSetId, setSelectedSealedSetId] = useState("");
  const [selectedSealedMarketType, setSelectedSealedMarketType] =
    useState<SealedMarketTypeFilter>("BOOSTER_BOX");
  const [selectedSetRatioSetId, setSelectedSetRatioSetId] = useState("");
  const [setRatioHistoryRange, setSetRatioHistoryRange] = useState<ChartRangeOption>("12M");
  const [cardSearch, setCardSearch] = useState("");
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [searchDropdownIndex, setSearchDropdownIndex] = useState(0);
  const [headerBackgroundId, setHeaderBackgroundId] = useState<HeaderBackgroundId>("DEFAULT");
  const [settingsSubsection, setSettingsSubsection] = useState<
    "ACCOUNT" | "HEADER_BACKGROUND" | "BILLING_INFORMATION" | "ALERTS"
  >("ACCOUNT");
  const [accountFirstName, setAccountFirstName] = useState("");
  const [accountLastName, setAccountLastName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [accountCurrentPassword, setAccountCurrentPassword] = useState("");
  const [accountNewPassword, setAccountNewPassword] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [cardAlertCondition, setCardAlertCondition] = useState<AlertRuleApi["condition"]>("PRICE_BELOW");
  const [cardAlertThreshold, setCardAlertThreshold] = useState("");
  const [cardAlertLookback, setCardAlertLookback] = useState("3");
  const [cardAlertBusy, setCardAlertBusy] = useState(false);
  const [sealedAlertCondition, setSealedAlertCondition] = useState<AlertRuleApi["condition"]>("PRICE_BELOW");
  const [sealedAlertThreshold, setSealedAlertThreshold] = useState("");
  const [sealedAlertLookback, setSealedAlertLookback] = useState("3");
  const [sealedAlertBusy, setSealedAlertBusy] = useState(false);
  const [setAlertCondition, setSetAlertCondition] = useState<AlertRuleApi["condition"]>("PRICE_BELOW");
  const [setAlertThreshold, setSetAlertThreshold] = useState("");
  const [setAlertLookback, setSetAlertLookback] = useState("3");
  const [setAlertBusy, setSetAlertBusy] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(HEADER_BACKGROUND_STORAGE_KEY);
    if (!stored) {
      return;
    }

    const selected = HEADER_BACKGROUND_OPTIONS.find((option) => option.id === stored);
    if (selected) {
      setHeaderBackgroundId(selected.id);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(HEADER_BACKGROUND_STORAGE_KEY, headerBackgroundId);
  }, [headerBackgroundId]);

  useEffect(() => {
    if (!user) {
      setAccountFirstName("");
      setAccountLastName("");
      setAccountEmail("");
      setAccountCurrentPassword("");
      setAccountNewPassword("");
      return;
    }

    const parsedName = splitUserName(user.name);
    setAccountFirstName(parsedName.firstName);
    setAccountLastName(parsedName.lastName);
    setAccountEmail(user.email);
    setAccountCurrentPassword("");
    setAccountNewPassword("");
  }, [user]);

  function can(feature: keyof SyncStatus["features"]): boolean {
    if (user?.role === "ADMIN" && !sync?.features) {
      return true;
    }
    return Boolean(sync?.features?.[feature]);
  }

  async function refresh(includeOutbox = false) {
    const [d, c, s, y, p, co, wi, sp, se, sw, al] = await Promise.all([
      api<DashboardData>("/api/dashboard"),
      api<CardsResponse>("/api/cards"),
      api<SetsResponse>("/api/sets"),
      api<SyncStatus>("/api/sync/status"),
      api<{ items: PortfolioApi[] }>("/api/portfolios"),
      api<{ items: CollectionItem[] }>("/api/collection"),
      api<{ items: WishlistItem[] }>("/api/wishlist"),
      api<{ items: SealedCatalogProduct[] }>("/api/sealed-products"),
      api<{ items: SealedItem[] }>("/api/sealed"),
      api<{ items: SealedWishlistItem[] }>("/api/sealed-wishlist"),
      api<AlertsResponse>("/api/alerts"),
    ]);
    setDashboard(d);
    setCards(c.items);
    setSets(s.items);
    setSealedSetHistory(s.sealedSetHistory ?? []);
    setDataQuality(d.dataQuality ?? c.dataQuality ?? s.dataQuality);
    setSync(y);
    setPortfolios(p.items);
    setCollection(co.items);
    setWishlist(wi.items);
    setSealedProducts(sp.items);
    setSealed(se.items);
    setSealedWishlist(sw.items);
    setAlertRules(al.rules);
    setAlertEvents(al.events);
    setAlertUnreadCount(al.unreadCount);
    if (!quickCardId && c.items.length) {
      setQuickCardId(c.items[0].cardId);
    }
    if (!quickSealedProductId && sp.items.length) {
      setQuickSealedProductId(sp.items[0].id);
    }
    if (!sealedSaleProductId && sp.items.length) {
      setSealedSaleProductId(sp.items[0].id);
    }
    const selectablePortfolios = p.items.filter((portfolio) => portfolio.name !== "Main Portfolio");
    if (
      selectedPortfolioView !== "ALL" &&
      (!selectablePortfolios.length || !selectablePortfolios.some((portfolio) => portfolio.id === selectedPortfolioView))
    ) {
      setSelectedPortfolioView("ALL");
    }
    if (!selectedSealedSetId && (s.sealedSetHistory?.length ?? 0) > 0) {
      setSelectedSealedSetId((s.sealedSetHistory as SetSealedHistory[])[0].setId);
    }

    if (includeOutbox) {
      try {
        const [mail, sealedSales] = await Promise.all([
          api<{ emails: OutboxEmail[] }>("/api/auth/dev/outbox"),
          api<{ items: SealedSaleAdminItem[] }>("/api/sealed-sales"),
        ]);
        setOutbox(mail.emails);
        setAdminSealedSales(sealedSales.items);
      } catch {
        setOutbox([]);
        setAdminSealedSales([]);
      }
    }
  }

  function applyGlobalSearch(value: string) {
    setCardSearch(value);

    const nextQuery = normalizeSearchText(value);
    if (!nextQuery) {
      setSearchDropdownOpen(false);
      setSearchDropdownIndex(0);
      setQuickSealedId("");
      return;
    }
    setSearchDropdownOpen(true);
    setSearchDropdownIndex(0);
  }

  function selectSearchCard(card: CardApi) {
    setQuickCardId(card.cardId);
    setQuickSealedId("");
    setActiveTab("CARD_DETAILS");
    setSearchDropdownOpen(false);
    setSearchDropdownIndex(0);
  }

  function selectSearchSealed(item: SealedSearchMatch) {
    setQuickCardId("");
    setQuickSealedId(item.id);
    setActiveTab("SEALED_ANALYTICS");
    setSearchDropdownOpen(false);
    setSearchDropdownIndex(0);
  }

  function openSettingsSubsection(subsection: "ACCOUNT" | "HEADER_BACKGROUND" | "BILLING_INFORMATION" | "ALERTS") {
    setSettingsSubsection(subsection);
    setActiveTab("SETTINGS");
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const upgradeError = params.get("upgrade_error");
    if (upgradeError) {
      setMessage(upgradeError);
    }
    const billingState = params.get("billing");
    if (billingState === "success") {
      setMessage("Billing updated successfully.");
    } else if (billingState === "cancel") {
      setMessage("Checkout canceled.");
    } else if (billingState === "portal_return") {
      setMessage("Returned from billing portal.");
    }
  }, []);

  useEffect(() => {
    api<{ user: PublicUser }>("/api/auth/me")
      .then(async (session) => {
        setUser(session.user);
        await refresh(session.user.role === "ADMIN");
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const nextId =
      scanResult?.sealedCandidates?.[0]?.productId ?? scanResult?.sealed?.productId ?? "";
    setScanSelectedSealedId(nextId);
  }, [scanResult]);

  useEffect(() => {
    if (!sealedSetHistory.length) {
      if (selectedSealedSetId) {
        setSelectedSealedSetId("");
      }
      return;
    }

    if (!selectedSealedSetId || !sealedSetHistory.some((entry) => entry.setId === selectedSealedSetId)) {
      setSelectedSealedSetId(sealedSetHistory[0].setId);
    }
  }, [sealedSetHistory, selectedSealedSetId]);

  useEffect(() => {
    if (!sets.length) {
      if (selectedSetRatioSetId) {
        setSelectedSetRatioSetId("");
      }
      return;
    }

    if (!selectedSetRatioSetId || !sets.some((set) => set.setId === selectedSetRatioSetId)) {
      setSelectedSetRatioSetId(sets[0].setId);
    }
  }, [sets, selectedSetRatioSetId]);

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
    if (authMode === "register" && regPassword !== regPasswordConfirm) {
      setMessage("Passwords do not match.");
      return;
    }

    const body =
      authMode === "login"
        ? { identifier: loginIdentifier, password: loginPassword }
        : {
            firstName: regFirstName,
            lastName: regLastName,
            username: regUsername,
            email: regEmail,
            password: regPassword,
            passwordConfirm: regPasswordConfirm,
          };
    try {
      const out = await api<{
        user: PublicUser;
        requiresEmailVerification?: boolean;
        debugVerificationToken?: string;
      }>(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (authMode === "register" && (out.requiresEmailVerification || !out.user.emailVerified)) {
        setUser(null);
        setShowVerificationPanel(true);
        setVerificationEmail(regEmail.trim().toLowerCase());
        setRecoveryEmail(regEmail.trim().toLowerCase());
        if (out.debugVerificationToken) {
          setVerifyToken(out.debugVerificationToken);
        }
        setMessage("Account created. Verify your email to complete sign in.");
        return;
      }

      setUser(out.user);
      setMessage("");
      await refresh(out.user.role === "ADMIN");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed");
    }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST", body: "{}" }).catch(() => undefined);
    setUser(null);
    setOutbox([]);
  }

  async function changePlan(tier: "FREE" | "PRO" | "ELITE") {
    try {
      setPlanBusy(true);
      const out = await api<{ user?: PublicUser; checkoutUrl?: string; mode?: string }>(
        "/api/billing/subscribe",
        {
        method: "POST",
        body: JSON.stringify({ tier, action: tier === "FREE" ? "downgrade" : "upgrade" }),
      },
      );
      if (out.checkoutUrl) {
        window.location.href = out.checkoutUrl;
        return;
      }
      if (out.user) {
        setUser(out.user);
        await refresh(out.user.role === "ADMIN");
      }
      setMessage(out.mode === "manual" ? `Plan updated to ${tier} (manual mode).` : `Plan updated to ${tier}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update plan.");
    } finally {
      setPlanBusy(false);
    }
  }

  async function openBillingPortal() {
    try {
      const out = await api<{ url: string }>("/api/billing/portal", {
        method: "POST",
        body: "{}",
      });
      window.location.href = out.url;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not open billing portal.");
    }
  }

  async function saveAccountSettings() {
    if (!user) {
      return;
    }

    if (!accountFirstName.trim() || !accountLastName.trim() || !accountEmail.trim()) {
      setMessage("First name, last name, and email are required.");
      return;
    }

    try {
      setAccountBusy(true);
      const out = await api<{ user: PublicUser }>("/api/auth/account", {
        method: "PATCH",
        body: JSON.stringify({
          firstName: accountFirstName,
          lastName: accountLastName,
          email: accountEmail,
          currentPassword: accountCurrentPassword,
          newPassword: accountNewPassword,
        }),
      });
      setUser(out.user);
      setAccountCurrentPassword("");
      setAccountNewPassword("");
      await refresh(out.user.role === "ADMIN");
      setMessage("Account settings updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update account settings.");
    } finally {
      setAccountBusy(false);
    }
  }

  function applyAlertsPayload(payload: AlertsResponse) {
    setAlertRules(payload.rules);
    setAlertEvents(payload.events);
    setAlertUnreadCount(payload.unreadCount);
    if (payload.newlyTriggered > 0) {
      setMessage(`${payload.newlyTriggered} new alert${payload.newlyTriggered === 1 ? "" : "s"} triggered.`);
    }
  }

  async function createAlertRule(input: {
    entityType: AlertRuleApi["entityType"];
    entityId: string;
    entityLabel: string;
    condition: AlertRuleApi["condition"];
    thresholdValue: number;
    lookbackMonths?: number;
  }) {
    const out = await api<AlertsResponse>("/api/alerts", {
      method: "POST",
      body: JSON.stringify(input),
    });
    applyAlertsPayload(out);
    setSettingsSubsection("ALERTS");
    setMessage(`Alert created for ${input.entityLabel}.`);
  }

  async function toggleAlertRule(rule: AlertRuleApi, enabled: boolean) {
    const out = await api<{ rules: AlertRuleApi[] }>(`/api/alerts/${rule.id}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    });
    setAlertRules(out.rules);
  }

  async function deleteAlertRule(ruleId: string) {
    const out = await api<{ rules: AlertRuleApi[] }>(`/api/alerts/${ruleId}`, {
      method: "DELETE",
      body: "{}",
    });
    setAlertRules(out.rules);
    setAlertEvents((current) => current.filter((item) => item.ruleId !== ruleId));
  }

  async function markAlertEventRead(eventId: string) {
    const out = await api<{ events: AlertEventApi[]; unreadCount: number }>("/api/alerts/events", {
      method: "PATCH",
      body: JSON.stringify({ eventId }),
    });
    setAlertEvents(out.events);
    setAlertUnreadCount(out.unreadCount);
  }

  async function markAllAlertEventsRead() {
    const out = await api<{ events: AlertEventApi[]; unreadCount: number }>("/api/alerts/events", {
      method: "PATCH",
      body: JSON.stringify({ markAll: true }),
    });
    setAlertEvents(out.events);
    setAlertUnreadCount(out.unreadCount);
  }

  async function runSync(mode: "catalog" | "sales", runNow = false) {
    if (!can("LIVE_SYNC_QUEUE")) {
      setMessage("Upgrade to Pro to use background sync.");
      return;
    }
    const endpoint = mode === "catalog" ? "/api/sync/catalog" : "/api/sync/sales";
    try {
      const out = await api<{
        queued: { id: string; type: string };
        worker?: { tasksProcessed: number; jobsProcessed: number; skipped: boolean };
        completedTask?: SyncTaskApi | null;
      }>(endpoint, {
        method: "POST",
        body: JSON.stringify({ pageLimit: syncPageLimit, runNow }),
      });
      await refresh(user?.role === "ADMIN");
      if (mode === "catalog") {
        setManualCatalogResult(out.completedTask ?? null);
      }

      if (runNow && out.completedTask?.status === "COMPLETED") {
        setMessage(`${mode} sync completed (${out.queued.id}).`);
        return;
      }

      setMessage(`${mode} sync queued (${out.queued.id}).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sync failed");
    }
  }

  async function queueDirectTcgplayerSync() {
    if (!can("DIRECT_TCGPLAYER_SYNC")) {
      setMessage("Upgrade to Elite for direct TCGplayer sync.");
      return;
    }
    try {
      const out = await api<{ queued: { id: string } }>("/api/sync/sales", {
        method: "POST",
        body: JSON.stringify({ provider: "TCGPLAYER_DIRECT", cardLimit: 150 }),
      });
      await refresh(user?.role === "ADMIN");
      setMessage(`TCGplayer direct sync queued (${out.queued.id}).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Queue failed");
    }
  }

  async function runWorkerNow() {
    if (!can("LIVE_SYNC_QUEUE")) {
      setMessage("Upgrade to Pro to run worker jobs.");
      return;
    }
    try {
      const out = await api<{ tasksProcessed: number; jobsProcessed: number; skipped: boolean }>(
        "/api/jobs/worker",
        { method: "POST", body: "{}" },
      );
      await refresh(user?.role === "ADMIN");
      setMessage(
        out.skipped
          ? "Worker skipped (already running)."
          : `Worker processed tasks=${out.tasksProcessed}, jobs=${out.jobsProcessed}.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Worker run failed");
    }
  }

  async function requestEmailVerification() {
    try {
      const out = await api<{ ok: boolean; debugToken?: string }>("/api/auth/verify-email/request", {
        method: "POST",
        body: JSON.stringify({ email: verificationEmail }),
      });
      if (out.debugToken) {
        setVerifyToken(out.debugToken);
      }
      setMessage("If the account exists, a verification message was queued.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not request verification");
    }
  }

  async function confirmEmailVerification() {
    try {
      const out = await api<{ user: PublicUser }>("/api/auth/verify-email/confirm", {
        method: "POST",
        body: JSON.stringify({ token: verifyToken }),
      });
      setUser(out.user);
      setVerifyToken("");
      setMessage("Email verified. You are signed in.");
      await refresh(out.user.role === "ADMIN");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Verification failed");
    }
  }

  async function requestPasswordReset() {
    try {
      const out = await api<{ ok: boolean; debugToken?: string }>("/api/auth/password-reset/request", {
        method: "POST",
        body: JSON.stringify({ email: recoveryEmail }),
      });
      if (out.debugToken) {
        setRecoveryResetToken(out.debugToken);
      }
      setMessage("If the account exists, a password reset token was queued.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not request reset");
    }
  }

  async function requestUsernameRecovery() {
    try {
      const out = await api<{ ok: boolean; debugUsername?: string }>("/api/auth/username-recovery/request", {
        method: "POST",
        body: JSON.stringify({ email: recoveryEmail }),
      });
      setMessage(
        out.debugUsername
          ? `Username reminder sent. (dev: ${out.debugUsername})`
          : "If the account exists, a username reminder was queued.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not recover username");
    }
  }

  async function confirmPasswordReset() {
    try {
      const out = await api<{ user: PublicUser }>("/api/auth/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify({ token: recoveryResetToken, newPassword: recoveryNewPassword }),
      });
      setUser(out.user);
      setRecoveryResetToken("");
      setRecoveryNewPassword("");
      setMessage("Password updated. You are signed in.");
      await refresh(out.user.role === "ADMIN");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Password reset failed");
    }
  }

  async function scanCard(event: FormEvent) {
    event.preventDefault();
    if (!can("CARD_SCANNER_TEXT")) {
      setMessage("Upgrade to Pro to use scanner.");
      return;
    }
    try {
      const out = await api<ImageScanResponse>("/api/scanner", {
        method: "POST",
        body: JSON.stringify({ scannedText: scanText, destination: scanDest, ownershipType: "RAW", quantity: 1 }),
      });
      setScanResult(out);
      setMessage(scanDest === "PRICE_CHECK" ? "Price check complete." : "Scanner import complete.");
      setScanText("");
      await refresh(user?.role === "ADMIN");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Scan failed");
    }
  }

  async function runImageScan() {
    if (!can("CARD_SCANNER_TEXT")) {
      setMessage("Upgrade to Pro to use scanner.");
      return;
    }
    if (!scanImageFile) {
      setMessage("Choose an image before scanning.");
      return;
    }

    try {
      setOcrBusy(true);
      const formData = new FormData();
      formData.append("image", scanImageFile);
      formData.append("destination", "PRICE_CHECK");
      formData.append("quantity", "1");
      formData.append("previewOnly", "1");

      const response = await fetch("/api/scanner/image", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as ImageScanResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? `Image scan failed (${response.status})`);
      }

      setScanResult(payload);
      setScanText(payload.ocr?.text ?? "");
      setMessage(
        `Photo scan analyzed (OCR ${(payload.ocr?.confidence ?? 0).toFixed(1)}). Review the match, then choose an action.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Image scan failed");
    } finally {
      setOcrBusy(false);
    }
  }

  async function applyScannerCardAction(destination: "COLLECTION" | "WISHLIST" | "PRICE_CHECK") {
    if (!scanResult?.match?.card) {
      setMessage("Scan a card first.");
      return;
    }

    const metric =
      cards.find((item) => item.cardId === scanResult.match?.card?.id) ??
      cards.find(
        (item) =>
          item.cardName === scanResult.match?.card?.name &&
          item.cardNumber === scanResult.match?.card?.cardNumber &&
          item.setCode.toLowerCase() === (scanResult.match?.card?.setCode ?? "").toLowerCase(),
      ) ??
      null;

    if (!metric) {
      setMessage("The scanned card could not be resolved in the current catalog.");
      return;
    }

    if (destination === "PRICE_CHECK") {
      setQuickCardId(metric.cardId);
      setActiveTab("CARD_DETAILS");
      setMessage("Opened Card Analytics for the scanned card.");
      return;
    }

    if (!can("PORTFOLIO_TRACKING")) {
      setMessage("Upgrade to Pro for portfolio tracking.");
      return;
    }

    setScannerActionBusy(true);
    try {
      if (destination === "COLLECTION") {
        await api("/api/collection", {
          method: "POST",
          body: JSON.stringify({
            cardId: metric.cardId,
            ownershipType: scanResult.itemKind === "GRADED_SLAB" ? "GRADED" : "RAW",
            rawCondition: scanResult.itemKind === "GRADED_SLAB" ? undefined : "NM",
            grader: scanResult.itemKind === "GRADED_SLAB" ? scanResult.slab?.grader : undefined,
            grade: scanResult.itemKind === "GRADED_SLAB" ? scanResult.slab?.grade : undefined,
            quantity: 1,
          }),
        });
        setMessage("Scanned card added to Personal Collection.");
      } else {
        await api("/api/wishlist", {
          method: "POST",
          body: JSON.stringify({ cardId: metric.cardId, priority: 2 }),
        });
        setMessage("Scanned card added to Wishlist.");
      }
      await refresh(user?.role === "ADMIN");
    } finally {
      setScannerActionBusy(false);
    }
  }

  async function applyScannerSealedAction(destination: "COLLECTION" | "WISHLIST" | "PRICE_CHECK") {
    const selectedCandidate =
      scanResult?.sealedCandidates?.find((item) => item.productId === scanSelectedSealedId) ??
      scanResult?.sealedCandidates?.[0] ??
      null;
    const productId = selectedCandidate?.productId ?? scanResult?.sealed?.productId;

    if (!productId) {
      setMessage("Scan a sealed product first.");
      return;
    }

    if (destination === "PRICE_CHECK") {
      setQuickSealedId(productId);
      setActiveTab("SEALED_ANALYTICS");
      setMessage("Opened Sealed Analytics for the selected scan match.");
      return;
    }

    if (!can("PORTFOLIO_TRACKING")) {
      setMessage("Upgrade to Pro for portfolio tracking.");
      return;
    }

    setScannerActionBusy(true);
    try {
      if (destination === "COLLECTION") {
        await api("/api/sealed", {
          method: "POST",
          body: JSON.stringify({ productId, quantity: 1 }),
        });
        setMessage("Scanned sealed product added to Sealed Collection.");
      } else {
        await api("/api/sealed-wishlist", {
          method: "POST",
          body: JSON.stringify({ productId, priority: 2 }),
        });
        setMessage("Scanned sealed product added to Wishlist.");
      }
      setQuickSealedId(productId);
      await refresh(user?.role === "ADMIN");
    } finally {
      setScannerActionBusy(false);
    }
  }

  async function quickAddCollection() {
    if (!can("PORTFOLIO_TRACKING")) {
      setMessage("Upgrade to Pro for portfolio tracking.");
      return;
    }
    if (!activeQuickRawCardId) {
      setMessage("Select a raw card first.");
      return;
    }
    if (!activePortfolioIdForActions) {
      setMessage("Create a portfolio first.");
      return;
    }
    await api("/api/collection", {
      method: "POST",
      body: JSON.stringify({
        portfolioId: activePortfolioIdForActions,
        cardId: activeQuickRawCardId,
        ownershipType: "RAW",
        rawCondition: quickRawCondition,
        quantity: 1,
      }),
    });
    setMessage(`Raw card (${quickRawCondition}) added to Personal Collection.`);
    await refresh(user?.role === "ADMIN");
  }

  async function quickAddWishlist() {
    if (!can("PORTFOLIO_TRACKING")) {
      setMessage("Upgrade to Pro for portfolio tracking.");
      return;
    }
    await api("/api/wishlist", {
      method: "POST",
      body: JSON.stringify({ cardId: quickCardId, priority: 2 }),
    });
    await refresh(user?.role === "ADMIN");
  }

  async function quickAddSealed() {
    if (!can("PORTFOLIO_TRACKING")) {
      setMessage("Upgrade to Pro for portfolio tracking.");
      return;
    }
    if (!activeQuickSealedProductId) {
      setMessage("Select a sealed product first.");
      return;
    }
    if (!activePortfolioIdForActions) {
      setMessage("Create a portfolio first.");
      return;
    }
    await api("/api/sealed", {
      method: "POST",
      body: JSON.stringify({
        portfolioId: activePortfolioIdForActions,
        productId: activeQuickSealedProductId,
        quantity: 1,
      }),
    });
    setMessage("Sealed product added to Sealed Collection.");
    await refresh(user?.role === "ADMIN");
  }

  async function quickAddGraded() {
    if (!can("PORTFOLIO_TRACKING")) {
      setMessage("Upgrade to Pro for portfolio tracking.");
      return;
    }
    if (!activeQuickGradedOption) {
      setMessage("Select a graded card or sealed product first.");
      return;
    }
    if (!activePortfolioIdForActions) {
      setMessage("Create a portfolio first.");
      return;
    }

    const parsedGrade = Math.max(1, Math.min(10, Math.floor(Number(quickGradedGrade) || 0)));
    if (!parsedGrade) {
      setMessage("Enter a valid grade from 1 to 10.");
      return;
    }

    const certificationNumber = quickGradedCertificationNumber.trim() || undefined;

    if (activeQuickGradedOption.kind === "card") {
      await api("/api/collection", {
        method: "POST",
        body: JSON.stringify({
          portfolioId: activePortfolioIdForActions,
          cardId: activeQuickGradedOption.id,
          ownershipType: "GRADED",
          grader: quickGradedGrader,
          grade: parsedGrade,
          certificationNumber,
          quantity: 1,
        }),
      });
      setMessage("Graded card added to Personal Collection.");
    } else {
      await api("/api/sealed", {
        method: "POST",
        body: JSON.stringify({
          portfolioId: activePortfolioIdForActions,
          productId: activeQuickGradedOption.id,
          grader: quickGradedGrader,
          grade: parsedGrade,
          certificationNumber,
          quantity: 1,
          notes: certificationNumber
            ? `Graded ${quickGradedGrader} ${parsedGrade} | Slab #: ${certificationNumber}`
            : `Graded ${quickGradedGrader} ${parsedGrade}`,
        }),
      });
      setMessage("Graded sealed item added to Sealed Collection.");
    }

    await refresh(user?.role === "ADMIN");
  }

  async function createPortfolio() {
    if (!can("PORTFOLIO_TRACKING")) {
      setMessage("Upgrade to Pro for portfolio tracking.");
      return;
    }

    const name = newPortfolioName.trim();
    if (name.length < 2) {
      setMessage("Enter a portfolio name with at least 2 characters.");
      return;
    }

    const response = await api<{ items: PortfolioApi[] }>("/api/portfolios", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    setPortfolios(response.items);
    const created = response.items.find(
      (portfolio) => portfolio.name.toLowerCase() === name.toLowerCase(),
    );
    setSelectedPortfolioView(created?.id ?? selectedPortfolioView);
    setNewPortfolioName("");
    setMessage(`Portfolio "${name}" created.`);
    await refresh(user?.role === "ADMIN");
  }

  async function saveSealedCollectionItem(
    id: string,
    changes: {
      quantity: number;
      acquisitionPriceUsd?: number;
      estimatedValueUsd?: number;
      notes?: string;
    },
  ) {
    await api("/api/sealed", {
      method: "PATCH",
      body: JSON.stringify({ id, ...changes }),
    });
    setMessage("Sealed collection item updated.");
    await refresh(user?.role === "ADMIN");
  }

  async function removeSealedCollectionItem(id: string) {
    await api("/api/sealed", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });
    setMessage("Sealed collection item removed.");
    await refresh(user?.role === "ADMIN");
  }

  async function saveSealedWishlistItem(
    id: string,
    changes: { targetPriceUsd?: number; priority: number; notes?: string },
  ) {
    await api("/api/sealed-wishlist", {
      method: "PATCH",
      body: JSON.stringify({ id, ...changes }),
    });
    setMessage("Sealed wishlist item updated.");
    await refresh(user?.role === "ADMIN");
  }

  async function removeSealedWishlistItem(id: string) {
    await api("/api/sealed-wishlist", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });
    setMessage("Sealed wishlist item removed.");
    await refresh(user?.role === "ADMIN");
  }

  async function addSealedSale() {
    if (user?.role !== "ADMIN") {
      setMessage("Admin access required.");
      return;
    }
    const parsedPrice = Number(sealedSalePrice);
    if (!sealedSaleProductId || !Number.isFinite(parsedPrice) || parsedPrice <= 0 || !sealedSaleDate) {
      setMessage("Enter a valid sealed product, price, and sale date.");
      return;
    }

    await api("/api/sealed-sales", {
      method: "POST",
      body: JSON.stringify({
        productId: sealedSaleProductId,
        priceUsd: parsedPrice,
        saleDate: new Date(`${sealedSaleDate}T00:00:00.000Z`).toISOString(),
        source: sealedSaleSource.trim() || undefined,
        providerRef: sealedSaleProviderRef.trim() || undefined,
      }),
    });
    setMessage("Sealed sale added.");
    setSealedSalePrice("");
    setSealedSaleProviderRef("");
    await refresh(true);
  }

  async function updateSealedSale(
    id: string,
    changes: {
      priceUsd: number;
      saleDate: string;
      source?: string;
      providerRef?: string;
    },
  ) {
    await api("/api/sealed-sales", {
      method: "PATCH",
      body: JSON.stringify({ id, ...changes }),
    });
    setMessage("Sealed sale updated.");
    await refresh(true);
  }

  async function deleteSealedSale(id: string) {
    await api("/api/sealed-sales", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });
    setMessage("Sealed sale removed.");
    await refresh(true);
  }

  async function exportSealedSalesCsv() {
    if (user?.role !== "ADMIN") {
      setMessage("Admin access required.");
      return;
    }

    const response = await fetch("/api/sealed-sales?format=csv", { cache: "no-store" });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error ?? `Export failed (${response.status})`);
    }

    const csv = await response.text();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "gemindex-sealed-sales.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setMessage("Sealed sales CSV exported.");
  }

  async function importSealedSalesCsv() {
    if (user?.role !== "ADMIN") {
      setMessage("Admin access required.");
      return;
    }
    if (!sealedSalesCsvFile) {
      setMessage("Choose a CSV file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", sealedSalesCsvFile);
    formData.append("source", sealedSaleSource);
    formData.append("provider", "INGESTED");

    const response = await fetch("/api/sealed-sales", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error((payload as { error?: string }).error ?? `CSV import failed (${response.status})`);
    }

    setMessage("Sealed sales CSV imported.");
    setSealedSalesCsvFile(null);
    await refresh(true);
  }

  if (loading) return <main className="p-8">Loading Investige...</main>;

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl p-4 sm:p-8">
        <section className="rounded-3xl bg-[radial-gradient(circle_at_18%_20%,rgba(214,96,198,0.14),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(52,178,255,0.16),transparent_28%),linear-gradient(150deg,#182f61_0%,#0f2551_45%,#0b1f45_100%)] p-5 text-white shadow-xl shadow-black/30">
          <div className="flex flex-col items-center gap-3 text-center">
            <h1 className="gem-title gem-title-landing text-5xl font-bold sm:text-6xl">Investige</h1>
            <Image
              src="/gemindex-logo-v5.png"
              alt="Investige app icon"
              width={420}
              height={420}
              priority
              className="h-40 w-40 object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)] sm:h-48 sm:w-48"
            />
            <p className="text-sm text-cyan-100">Create your account or sign in to access Investige.</p>
          </div>

          <div className="mt-5 rounded-2xl bg-slate-950/20 p-4 text-slate-100 backdrop-blur-md sm:p-5">
            <form key={authMode} className="space-y-3" onSubmit={submitAuth}>
              <div className="flex gap-2 rounded-lg bg-black/15 p-1 text-sm">
                <button
                  type="button"
                  className={`flex-1 rounded-md px-3 py-2 ${authMode === "login" ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/5"}`}
                  onClick={() => setAuthMode("login")}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className={`flex-1 rounded-md px-3 py-2 ${authMode === "register" ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/5"}`}
                  onClick={() => setAuthMode("register")}
                >
                  Register
                </button>
              </div>

              {authMode === "register" ? (
                <>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      name="firstName"
                      autoComplete="given-name"
                      className="w-full rounded-lg border border-white/20 bg-slate-900/60 px-3 py-2 text-slate-100 placeholder:text-slate-400 outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
                      value={regFirstName}
                      onChange={(e) => setRegFirstName(e.target.value)}
                      placeholder="First name"
                      required
                    />
                    <input
                      name="lastName"
                      autoComplete="family-name"
                      className="w-full rounded-lg border border-white/20 bg-slate-900/60 px-3 py-2 text-slate-100 placeholder:text-slate-400 outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
                      value={regLastName}
                      onChange={(e) => setRegLastName(e.target.value)}
                      placeholder="Last name"
                      required
                    />
                  </div>
                  <input
                    name="username"
                    autoComplete="username"
                    spellCheck={false}
                    autoCapitalize="none"
                    className="w-full rounded-lg border border-white/20 bg-slate-900/60 px-3 py-2 text-slate-100 placeholder:text-slate-400 outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="Username"
                    required
                  />
                  <input
                    name="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    className="w-full rounded-lg border border-white/20 bg-slate-900/60 px-3 py-2 text-slate-100 placeholder:text-slate-400 outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="Email"
                    required
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      name="newPassword"
                      autoComplete="new-password"
                      className="w-full rounded-lg border border-white/20 bg-slate-900/60 px-3 py-2 text-slate-100 placeholder:text-slate-400 outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Create password"
                      required
                    />
                    <input
                      name="confirmPassword"
                      autoComplete="new-password"
                      className="w-full rounded-lg border border-white/20 bg-slate-900/60 px-3 py-2 text-slate-100 placeholder:text-slate-400 outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
                      type="password"
                      value={regPasswordConfirm}
                      onChange={(e) => setRegPasswordConfirm(e.target.value)}
                      placeholder="Confirm password"
                      required
                    />
                  </div>
                </>
              ) : (
                <>
                  <input
                    name="loginIdentifier"
                    autoComplete="username"
                    autoCapitalize="none"
                    className="w-full rounded-lg border border-white/20 bg-slate-900/60 px-3 py-2 text-slate-100 placeholder:text-slate-400 outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="Username or email"
                    required
                  />
                  <input
                    name="loginPassword"
                    autoComplete="current-password"
                    className="w-full rounded-lg border border-white/20 bg-slate-900/60 px-3 py-2 text-slate-100 placeholder:text-slate-400 outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Password"
                    required
                  />
                </>
              )}

              <button className="w-full rounded-lg border border-cyan-300/40 bg-cyan-500/20 px-3 py-2 text-white hover:bg-cyan-500/30" type="submit">
                {authMode === "login" ? "Sign in" : "Create account"}
              </button>
            </form>

            <button
              type="button"
              className="mt-3 text-sm text-cyan-200 underline"
              onClick={() => setShowRecoveryPanel((prev) => !prev)}
            >
              Forgot Username or Password?
            </button>

            {showRecoveryPanel ? (
              <div className="mt-3 grid gap-3 rounded-xl bg-black/15 p-3 text-sm">
                <input
                  name="recoveryEmail"
                  autoComplete="email"
                  autoCapitalize="none"
                  className="w-full rounded-lg border border-white/20 bg-slate-900/60 px-3 py-2 text-slate-100 placeholder:text-slate-400 outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="Email for account recovery"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-slate-100 hover:bg-white/15"
                    type="button"
                    onClick={requestUsernameRecovery}
                  >
                    Retrieve Username
                  </button>
                  <button
                    className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-slate-100 hover:bg-white/15"
                    type="button"
                    onClick={requestPasswordReset}
                  >
                    Send Password Reset Token
                  </button>
                </div>
                <input
                  name="recoveryResetToken"
                  autoComplete="off"
                  autoCapitalize="none"
                  className="w-full rounded-lg border border-white/20 bg-slate-900/60 px-3 py-2 text-slate-100 placeholder:text-slate-400 outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
                  value={recoveryResetToken}
                  onChange={(e) => setRecoveryResetToken(e.target.value)}
                  placeholder="Password reset token"
                />
                <input
                  name="recoveryNewPassword"
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-white/20 bg-slate-900/60 px-3 py-2 text-slate-100 placeholder:text-slate-400 outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
                  type="password"
                  value={recoveryNewPassword}
                  onChange={(e) => setRecoveryNewPassword(e.target.value)}
                  placeholder="New password"
                />
                <button
                  className="rounded-lg border border-cyan-300/40 bg-cyan-500/20 px-3 py-2 text-cyan-100 hover:bg-cyan-500/30"
                  type="button"
                  onClick={confirmPasswordReset}
                >
                  Confirm Password Reset
                </button>
              </div>
            ) : null}

            {showVerificationPanel ? (
              <div className="mt-3 grid gap-2 rounded-xl bg-emerald-500/10 p-3 text-sm">
                <p className="text-emerald-100">Verify your email to finalize account setup.</p>
                <input
                  className="w-full rounded-lg border border-white/20 bg-slate-900/60 px-3 py-2 text-slate-100 placeholder:text-slate-400 outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
                  value={verificationEmail}
                  onChange={(e) => setVerificationEmail(e.target.value)}
                  placeholder="Verification email"
                />
                <button className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-slate-100 hover:bg-white/15" type="button" onClick={requestEmailVerification}>
                  Resend Email Verification
                </button>
                <input
                  className="w-full rounded-lg border border-white/20 bg-slate-900/60 px-3 py-2 text-slate-100 placeholder:text-slate-400 outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
                  value={verifyToken}
                  onChange={(e) => setVerifyToken(e.target.value)}
                  placeholder="Verification token"
                />
                <button
                  className="rounded-lg border border-emerald-300/40 bg-emerald-500/20 px-3 py-2 text-emerald-100 hover:bg-emerald-500/30"
                  type="button"
                  onClick={confirmEmailVerification}
                >
                  Confirm Email Token
                </button>
              </div>
            ) : null}

            {message ? <p className="mt-3 text-sm text-rose-200">{message}</p> : null}
          </div>
        </section>
      </main>
    );
  }

  const sourceStatus = dataQuality?.status ?? "SEEDED";
  const investmentMetricsReady = dataQuality?.investmentMetricsReady ?? false;
  const sourceBadgeClass =
    sourceStatus === "LIVE_READY"
      ? "bg-emerald-400/15 text-emerald-100"
      : sourceStatus === "PARTIAL_LIVE"
        ? "bg-amber-400/15 text-amber-100"
        : "bg-slate-400/15 text-slate-100";
  const activeHeaderBackground =
    HEADER_BACKGROUND_OPTIONS.find((option) => option.id === headerBackgroundId) ??
    HEADER_BACKGROUND_OPTIONS[0];
  const query = normalizeSearchText(cardSearch);
  const matchingCards = query
    ? cards
        .map((card) => ({
          card,
          score: relevanceScore(query, `${card.cardName} ${card.cardNumber} ${card.setCode}`),
        }))
        .filter((entry) => entry.score >= 0)
        .sort((a, b) => b.score - a.score || b.card.rawPrice - a.card.rawPrice)
        .slice(0, 30)
        .map((entry) => entry.card)
    : cards.slice(0, 30);
  const selectedCard = query
    ? cards.find((card) => card.cardId === quickCardId) ?? matchingCards[0] ?? null
    : cards.find((card) => card.cardId === quickCardId) ?? matchingCards[0] ?? cards[0] ?? null;
  const setRows = query
    ? sets
        .filter((set) => `${set.name} ${set.code}`.toLowerCase().includes(query))
        .slice(0, 60)
    : sets.slice(0, 60);
  const sealedProductsBySetId = sealedProducts.reduce(
    (map, product) => {
      const bucket = map.get(product.setId) ?? [];
      bucket.push(product);
      map.set(product.setId, bucket);
      return map;
    },
    new Map<string, SealedCatalogProduct[]>(),
  );
  const setSealedRatioRows = setRows.map((set) => {
    const setProducts = sealedProductsBySetId.get(set.setId) ?? [];

    const pickPrice = (predicate: (product: SealedCatalogProduct) => boolean): number | undefined => {
      const matched = setProducts.filter(predicate);
      if (!matched.length) {
        return undefined;
      }

      return matched.reduce((best, product) => {
        const price = product.marketValueUsd ?? product.metrics.latestMarketPrice;
        if (typeof price !== "number") {
          return best;
        }
        return typeof best === "number" ? Math.max(best, price) : price;
      }, undefined as number | undefined);
    };

    const boosterBoxPrice = pickPrice(
      (product) =>
        product.productType === "BOOSTER_BOX" ||
        normalizeSearchText(product.productName).includes("booster box"),
    );
    const boosterBundlePrice = pickPrice((product) =>
      normalizeSearchText(product.productName).includes("booster bundle"),
    );
    const etbPrice = pickPrice((product) => {
      const name = normalizeSearchText(product.productName);
      const isEtbType =
        product.productType === "ELITE_TRAINER_BOX" || name.includes("etb") || name.includes("elite trainer box");
      return isEtbType && !name.includes("pokemon center");
    });
    const pokemonCenterEtbPrice = pickPrice((product) => {
      const name = normalizeSearchText(product.productName);
      return (
        (product.productType === "ELITE_TRAINER_BOX" || name.includes("etb") || name.includes("elite trainer box")) &&
        name.includes("pokemon center")
      );
    });

    return {
      setId: set.setId,
      setName: set.name,
      boosterBoxPct: pctOfSetValue(boosterBoxPrice, set.totalSetValue),
      boosterBundlePct: pctOfSetValue(boosterBundlePrice, set.totalSetValue),
      etbPct: pctOfSetValue(etbPrice, set.totalSetValue),
      pokemonCenterEtbPct: pctOfSetValue(pokemonCenterEtbPrice, set.totalSetValue),
    };
  });
  const boosterBoxRatioRows = setSealedRatioRows.filter((row) => typeof row.boosterBoxPct === "number");
  const boosterBundleRatioRows = setSealedRatioRows.filter((row) => typeof row.boosterBundlePct === "number");
  const etbRatioRows = setSealedRatioRows.filter((row) => typeof row.etbPct === "number");
  const pokemonCenterEtbRatioRows = setSealedRatioRows.filter(
    (row) => typeof row.pokemonCenterEtbPct === "number",
  );
  const setRatioSetOptions = sets
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name));
  const selectedSetRatioSet =
    setRatioSetOptions.find((set) => set.setId === selectedSetRatioSetId) ?? setRatioSetOptions[0] ?? null;
  const selectedSetRatioProducts = selectedSetRatioSet
    ? sealedProductsBySetId.get(selectedSetRatioSet.setId) ?? []
    : [];
  const toMonth = (value: string) => value.slice(0, 7);
  const selectedSetValueSeriesByMonth = new Map<string, number>();
  if (selectedSetRatioSet) {
    cards
      .filter((card) => card.setCode === selectedSetRatioSet.code)
      .forEach((card) => {
        card.series.forEach((point) => {
          if (typeof point.raw !== "number") {
            return;
          }
          const month = toMonth(point.date);
          selectedSetValueSeriesByMonth.set(month, (selectedSetValueSeriesByMonth.get(month) ?? 0) + point.raw);
        });
      });
  }
  const allSetRatioMonths = [
    ...new Set([
      ...selectedSetValueSeriesByMonth.keys(),
      ...selectedSetRatioProducts.flatMap((product) => product.series.map((point) => toMonth(point.date))),
    ]),
  ].sort();
  const setRatioRangeLimit = chartRangeLimit(setRatioHistoryRange);
  const setRatioStartIndex =
    setRatioRangeLimit === null ? 0 : Math.max(0, allSetRatioMonths.length - setRatioRangeLimit);
  const visibleSetRatioMonths = allSetRatioMonths.slice(setRatioStartIndex);
  const boosterBundlePredicate = (product: SealedCatalogProduct) =>
    normalizeSearchText(product.productName).includes("booster bundle");
  const etbPredicate = (product: SealedCatalogProduct) => {
    const productName = normalizeSearchText(product.productName);
    const etbType =
      product.productType === "ELITE_TRAINER_BOX" ||
      productName.includes("etb") ||
      productName.includes("elite trainer box");
    return etbType && !productName.includes("pokemon center");
  };
  const pokemonCenterEtbPredicate = (product: SealedCatalogProduct) => {
    const productName = normalizeSearchText(product.productName);
    const etbType =
      product.productType === "ELITE_TRAINER_BOX" ||
      productName.includes("etb") ||
      productName.includes("elite trainer box");
    return etbType && productName.includes("pokemon center");
  };
  const priceForSetRatioMonth = (
    month: string,
    predicate: (product: SealedCatalogProduct) => boolean,
  ): number | undefined => {
    const matches = selectedSetRatioProducts.filter(predicate);
    if (!matches.length) {
      return undefined;
    }

    return matches.reduce((best, product) => {
      const monthlyPoint = product.series.find((point) => toMonth(point.date) === month);
      const price = monthlyPoint?.market ?? monthlyPoint?.tracked ?? monthlyPoint?.target;
      if (typeof price !== "number" || !Number.isFinite(price)) {
        return best;
      }
      return typeof best === "number" ? Math.max(best, price) : price;
    }, undefined as number | undefined);
  };
  const boosterBoxPctSeries = visibleSetRatioMonths.map((month) =>
    pctOfSetValue(
      priceForSetRatioMonth(
        month,
        (product) =>
          product.productType === "BOOSTER_BOX" ||
          normalizeSearchText(product.productName).includes("booster box"),
      ),
      selectedSetValueSeriesByMonth.get(month) ?? 0,
    ),
  );
  const boosterBundlePctSeries = visibleSetRatioMonths.map((month) =>
    pctOfSetValue(
      priceForSetRatioMonth(month, boosterBundlePredicate),
      selectedSetValueSeriesByMonth.get(month) ?? 0,
    ),
  );
  const etbPctSeries = visibleSetRatioMonths.map((month) =>
    pctOfSetValue(priceForSetRatioMonth(month, etbPredicate), selectedSetValueSeriesByMonth.get(month) ?? 0),
  );
  const pokemonCenterEtbPctSeries = visibleSetRatioMonths.map((month) =>
    pctOfSetValue(
      priceForSetRatioMonth(month, pokemonCenterEtbPredicate),
      selectedSetValueSeriesByMonth.get(month) ?? 0,
    ),
  );
  const setValueHistorySeries = visibleSetRatioMonths.map((month) => selectedSetValueSeriesByMonth.get(month));
  const hasSetValueHistory = setValueHistorySeries.some((value) => typeof value === "number");
  const hasBoosterBoxPctHistory = boosterBoxPctSeries.some((value) => typeof value === "number");
  const hasBoosterBundlePctHistory = boosterBundlePctSeries.some((value) => typeof value === "number");
  const hasEtbPctHistory = etbPctSeries.some((value) => typeof value === "number");
  const hasPokemonCenterEtbPctHistory = pokemonCenterEtbPctSeries.some((value) => typeof value === "number");
  const cardsTopRows = query
    ? cards
        .filter((card) =>
          `${card.cardName} ${card.cardNumber} ${card.setCode}`.toLowerCase().includes(query),
        )
        .slice(0, 50)
    : cards.slice(0, 50);
  const quickRawMatches = cards
    .filter((card) => {
      const nameMatch = quickRawName
        ? card.cardName.toLowerCase().includes(normalizeSearchText(quickRawName))
        : true;
      const numberMatch = quickRawNumber
        ? card.cardNumber.toLowerCase().includes(normalizeSearchText(quickRawNumber))
        : true;
      return nameMatch && numberMatch;
    })
    .slice(0, 40);
  const activeQuickRawCardId =
    quickRawMatches.find((card) => card.cardId === quickRawSelectedCardId)?.cardId ??
    quickRawMatches[0]?.cardId ??
    "";
  const quickSealedMatches = sealedProducts
    .filter((product) => {
      const setMatch = quickSealedSetName
        ? `${product.setName} ${product.setCode}`.toLowerCase().includes(normalizeSearchText(quickSealedSetName))
        : true;
      const typeMatch = quickSealedType === "ALL" ? true : product.productType === quickSealedType;
      return setMatch && typeMatch;
    })
    .slice(0, 40);
  const activeQuickSealedProductId =
    quickSealedMatches.find((product) => product.id === quickSealedSelectedProductId)?.id ??
    quickSealedMatches[0]?.id ??
    "";
  const quickGradedOptions = [
    ...cards
      .filter((card) =>
        quickGradedQuery
          ? `${card.cardName} ${card.cardNumber} ${card.setName} ${card.setCode}`
              .toLowerCase()
              .includes(normalizeSearchText(quickGradedQuery))
          : true,
      )
      .slice(0, 20)
      .map((card) => ({
        value: `card:${card.cardId}`,
        kind: "card" as const,
        id: card.cardId,
        label: `${card.cardName} ${card.cardNumber}`,
        meta: card.setName,
      })),
    ...sealedProducts
      .filter((product) =>
        quickGradedQuery
          ? `${product.productName} ${product.setName} ${product.setCode}`
              .toLowerCase()
              .includes(normalizeSearchText(quickGradedQuery))
          : true,
      )
      .slice(0, 20)
      .map((product) => ({
        value: `sealed:${product.id}`,
        kind: "sealed" as const,
        id: product.id,
        label: product.productName,
        meta: `${product.setName} | ${formatSealedProductType(product.productType)}`,
      })),
  ].slice(0, 40);
  const activeQuickGradedValue =
    quickGradedOptions.find((option) => option.value === quickGradedSelectedValue)?.value ??
    quickGradedOptions[0]?.value ??
    "";
  const activeQuickGradedOption =
    quickGradedOptions.find((option) => option.value === activeQuickGradedValue) ?? null;
  const indexSeries = dashboard?.cardIndex ?? [];
  const latestIndexLevel = indexSeries[indexSeries.length - 1]?.value ?? 0;
  const recentIndexRows = indexSeries.slice(-12).reverse();
  const topUndervaluedAlerts = dashboard?.topUndervalued ?? [];
  const flipperSignalAlerts = dashboard?.flipperSignals ?? [];
  const topArbitrageAlerts = dashboard?.topArbitrage ?? [];
  const totalRawUniverse = cards.reduce((sum, card) => sum + Math.max(card.rawPrice, 0), 0) || 1;
  const selectedCardChartLabels = selectedCard?.series.map((point) => point.date.slice(0, 7)) ?? [];
  const selectedCardChartSeries = selectedCard
    ? [
        { label: "Raw", color: "#38bdf8", values: selectedCard.series.map((point) => point.raw) },
        { label: "PSA 10", color: "#34d399", values: selectedCard.series.map((point) => point.psa10) },
        { label: "TAG 10", color: "#f59e0b", values: selectedCard.series.map((point) => point.tag10) },
      ]
    : [];
  const indexComponents = cards
    .slice()
    .sort((a, b) => b.rawPrice - a.rawPrice)
    .slice(0, 20)
    .map((card) => ({
      ...card,
      weightPct: (Math.max(card.rawPrice, 0) / totalRawUniverse) * 100,
    }));
  const arbitrageRows = cards
    .slice()
    .sort((a, b) => b.gradingArbitrageUsd - a.gradingArbitrageUsd)
    .slice(0, 25);
  const topVolatileSets = sets
    .slice()
    .sort((a, b) => b.volatility - a.volatility)
    .slice(0, 10);
  const setValueSeriesByCode = new Map<string, Map<string, number>>();
  cards.forEach((card) => {
    const existing = setValueSeriesByCode.get(card.setCode) ?? new Map<string, number>();
    card.series.forEach((point) => {
      if (typeof point.raw !== "number") {
        return;
      }
      existing.set(point.date, (existing.get(point.date) ?? 0) + point.raw);
    });
    setValueSeriesByCode.set(card.setCode, existing);
  });
  const volatilityChartSets = topVolatileSets.slice(0, 4);
  const setTrendLabels = [
    ...new Set(
      volatilityChartSets.flatMap((set) =>
        [...(setValueSeriesByCode.get(set.code) ?? new Map<string, number>()).keys()],
      ),
    ),
  ].sort();
  const setVolatilityChartSeries = volatilityChartSets.map((set, index) => {
    const palette = ["#60a5fa", "#34d399", "#f59e0b", "#f472b6"];
    const map = setValueSeriesByCode.get(set.code) ?? new Map<string, number>();
    return {
      label: set.name,
      color: palette[index % palette.length],
      values: setTrendLabels.map((date) => map.get(date)),
    };
  });
  const sealedSetSelectorOptions = sealedSetHistory
    .map((entry) => ({
      ...entry,
      totalListings: entry.series.reduce((sum, point) => sum + point.tcgplayerListings, 0),
    }))
    .sort((a, b) => b.totalListings - a.totalListings);
  const selectedSealedSetHistory =
    sealedSetSelectorOptions.find((entry) => entry.setId === selectedSealedSetId) ??
    sealedSetSelectorOptions[0] ??
    null;
  const selectedSealedMarketTypeLabel =
    SEALED_MARKET_TYPE_OPTIONS.find((option) => option.value === selectedSealedMarketType)?.label ?? "Sealed Product";
  const selectedSealedSetProducts = selectedSealedSetHistory
    ? sealedProductsBySetId.get(selectedSealedSetHistory.setId) ?? []
    : [];
  const selectedSealedTypeProducts = selectedSealedSetProducts.filter((product) =>
    matchesSealedMarketTypeFilter(product, selectedSealedMarketType),
  );
  const selectedSealedSetLabels =
    selectedSealedSetHistory?.series.map((point) => point.date.slice(0, 7)) ?? [];
  const selectedSealedSetListingValues =
    selectedSealedSetHistory?.series.map((point) => point.tcgplayerListings) ?? [];
  const selectedSealedSetMarketValues = selectedSealedSetLabels.map((month) => {
    const monthValues = selectedSealedTypeProducts
      .map((product) => {
        const matchingPoint = product.series.find((point) => point.date.slice(0, 7) === month);
        return matchingPoint?.market ?? matchingPoint?.tracked ?? matchingPoint?.target;
      })
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    if (!monthValues.length) {
      return undefined;
    }

    const total = monthValues.reduce((sum, value) => sum + value, 0);
    return total / monthValues.length;
  });
  const latestSelectedSealedSetPoint =
    selectedSealedSetHistory?.series[selectedSealedSetHistory.series.length - 1] ?? null;
  const latestSelectedSealedSetMarketValue =
    [...selectedSealedSetMarketValues].reverse().find((value): value is number => typeof value === "number") ??
    undefined;
  const sealedInventoryByProductId = sealed.reduce<Map<string, { quantity: number; trackedValueUsd?: number }>>(
    (map, item) => {
      const productId = item.productId ?? item.product?.id;
      if (!productId) {
        return map;
      }

      const existing = map.get(productId) ?? { quantity: 0, trackedValueUsd: undefined };
      existing.quantity += item.quantity;
      if (typeof item.estimatedValueUsd === "number") {
        existing.trackedValueUsd = item.estimatedValueUsd;
      } else if (
        typeof item.marketValueUsd === "number" &&
        typeof existing.trackedValueUsd !== "number"
      ) {
        existing.trackedValueUsd = item.marketValueUsd;
      }
      map.set(productId, existing);
      return map;
    },
    new Map(),
  );
  const sealedWishlistByProductId = sealedWishlist.reduce<
    Map<string, { count: number; priority: number; targetPriceUsd?: number }>
  >((map, item) => {
    const productId = item.productId ?? item.product?.id;
    if (!productId) {
      return map;
    }

    const existing = map.get(productId) ?? {
      count: 0,
      priority: item.priority,
      targetPriceUsd: item.targetPriceUsd,
    };
    existing.count += 1;
    existing.priority = Math.min(existing.priority, item.priority);
    if (typeof item.targetPriceUsd === "number") {
      existing.targetPriceUsd = item.targetPriceUsd;
    }
    map.set(productId, existing);
    return map;
  }, new Map());
  const allSealedProductMatches: SealedSearchMatch[] = sealedProducts
    .map((product) => {
      const inventory = sealedInventoryByProductId.get(product.id);
      const wish = sealedWishlistByProductId.get(product.id);
      const metaParts: string[] = [];
      if (inventory?.quantity) {
        metaParts.push(`Owned x${inventory.quantity}`);
      }
      if (wish?.count) {
        metaParts.push(`Wish x${wish.count}${wish.priority ? ` (P${wish.priority})` : ""}`);
      }
      if (!metaParts.length) {
        metaParts.push("Catalog");
      }

      const trackedValueUsd =
        inventory?.trackedValueUsd ?? wish?.targetPriceUsd ?? product.marketValueUsd;

      return {
        id: product.id,
        productId: product.id,
        productName: product.productName,
        setCode: product.setCode,
        setName: product.setName,
        productType: product.productType,
        series: product.series,
        metrics: product.metrics,
        meta: metaParts.join(" | "),
        valueLabel: usd(trackedValueUsd),
        score: query
          ? relevanceScore(
              query,
              `${product.productName} ${product.setCode} ${product.setName} ${formatSealedProductType(product.productType)}`,
            )
          : 0,
        imageUrl: product.imageUrl ?? product.setLogoUrl ?? product.setSymbolUrl,
        inventoryQuantity: inventory?.quantity ?? 0,
        wishlistCount: wish?.count ?? 0,
        wishlistPriority: wish?.priority,
        marketValueUsd: product.marketValueUsd,
        releaseDate: product.releaseDate,
        upc: product.upc,
      };
    })
    .filter((item) => (query ? item.score >= 0 : true))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.inventoryQuantity - a.inventoryQuantity ||
        b.wishlistCount - a.wishlistCount ||
        a.productName.localeCompare(b.productName),
    );
  const matchingSealedProducts = allSealedProductMatches.slice(0, 20);
  const selectedSealedProduct =
    allSealedProductMatches.find((item) => item.productId === quickSealedId) ??
    matchingSealedProducts[0] ??
    null;
  const selectedSealedChartLabels = selectedSealedProduct?.series?.map((point) => point.date.slice(0, 7)) ?? [];
  const selectedSealedChartSeries = [
    {
      label: "Catalog Market",
      color: "#60a5fa",
      values: selectedSealedProduct?.series?.map((point) => point.market) ?? [],
    },
    {
      label: "Tracked Value",
      color: "#34d399",
      values: selectedSealedProduct?.series?.map((point) => point.tracked) ?? [],
    },
    {
      label: "Wishlist Target",
      color: "#f59e0b",
      values: selectedSealedProduct?.series?.map((point) => point.target) ?? [],
    },
  ].filter((series) => series.values.some((value) => typeof value === "number"));
  const sealedRoiLeaders = sealedProducts
    .slice()
    .sort((a, b) => b.metrics.roi12m - a.metrics.roi12m)
    .slice(0, 12);
  const sealedLiquidityLeaders = sealedProducts
    .slice()
    .sort((a, b) => b.metrics.liquidityScore - a.metrics.liquidityScore)
    .slice(0, 12);
  const sealedVolatilityLeaders = sealedProducts
    .slice()
    .sort((a, b) => b.metrics.volatility - a.metrics.volatility)
    .slice(0, 12);
  const sealedAnalyticsKpis = {
    topRoi: sealedRoiLeaders[0]?.metrics.roi12m ?? 0,
    topLiquidity: sealedLiquidityLeaders[0]?.metrics.liquidityScore ?? 0,
    highestVolatility: sealedVolatilityLeaders[0]?.metrics.volatility ?? 0,
    trackedProducts: sealedProducts.length,
  };
  const dropdownCardMatches = query ? matchingCards.slice(0, 5) : [];
  const dropdownSealedMatches = query ? matchingSealedProducts.slice(0, 5) : [];
  const searchDropdownOptions = [
    ...dropdownCardMatches.map((card) => ({ kind: "CARD" as const, card })),
    ...dropdownSealedMatches.map((item) => ({ kind: "SEALED" as const, item })),
  ];
  const customPortfolios = portfolios.filter((portfolio) => portfolio.name !== "Main Portfolio");
  const activePortfolioIdForActions =
    selectedPortfolioView === "ALL" ? portfolios[0]?.id ?? "" : selectedPortfolioView;
  const portfolioScopeLabel =
    selectedPortfolioView === "ALL"
      ? "Total Portfolio"
      : portfolios.find((portfolio) => portfolio.id === selectedPortfolioView)?.name ?? "Selected Portfolio";
  const portfolioScopedCollection = collection.filter((item) =>
    selectedPortfolioView === "ALL" ? true : item.portfolioId === selectedPortfolioView,
  );
  const portfolioScopedSealed = sealed.filter((item) =>
    selectedPortfolioView === "ALL" ? true : item.portfolioId === selectedPortfolioView,
  );
  const showSearchDropdown = searchDropdownOpen && Boolean(query);
  const effectiveSearchDropdownIndex = searchDropdownOptions.length
    ? Math.min(searchDropdownIndex, searchDropdownOptions.length - 1)
    : 0;
  const quickPortfolioActionsPanel = (
    <section className="section-panel rounded-xl p-3">
      <h3 className="mb-2 text-sm font-semibold text-slate-200">Add Portfolio Items</h3>
      {!can("PORTFOLIO_TRACKING") ? (
        <p className="text-sm text-slate-300">
          Upgrade to Pro to track collection, wishlist, and sealed positions.
        </p>
      ) : null}
      <div className="section-panel-soft rounded-xl p-3">
        <div className="mb-3">
          <label className="space-y-1">
            <span className="text-xs text-slate-300">Target Portfolio</span>
            <select
              className="mt-1 w-full rounded border border-white/20 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
              value={selectedPortfolioView === "ALL" ? activePortfolioIdForActions : selectedPortfolioView}
              onChange={(event) => setSelectedPortfolioView(event.target.value)}
              disabled={!can("PORTFOLIO_TRACKING") || !portfolios.length}
            >
              {portfolios.map((portfolio) => (
                <option key={portfolio.id} value={portfolio.id}>
                  {portfolio.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { id: "RAW" as const, label: "Add Raw" },
            { id: "SEALED" as const, label: "Add Sealed" },
            { id: "GRADED" as const, label: "Add Graded" },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setQuickActionMode(option.id)}
              disabled={!can("PORTFOLIO_TRACKING")}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-60 ${
                quickActionMode === option.id
                  ? "border-cyan-300/40 bg-cyan-500/20 text-cyan-100"
                  : "border-white/20 bg-slate-900/60 text-slate-100"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {quickActionMode === "RAW" ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-300">
              Enter the card name and card number, then choose the exact card to add it as a raw card.
            </p>
            <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
              <label className="space-y-1">
                <span className="text-xs text-slate-300">Card Name</span>
                <input
                  className="w-full rounded border border-white/20 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/60"
                  value={quickRawName}
                  onChange={(event) => setQuickRawName(event.target.value)}
                  placeholder="Charizard"
                  disabled={!can("PORTFOLIO_TRACKING")}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-300">Card Number</span>
                <input
                  className="w-full rounded border border-white/20 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/60"
                  value={quickRawNumber}
                  onChange={(event) => setQuickRawNumber(event.target.value)}
                  placeholder="4"
                  disabled={!can("PORTFOLIO_TRACKING")}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-300">Condition</span>
                <select
                  className="w-full rounded border border-white/20 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                  value={quickRawCondition}
                  onChange={(event) => setQuickRawCondition(event.target.value as RawCardCondition)}
                  disabled={!can("PORTFOLIO_TRACKING")}
                >
                  {RAW_CARD_CONDITION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="space-y-1">
              <span className="text-xs text-slate-300">Select Card</span>
              <select
                className="w-full rounded border border-white/20 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                value={activeQuickRawCardId}
                onChange={(event) => setQuickRawSelectedCardId(event.target.value)}
                disabled={!can("PORTFOLIO_TRACKING") || !quickRawMatches.length}
              >
                {quickRawMatches.length ? (
                  quickRawMatches.map((card) => (
                    <option key={card.cardId} value={card.cardId}>
                      {card.cardName} {card.cardNumber} | {card.setName}
                    </option>
                  ))
                ) : (
                  <option value="">No cards match the current entry</option>
                )}
              </select>
            </label>
            <button
              className="rounded border border-white/20 bg-slate-900/70 px-3 py-2 text-sm text-white disabled:opacity-60"
              onClick={quickAddCollection}
              disabled={!can("PORTFOLIO_TRACKING") || !activeQuickRawCardId}
              data-testid="quick-add-raw"
            >
              Add Raw
            </button>
          </div>
        ) : null}

        {quickActionMode === "SEALED" ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-300">
              Enter the set name, choose the sealed product type, then select the exact product to add it to your sealed collection.
            </p>
            <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
              <label className="space-y-1">
                <span className="text-xs text-slate-300">Set Name</span>
                <input
                  className="w-full rounded border border-white/20 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/60"
                  value={quickSealedSetName}
                  onChange={(event) => setQuickSealedSetName(event.target.value)}
                  placeholder="Evolving Skies"
                  disabled={!can("PORTFOLIO_TRACKING")}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-300">Sealed Type</span>
                <select
                  className="w-full rounded border border-white/20 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                  value={quickSealedType}
                  onChange={(event) =>
                    setQuickSealedType(
                      event.target.value as
                        | "ALL"
                        | "BOOSTER_BOX"
                        | "ELITE_TRAINER_BOX"
                        | "COLLECTION_BOX"
                        | "TIN"
                        | "BLISTER"
                        | "OTHER",
                    )
                  }
                  disabled={!can("PORTFOLIO_TRACKING")}
                >
                  <option value="ALL">All Types</option>
                  <option value="BOOSTER_BOX">Booster Box</option>
                  <option value="ELITE_TRAINER_BOX">ETB</option>
                  <option value="BLISTER">Booster Pack / Blister</option>
                  <option value="COLLECTION_BOX">Collection Box</option>
                  <option value="TIN">Tin</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
            </div>
            <label className="space-y-1">
              <span className="text-xs text-slate-300">Select Sealed Product</span>
              <select
                className="w-full rounded border border-white/20 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                value={activeQuickSealedProductId}
                onChange={(event) => setQuickSealedSelectedProductId(event.target.value)}
                disabled={!can("PORTFOLIO_TRACKING") || !quickSealedMatches.length}
              >
                {quickSealedMatches.length ? (
                  quickSealedMatches.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.productName} | {product.setName}
                    </option>
                  ))
                ) : (
                  <option value="">No sealed products match the current filters</option>
                )}
              </select>
            </label>
            <button
              className="rounded border border-cyan-300/40 bg-cyan-500/20 px-3 py-2 text-sm text-cyan-100 disabled:opacity-60"
              onClick={quickAddSealed}
              disabled={!can("PORTFOLIO_TRACKING") || !activeQuickSealedProductId}
              data-testid="quick-add-sealed"
            >
              Add Sealed
            </button>
          </div>
        ) : null}

        {quickActionMode === "GRADED" ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-300">
              Search for a card or sealed product, then enter the grading company, slab number, and assigned grade before adding it as a graded item.
            </p>
            <label className="space-y-1">
              <span className="text-xs text-slate-300">Card or Sealed Product Name</span>
              <input
                className="w-full rounded border border-white/20 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/60"
                value={quickGradedQuery}
                onChange={(event) => setQuickGradedQuery(event.target.value)}
                placeholder="Umbreon VMAX or Evolving Skies ETB"
                disabled={!can("PORTFOLIO_TRACKING")}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-300">Select Graded Item</span>
              <select
                className="w-full rounded border border-white/20 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                value={activeQuickGradedValue}
                onChange={(event) => setQuickGradedSelectedValue(event.target.value)}
                disabled={!can("PORTFOLIO_TRACKING") || !quickGradedOptions.length}
              >
                {quickGradedOptions.length ? (
                  quickGradedOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.kind === "card" ? "Card" : "Sealed"} | {option.label} | {option.meta}
                    </option>
                  ))
                ) : (
                  <option value="">No graded matches found</option>
                )}
              </select>
            </label>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1">
                <span className="text-xs text-slate-300">Grading Company</span>
                <select
                  className="w-full rounded border border-white/20 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                  value={quickGradedGrader}
                  onChange={(event) => setQuickGradedGrader(event.target.value as "PSA" | "TAG")}
                  disabled={!can("PORTFOLIO_TRACKING")}
                >
                  <option value="PSA">PSA</option>
                  <option value="TAG">TAG</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-300">PSA / TAG Slab Number</span>
                <input
                  className="w-full rounded border border-white/20 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/60"
                  value={quickGradedCertificationNumber}
                  onChange={(event) => setQuickGradedCertificationNumber(event.target.value)}
                  placeholder="12345678"
                  disabled={!can("PORTFOLIO_TRACKING")}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-300">Grade (1-10)</span>
                <input
                  className="w-full rounded border border-white/20 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/60"
                  type="number"
                  min={1}
                  max={10}
                  step={1}
                  value={quickGradedGrade}
                  onChange={(event) => setQuickGradedGrade(event.target.value)}
                  disabled={!can("PORTFOLIO_TRACKING")}
                />
              </label>
            </div>
            <button
              className="rounded border border-fuchsia-300/40 bg-fuchsia-500/20 px-3 py-2 text-sm text-fuchsia-100 disabled:opacity-60"
              onClick={quickAddGraded}
              disabled={!can("PORTFOLIO_TRACKING") || !activeQuickGradedOption}
            >
              Add Graded
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
  const selectedScanSealedCandidate =
    scanResult?.sealedCandidates?.find((item) => item.productId === scanSelectedSealedId) ??
    scanResult?.sealedCandidates?.[0] ??
    null;
  const scannerPrimaryProductId = selectedScanSealedCandidate?.productId ?? scanResult?.sealed?.productId ?? "";
  const metricForCardRef = (
    cardRef: { name: string; cardNumber: string; setCode: string } | null,
  ): CardApi | null => {
    if (!cardRef) {
      return null;
    }

    return (
      cards.find(
        (card) =>
          card.cardName === cardRef.name &&
          card.cardNumber === cardRef.cardNumber &&
          card.setCode.toLowerCase() === cardRef.setCode.toLowerCase(),
      ) ?? null
    );
  };

  const collectionPositionRows = portfolioScopedCollection.map((item) => {
    const metric = metricForCardRef(item.card);
    const catalogCard = item.card
      ? cards.find(
          (card) =>
            card.cardName === item.card?.name &&
            card.cardNumber === item.card?.cardNumber &&
            card.setCode.toLowerCase() === item.card?.setCode.toLowerCase(),
        ) ?? null
      : null;
    const rawCondition = item.ownershipType === "RAW" ? normalizeRawCardCondition(item.rawCondition) : undefined;
    const unitPrice =
      item.ownershipType === "GRADED" && item.grade === 10
        ? item.grader === "TAG"
          ? metric?.tag10Price ?? metric?.rawPrice ?? 0
          : metric?.psa10Price ?? metric?.rawPrice ?? 0
        : rawConditionAdjustedPrice(metric?.rawPrice, rawCondition);
    const marketValue = unitPrice * item.quantity;

    return {
      id: item.id,
      portfolioName: item.portfolioName ?? "Main Portfolio",
      label: item.card ? `${item.card.name} ${item.card.cardNumber}` : "Unknown card",
      imageUrl:
        item.card?.imageUrl ??
        item.card?.imageLargeUrl ??
        catalogCard?.imageUrl ??
        catalogCard?.imageLargeUrl,
      cardName: item.card?.name ?? "Unknown card",
      cardNumber: item.card?.cardNumber,
      setName: item.card?.setName ?? catalogCard?.setName ?? item.card?.setCode.toUpperCase() ?? "Unknown Set",
      quantity: item.quantity,
      marketValue,
      ownershipType: item.ownershipType,
      rawCondition,
    };
  });
  const sealedPositionRows = portfolioScopedSealed.map((item) => ({
    id: item.id,
    portfolioName: item.portfolioName ?? "Main Portfolio",
    label: item.setName ?? item.setCode.toUpperCase(),
    imageUrl: item.imageUrl ?? item.product?.imageUrl ?? item.setLogoUrl ?? item.setSymbolUrl,
    productType: formatSealedProductType(item.productType),
    quantity: item.quantity,
    marketValue: (item.estimatedValueUsd ?? item.marketValueUsd ?? 0) * item.quantity,
  }));
  const collectionMarketValue = collectionPositionRows.reduce((sum, row) => sum + row.marketValue, 0);
  const rawCollectionMarketValue = collectionPositionRows
    .filter((row) => row.ownershipType === "RAW")
    .reduce((sum, row) => sum + row.marketValue, 0);
  const gradedCollectionMarketValue = collectionPositionRows
    .filter((row) => row.ownershipType === "GRADED")
    .reduce((sum, row) => sum + row.marketValue, 0);
  const sealedMarketValue = portfolioScopedSealed.reduce(
    (sum, item) => sum + (item.estimatedValueUsd ?? item.marketValueUsd ?? 0) * item.quantity,
    0,
  );
  const portfolioMarketValue = collectionMarketValue + sealedMarketValue;
  const indexStart = indexSeries[0]?.value ?? 100;
  const indexEnd = indexSeries[indexSeries.length - 1]?.value ?? indexStart;
  const benchmarkRoi = indexStart > 0 ? ((indexEnd - indexStart) / indexStart) * 100 : 0;
  const previousIndexLevel = indexSeries[indexSeries.length - 2]?.value ?? latestIndexLevel;
  const marketHealthDeltaPct =
    previousIndexLevel > 0 ? ((latestIndexLevel - previousIndexLevel) / previousIndexLevel) * 100 : 0;
  const averageTrackedRoi = cards.length
    ? cards.reduce((sum, card) => sum + card.roi12m, 0) / cards.length
    : benchmarkRoi;
  const averageReturnVsBenchmark = averageTrackedRoi - benchmarkRoi;
  const topArbitrageCard = arbitrageRows[0] ?? null;
  const nextArbitrageCard = arbitrageRows[1] ?? null;
  const topArbitrageGap =
    topArbitrageCard && nextArbitrageCard
      ? topArbitrageCard.gradingArbitrageUsd - nextArbitrageCard.gradingArbitrageUsd
      : topArbitrageCard?.gradingArbitrageUsd ?? 0;
  const marketHealthStatus =
    latestIndexLevel >= 110 ? "Healthy" : latestIndexLevel >= 100 ? "Stable" : "Cooling";
  const averageReturnStatus =
    averageTrackedRoi >= 12 ? "Strong" : averageTrackedRoi >= 0 ? "Positive" : "Negative";
  const gradingOpportunityStatus =
    (topArbitrageCard?.gradingArbitrageUsd ?? 0) >= 250
      ? "Strong Edge"
      : (topArbitrageCard?.gradingArbitrageUsd ?? 0) >= 75
        ? "Watchlist"
        : "Thin Edge";
  const dashboardKpis = [
    {
      id: "market-health",
      title: "Market Health Score",
      value: latestIndexLevel.toFixed(2),
      status: marketHealthStatus,
      summary: "Tracks the overall strength of your tracked Pokemon card market.",
      context: `${marketHealthDeltaPct >= 0 ? "Up" : "Down"} ${formatPercent(Math.abs(marketHealthDeltaPct))} vs previous month`,
      whyItMatters: "Higher values mean the tracked market is strengthening overall, while lower values signal broader cooling.",
      methodology:
        "Calculated from the Investige trend line. It compares the current index value to recent snapshots across the tracked card universe to show market direction at a glance.",
    },
    {
      id: "average-return",
      title: "Average 12-Month Return",
      value: formatPercent(averageTrackedRoi),
      status: averageReturnStatus,
      summary: "Shows the average 1-year gain across the tracked card market.",
      context: `${averageReturnVsBenchmark >= 0 ? "+" : ""}${averageReturnVsBenchmark.toFixed(2)} pts vs market benchmark`,
      whyItMatters: "This helps users quickly judge whether the broader market is delivering positive returns or flattening out.",
      methodology:
        "Averages the 12-month ROI values across the tracked cards currently loaded in the dashboard, then compares that average to the card index benchmark return.",
    },
    {
      id: "grading-opportunity",
      title: "Best Grading Opportunity",
      value: topArbitrageCard ? usd(topArbitrageCard.gradingArbitrageUsd) : "-",
      status: gradingOpportunityStatus,
      summary: "Highlights the largest current raw-to-graded value gap.",
      context: topArbitrageCard
        ? `${topArbitrageCard.cardName} ${topArbitrageCard.cardNumber} leads by ${usd(topArbitrageGap)}`
        : "No strong grading setups are currently flagged",
      whyItMatters: "This helps users find cards where grading may create the most immediate value upside right now.",
      methodology:
        "Ranks tracked cards by estimated grading edge, using the spread between the current raw price and projected premium from PSA 10 or TAG 10 outcomes.",
    },
    {
      id: "data-source",
      title: "Data Source Status",
      value: dataQuality?.label ?? "Unknown",
      status: dataQuality?.status === "LIVE_READY" ? "Live" : dataQuality?.status === "PARTIAL_LIVE" ? "Mixed" : "Demo",
      summary: "Tells the user how much of the dashboard is live versus seeded demo data.",
      context:
        dataQuality?.blockingReason ??
        "Live sync is available when enough current catalog, sales, and population data are loaded.",
      whyItMatters: "Users can trust live-backed metrics more confidently and know when values are still illustrative.",
      methodology:
        "Based on internal data-quality thresholds for live sets, cards, sales coverage, and population coverage. Until those thresholds are met, the app labels results as mixed or demo.",
    },
  ];
  const positiveArbitrageCount = arbitrageRows.filter((card) => card.gradingArbitrageUsd > 0).length;
  const averageTopArbitrageEdge = arbitrageRows.length
    ? arbitrageRows.slice(0, Math.min(10, arbitrageRows.length)).reduce((sum, card) => sum + card.gradingArbitrageUsd, 0) /
      Math.min(10, arbitrageRows.length)
    : 0;
  const topIndexWeight = indexComponents[0]?.weightPct ?? 0;
  const topFiveIndexWeight = indexComponents.slice(0, 5).reduce((sum, card) => sum + card.weightPct, 0);
  const benchmarkReturnStatus =
    benchmarkRoi >= 12 ? "Strong" : benchmarkRoi >= 0 ? "Positive" : "Negative";
  const componentBreadthStatus =
    indexComponents.length >= 15 ? "Broad" : indexComponents.length >= 8 ? "Focused" : "Narrow";
  const rawCardSharePct =
    portfolioMarketValue > 0 ? (rawCollectionMarketValue / portfolioMarketValue) * 100 : 0;
  const gradedCardSharePct =
    portfolioMarketValue > 0 ? (gradedCollectionMarketValue / portfolioMarketValue) * 100 : 0;
  const portfolioSealedSharePct =
    portfolioMarketValue > 0 ? (sealedMarketValue / portfolioMarketValue) * 100 : 0;
  const portfolioStatus =
    portfolioMarketValue >= 10000 ? "Scaled" : portfolioMarketValue >= 1000 ? "Building" : "Early";
  const sealedAverageRoi = sealedProducts.length
    ? sealedProducts.reduce((sum, item) => sum + item.metrics.roi12m, 0) / sealedProducts.length
    : 0;
  const sealedRoiLeader = sealedRoiLeaders[0] ?? null;
  const sealedLiquidityLeader = sealedLiquidityLeaders[0] ?? null;
  const sealedVolatilityLeader = sealedVolatilityLeaders[0] ?? null;
  const sealedAnalyticsCards = [
    {
      id: "sealed-tracked",
      title: "Sealed Products Tracked",
      value: sealedAnalyticsKpis.trackedProducts.toString(),
      status: sealedAnalyticsKpis.trackedProducts >= 10 ? "Broad" : "Focused",
      summary: "How many sealed products are currently included in this market view.",
      context: `${sealedProducts.length} products currently have sealed metrics`,
      whyItMatters:
        "A broader tracked universe gives users stronger ranking context and reduces the chance of one product dominating the section.",
      methodology:
        "Counts sealed catalog products currently loaded into the analytics view that have usable ranking metrics.",
    },
    {
      id: "sealed-best-roi",
      title: "Best 12-Month Sealed Return",
      value: formatPercent(sealedAnalyticsKpis.topRoi),
      status: sealedAnalyticsKpis.topRoi >= 20 ? "Strong" : sealedAnalyticsKpis.topRoi >= 0 ? "Positive" : "Negative",
      summary: "The strongest 1-year sealed gain currently visible in the rankings.",
      context: sealedRoiLeader
        ? `${sealedRoiLeader.productName} leads | Avg sealed return ${formatPercent(sealedAverageRoi)}`
        : "No sealed ROI leader is currently available",
      whyItMatters:
        "This gives users a quick read on the best recent sealed winner and how strong the category’s upside looks.",
      methodology:
        "Uses the highest 12-month ROI value among the currently ranked sealed products, based on recorded sale history.",
    },
    {
      id: "sealed-liquidity",
      title: "Fastest-Moving Sealed Product",
      value: formatPercent(sealedAnalyticsKpis.topLiquidity),
      status: sealedAnalyticsKpis.topLiquidity >= 80 ? "High Demand" : sealedAnalyticsKpis.topLiquidity >= 50 ? "Active" : "Thin",
      summary: "Shows which sealed product appears easiest to buy or sell quickly right now.",
      context: sealedLiquidityLeader
        ? `${sealedLiquidityLeader.productName} | ${sealedLiquidityLeader.metrics.salesLast90d} sales in 90 days`
        : "No sealed liquidity leader is currently available",
      whyItMatters:
        "Strong liquidity usually means faster exits, better price discovery, and less friction when entering or leaving a position.",
      methodology:
        "Ranks sealed products by liquidity score, which is derived from recent sale frequency and spacing between sales.",
    },
    {
      id: "sealed-volatility",
      title: "Widest Sealed Price Swings",
      value: formatPercent(sealedAnalyticsKpis.highestVolatility),
      status:
        sealedAnalyticsKpis.highestVolatility >= 6
          ? "High Risk"
          : sealedAnalyticsKpis.highestVolatility >= 3
            ? "Active"
            : "Stable",
      summary: "Identifies the sealed product with the sharpest recent price movement.",
      context: sealedVolatilityLeader
        ? `${sealedVolatilityLeader.productName} currently shows the largest monthly swings`
        : "No sealed volatility leader is currently available",
      whyItMatters:
        "Higher volatility can create upside, but it also means timing risk is higher and prices are less stable.",
      methodology:
        "Uses the highest current volatility value in the sealed rankings, based on monthly movement in recorded sale prices.",
    },
  ];
  const cardIndexCards = [
    {
      id: "card-index-score",
      title: "Market Benchmark Score",
      value: latestIndexLevel.toFixed(2),
      status: marketHealthStatus,
      summary: "The current benchmark score for the tracked card market.",
      context: `${marketHealthDeltaPct >= 0 ? "Up" : "Down"} ${formatPercent(Math.abs(marketHealthDeltaPct))} vs previous month`,
      whyItMatters:
        "This gives users a fast read on whether the overall tracked card market is strengthening, flat, or cooling.",
      methodology:
        "Uses the latest value in the Investige series, which summarizes the tracked card market into one benchmark number.",
    },
    {
      id: "card-index-breadth",
      title: "Cards In This Benchmark",
      value: indexComponents.length.toString(),
      status: componentBreadthStatus,
      summary: "How many cards are currently driving the benchmark view.",
      context: `Top 5 cards make up ${formatPercent(topFiveIndexWeight)} of the benchmark`,
      whyItMatters:
        "This shows whether the benchmark is broad and diversified or heavily influenced by a smaller group of top cards.",
      methodology:
        "Counts the active benchmark components and highlights how much total weight is concentrated in the top five cards.",
    },
    {
      id: "card-index-return",
      title: "Benchmark 12-Month Return",
      value: formatPercent(benchmarkRoi),
      status: benchmarkReturnStatus,
      summary: "The 1-year return for the overall card benchmark.",
      context: `Largest single-card weight is ${formatPercent(topIndexWeight)}`,
      whyItMatters:
        "This helps users compare individual cards against the broader market instead of viewing performance in isolation.",
      methodology:
        "Compares the first and latest values in the current Investige series to measure one-year benchmark performance.",
    },
  ];
  const arbitrageCards = [
    {
      id: "arb-best-edge",
      title: "Best Grading Profit",
      value: topArbitrageCard ? usd(topArbitrageCard.gradingArbitrageUsd) : "-",
      status: gradingOpportunityStatus,
      summary: "The strongest current projected profit from buying raw and grading.",
      context: topArbitrageCard
        ? `${topArbitrageCard.cardName} ${topArbitrageCard.cardNumber} is the current leader`
        : "No grading opportunities are currently available",
      whyItMatters:
        "This gives users the clearest example of where grading may create the most value right now.",
      methodology:
        "Uses the highest estimated grading edge among current candidates, based on raw price, grade-10 pricing, and gem-rate assumptions.",
    },
    {
      id: "arb-positive-count",
      title: "Profitable Grading Candidates",
      value: positiveArbitrageCount.toString(),
      status: positiveArbitrageCount >= 10 ? "Broad" : positiveArbitrageCount > 0 ? "Selective" : "None",
      summary: "How many cards currently show positive modeled grading profit.",
      context: `${arbitrageRows.length} cards are currently ranked in this view`,
      whyItMatters:
        "This shows whether grading upside is widespread right now or limited to a small set of niche opportunities.",
      methodology:
        "Counts cards in the arbitrage ranking whose modeled grading edge is above zero dollars.",
    },
    {
      id: "arb-average-edge",
      title: "Average Top-10 Grading Profit",
      value: usd(averageTopArbitrageEdge),
      status: averageTopArbitrageEdge >= 100 ? "Strong" : averageTopArbitrageEdge >= 0 ? "Mixed" : "Weak",
      summary: "The average projected grading profit across the 10 strongest current setups.",
      context: `${averageTopArbitrageEdge >= 0 ? "Positive" : "Negative"} average across the top-ranked candidates`,
      whyItMatters:
        "A single standout card can be misleading. This shows whether the top of the arbitrage list has broader strength.",
      methodology:
        "Averages the estimated grading edge for the top 10 arbitrage-ranked cards in the current table.",
    },
  ];
  const portfolioCards = [
    {
      id: "portfolio-raw-cards",
      title: "Raw Card Collection Value",
      value: usd(rawCollectionMarketValue),
      status: rawCardSharePct >= 35 ? "Core" : rawCardSharePct > 0 ? "Active" : "Empty",
      summary: "The current estimated market value of your raw card holdings.",
      context: `${formatPercent(rawCardSharePct)} of your total portfolio`,
      whyItMatters:
        "This shows how much of your portfolio value is tied to ungraded cards, which often behave differently from graded cards.",
      methodology:
        "Sums the current modeled market value of each tracked card position where the ownership type is raw.",
    },
    {
      id: "portfolio-graded-cards",
      title: "Graded Card Collection Value",
      value: usd(gradedCollectionMarketValue),
      status: gradedCardSharePct >= 35 ? "Core" : gradedCardSharePct > 0 ? "Active" : "Empty",
      summary: "The current estimated market value of your graded card holdings.",
      context: `${formatPercent(gradedCardSharePct)} of your total portfolio`,
      whyItMatters:
        "This shows how much of your portfolio value is tied to graded cards, which typically have different pricing and liquidity than raw cards.",
      methodology:
        "Sums the current modeled market value of each tracked card position where the ownership type is graded.",
    },
    {
      id: "portfolio-sealed",
      title: "Sealed Collection Value",
      value: usd(sealedMarketValue),
      status: portfolioSealedSharePct >= 60 ? "Sealed Heavy" : portfolioSealedSharePct > 0 ? "Balanced" : "Empty",
      summary: "The current estimated market value of your sealed holdings.",
      context: `${formatPercent(portfolioSealedSharePct)} of your total portfolio`,
      whyItMatters:
        "This helps users see how much of their portfolio exposure depends on sealed product performance.",
      methodology:
        "Sums estimated or tracked values of sealed collection items using quantity and the latest available sealed values.",
    },
    {
      id: "portfolio-total",
      title: "Total Portfolio Value",
      value: usd(portfolioMarketValue),
      status: portfolioStatus,
      summary: "The combined value of your cards and sealed products.",
      context: `${benchmarkRoi >= 0 ? "Market benchmark is up" : "Market benchmark is down"} ${formatPercent(Math.abs(benchmarkRoi))} over 12 months`,
      whyItMatters:
        "This is the fastest way to understand the current size of your tracked Pokemon investment portfolio.",
      methodology:
        "Adds your current card collection value and sealed collection value into one total portfolio number.",
    },
  ];
  const collectionSeriesByDate = new Map<string, number>();
  portfolioScopedCollection.forEach((item) => {
    const metric = metricForCardRef(item.card);
    if (!metric) {
      return;
    }
    const rawCondition = item.ownershipType === "RAW" ? normalizeRawCardCondition(item.rawCondition) : undefined;

    metric.series.forEach((point) => {
      const unitPrice =
        item.ownershipType === "GRADED" && item.grade === 10
          ? item.grader === "TAG"
            ? point.tag10 ?? point.raw
            : point.psa10 ?? point.raw
          : rawConditionAdjustedPrice(point.raw, rawCondition);

      if (typeof unitPrice !== "number") {
        return;
      }

      collectionSeriesByDate.set(
        point.date,
        (collectionSeriesByDate.get(point.date) ?? 0) + unitPrice * item.quantity,
      );
    });
  });
  const portfolioTrendLabels = [
    ...new Set([
      ...collectionSeriesByDate.keys(),
      ...(collectionSeriesByDate.size === 0 ? indexSeries.map((point) => point.date) : []),
    ]),
  ].sort();
  const portfolioChartSeries = [
    {
      label: "Collection Value",
      color: "#60a5fa",
      values: portfolioTrendLabels.map((date) => collectionSeriesByDate.get(date) ?? 0),
    },
    {
      label: "Sealed Value",
      color: "#f59e0b",
      values: portfolioTrendLabels.map(() => sealedMarketValue),
    },
    {
      label: "Portfolio Value",
      color: "#34d399",
      values: portfolioTrendLabels.map((date) => (collectionSeriesByDate.get(date) ?? 0) + sealedMarketValue),
    },
  ];

  const renderActiveTab = () => {
    if (activeTab === "ANALYTICS_DASHBOARD") {
      return (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-100">Dashboard</h2>
          {!can("ADVANCED_ANALYTICS") ? (
            <p className="text-sm text-slate-300">
              Advanced analytics is richer on Elite, but the core market dashboard is available below.
            </p>
          ) : null}
          <>
              <div className="section-panel-soft rounded-xl p-3">
                <p className="text-sm text-slate-200">
                  Top Investment Opportunities and Overall Market Strength
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Each top metric now includes plain-language definitions and click-to-expand methodology details.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {dashboardKpis.map((kpi) => {
                  const expanded = expandedDashboardKpi === kpi.id;
                  return (
                    <button
                      key={kpi.id}
                      type="button"
                      onClick={() => setExpandedDashboardKpi(expanded ? null : kpi.id)}
                      className={`rounded-xl p-3 text-left transition ${
                        expanded
                          ? "bg-cyan-500/10 ring-1 ring-cyan-300/30"
                          : "bg-white/[0.035] hover:bg-white/[0.05]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="group/title relative inline-flex max-w-full">
                            <span className="text-xs text-slate-300 underline decoration-dotted underline-offset-3">
                              {kpi.title}
                            </span>
                            <span className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-64 rounded-lg border border-white/10 bg-slate-950/95 px-3 py-2 text-[11px] normal-case text-slate-100 shadow-lg shadow-black/35 group-hover/title:block">
                              {kpi.summary}
                            </span>
                          </span>
                          <p className="mt-1 text-lg font-semibold text-slate-100">{kpi.value}</p>
                        </div>
                        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold capitalize tracking-wide text-slate-200">
                          {kpi.status}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-cyan-100">{kpi.context}</p>
                      <p className="mt-2 text-[11px] capitalize tracking-wide text-slate-400">
                        {expanded ? "Hide Details" : "Click For Details"}
                      </p>
                      {expanded ? (
                        <div className="mt-3 space-y-2 rounded-lg bg-black/20 p-3">
                          <div>
                            <p className="text-[10px] font-semibold capitalize tracking-wide text-slate-400">
                              Why It Matters
                            </p>
                            <p className="mt-1 text-xs text-slate-200">{kpi.whyItMatters}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold capitalize tracking-wide text-slate-400">
                              How It Is Calculated
                            </p>
                            <p className="mt-1 text-xs text-slate-200">{kpi.methodology}</p>
                          </div>
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <section className="section-panel rounded-xl p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="group/title relative inline-flex max-w-full">
                    <h3 className="text-sm font-semibold text-slate-200 underline decoration-dotted underline-offset-3">
                      Pokémon TCG Market Index
                    </h3>
                    <span className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-72 rounded-lg border border-white/10 bg-slate-950/95 px-3 py-2 text-[11px] normal-case text-slate-100 shadow-lg shadow-black/35 group-hover/title:block">
                      This chart tracks the overall movement of the app&apos;s card market benchmark over time. It helps users see whether the broader tracked card market is strengthening, flattening, or cooling off.
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab("CARD_DETAILS")}
                    className="rounded-lg border border-cyan-300/30 bg-cyan-500/15 px-3 py-1 text-xs font-semibold capitalize tracking-wide text-cyan-100 hover:bg-cyan-500/25"
                  >
                    Open Card Analytics
                  </button>
                </div>
                <MultiSeriesChart
                  labels={indexSeries.map((point) => point.date.slice(0, 7))}
                  series={[
                    {
                      label: "Card Index",
                      color: "#60a5fa",
                      values: indexSeries.map((point) => point.value),
                    },
                  ]}
                  valueMode="number"
                />
              </section>

              <section className="section-panel rounded-xl p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-200">Sealed Market Snapshot</h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab("SEALED_ANALYTICS")}
                    className="rounded-lg border border-cyan-300/30 bg-cyan-500/15 px-3 py-1 text-xs font-semibold capitalize tracking-wide text-cyan-100 hover:bg-cyan-500/25"
                  >
                    Open Sealed Analytics
                  </button>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-3">
                  <div className="section-panel-soft rounded-xl p-3">
                    <p className="text-base font-semibold capitalize tracking-wide text-slate-300">Top ROI</p>
                    {sealedRoiLeaders.slice(0, 3).map((item) => (
                      <div key={`roi-${item.id}`} className="mt-2 flex items-center justify-between gap-3 text-sm text-slate-100">
                        <SealedCell imageUrl={item.imageUrl ?? item.setLogoUrl ?? item.setSymbolUrl} name={item.productName} />
                        <span>{formatPercent(item.metrics.roi12m)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="section-panel-soft rounded-xl p-3">
                    <p className="text-base font-semibold capitalize tracking-wide text-slate-300">Highest Liquidity</p>
                    {sealedLiquidityLeaders.slice(0, 3).map((item) => (
                      <div key={`liq-${item.id}`} className="mt-2 flex items-center justify-between gap-3 text-sm text-slate-100">
                        <SealedCell imageUrl={item.imageUrl ?? item.setLogoUrl ?? item.setSymbolUrl} name={item.productName} />
                        <span>{formatPercent(item.metrics.liquidityScore)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="section-panel-soft rounded-xl p-3">
                    <p className="text-base font-semibold capitalize tracking-wide text-slate-300">Highest Volatility</p>
                    {sealedVolatilityLeaders.slice(0, 3).map((item) => (
                      <div key={`vol-${item.id}`} className="mt-2 flex items-center justify-between gap-3 text-sm text-slate-100">
                        <SealedCell imageUrl={item.imageUrl ?? item.setLogoUrl ?? item.setSymbolUrl} name={item.productName} />
                        <span>{formatPercent(item.metrics.volatility)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <div className="space-y-4">
                <section className="section-panel rounded-xl p-3">
                  <h3 className="mb-2 text-sm font-semibold text-slate-200">Flipper Signals</h3>
                  {flipperSignalAlerts.length ? (
                    <AnalyticsDataTable
                      rows={flipperSignalAlerts}
                      getRowId={(item) => item.cardId}
                      gridClassName="grid-cols-[1.8fr_1.5fr_1fr_1fr]"
                      maxHeightClassName="max-h-[18rem]"
                      emptyMessage="No active flip signals at the moment."
                      controlMode="singleFilterHeaderSort"
                      expandableColumnKey="label"
                      renderExpandedRow={(item) => <SignalDetailContent alert={item} />}
                      columns={[
                        {
                          key: "label",
                          label: "Card",
                          value: (item) => item.label,
                          render: (item) => {
                            const [name, number] = item.label.split(/ (?=[^ ]+$)/);
                            return (
                              <CardCell
                                imageUrl={item.imageUrl}
                                name={name ?? item.label}
                                number={number && number !== name ? number : undefined}
                              />
                            );
                          },
                        },
                        { key: "setName", label: "Set", value: (item) => item.setName ?? "Unknown Set" },
                        {
                          key: "momentum4mPct",
                          label: "4-Month Momentum %",
                          value: (item) => item.momentum4mPct ?? 0,
                          render: (item) => (
                            <span className={flipperMomentumClass(item.momentum4mPct ?? 0)}>
                              {formatPercent(item.momentum4mPct ?? 0)}
                            </span>
                          ),
                        },
                        {
                          key: "liquidityScore",
                          label: "Liquidity %",
                          value: (item) => item.liquidityScore ?? 0,
                          render: (item) => (
                            <span className={flipperLiquidityClass(item.liquidityScore ?? 0)}>
                              {formatPercent(item.liquidityScore ?? 0)}
                            </span>
                          ),
                        },
                      ]}
                    />
                  ) : (
                    <p className="text-sm text-slate-300">No active flip signals at the moment.</p>
                  )}
                </section>

                <section className="section-panel rounded-xl p-3">
                  <h3 className="mb-2 text-sm font-semibold text-slate-200">Top Arbitrage</h3>
                  <AnalyticsDataTable
                    rows={arbitrageRows.slice(0, 6)}
                    getRowId={(card) => card.cardId}
                    gridClassName="grid-cols-[1.8fr_1.5fr_1fr_1fr]"
                    maxHeightClassName="max-h-[18rem]"
                    emptyMessage="No arbitrage opportunities are available."
                    controlMode="singleFilterHeaderSort"
                    columns={[
                      {
                        key: "cardName",
                        label: "Card",
                        value: (card) => `${card.cardName} ${card.cardNumber}`,
                        render: (card) => (
                          <CardCell imageUrl={card.imageUrl ?? card.imageLargeUrl} name={card.cardName} number={card.cardNumber} />
                        ),
                      },
                      {
                        key: "setName",
                        label: "Set",
                        value: (card) => card.setName,
                      },
                      {
                        key: "gradingArbitrageUsd",
                        label: "Edge",
                        value: (card) => card.gradingArbitrageUsd,
                        render: (card) => usd(card.gradingArbitrageUsd),
                      },
                      {
                        key: "gemRateBlended",
                        label: "Gem Rate",
                        value: (card) => card.gemRateBlended,
                        render: (card) => formatPercent(card.gemRateBlended),
                      },
                    ]}
                  />
                </section>
              </div>

              <section className="section-panel rounded-xl p-3">
                <h3 className="mb-2 text-sm font-semibold text-slate-200">Undervalued Alerts</h3>
                {topUndervaluedAlerts.length ? (
                  <AnalyticsDataTable
                    rows={topUndervaluedAlerts}
                    getRowId={(item) => item.cardId}
                    gridClassName="grid-cols-[1fr_2fr]"
                    maxHeightClassName="max-h-[18rem]"
                    emptyMessage="No undervalued cards are currently flagged."
                    expandableColumnKey="reason"
                    renderExpandedRow={(item) => <SignalDetailContent alert={item} />}
                    columns={[
                      {
                        key: "label",
                        label: "Card",
                        value: (item) => item.label,
                        render: (item) => {
                          const [name, number] = item.label.split(/ (?=[^ ]+$)/);
                          return (
                            <CardCell
                              imageUrl={item.imageUrl}
                              name={name ?? item.label}
                              number={number && number !== name ? number : undefined}
                            />
                          );
                        },
                      },
                      { key: "reason", label: "Reason", value: (item) => item.reason, filterable: false },
                    ]}
                  />
                ) : (
                  <p className="text-sm text-slate-300">No undervalued cards are currently flagged.</p>
                )}
              </section>

              <section className="section-panel rounded-xl p-3">
                <h3 className="mb-2 text-sm font-semibold text-slate-200">Set Volatility Leaders</h3>
                <AnalyticsDataTable
                  rows={topVolatileSets}
                  getRowId={(set) => set.setId}
                  gridClassName="grid-cols-[2fr_1fr_1fr_1fr]"
                  maxHeightClassName="max-h-72"
                  emptyMessage="No set volatility leaders are available yet."
                  columns={[
                    { key: "name", label: "Set", value: (set) => set.name },
                    {
                      key: "totalSetValue",
                      label: "Set Value",
                      value: (set) => set.totalSetValue,
                      render: (set) => usd(set.totalSetValue),
                    },
                    {
                      key: "volatility",
                      label: "Volatility",
                      value: (set) => set.volatility,
                      render: (set) => formatPercent(set.volatility),
                    },
                    {
                      key: "roi12m",
                      label: "12-Month ROI",
                      value: (set) => set.roi12m,
                      render: (set) => formatPercent(set.roi12m),
                    },
                  ]}
                />
              </section>
            </>
        </div>
      );
    }

    if (activeTab === "CARD_DETAILS") {
      return (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-100">Card Analytics</h2>
          {selectedCard ? (
            <>
              {!investmentMetricsReady ? (
                <p className="rounded-xl border border-amber-300/40 bg-amber-500/10 p-2 text-xs text-amber-100">
                  {dataQuality?.blockingReason ??
                    "Investment metrics are still warming up with live data."}
                </p>
              ) : null}
              <div className="flex flex-col gap-3 rounded-2xl bg-white/[0.03] p-3 md:flex-row md:items-start">
                <ProductThumbnail
                  imageUrl={selectedCard.imageLargeUrl ?? selectedCard.imageUrl}
                  alt={`${selectedCard.cardName} ${selectedCard.cardNumber}`}
                  fallback={selectedCard.cardName}
                  className="h-40 w-28 shrink-0"
                />
                <div className="flex-1 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="section-panel rounded-xl p-3">
                  <p className="text-xs text-slate-300">Card</p>
                  <p className="text-sm font-semibold text-slate-100">
                    {selectedCard.cardName} {selectedCard.cardNumber}
                  </p>
                </div>
                <div className="section-panel rounded-xl p-3">
                  <p className="text-xs text-slate-300">Set</p>
                  <div className="mt-1 flex items-center justify-start gap-2">
                    <ProductThumbnail
                      imageUrl={selectedCard.setLogoUrl ?? selectedCard.setSymbolUrl}
                      alt={selectedCard.setName || "Set"}
                      fallback={selectedCard.setName || "Set"}
                      className="h-10 w-10 shrink-0 rounded-md"
                    />
                    <p className="text-sm font-semibold text-slate-100">{selectedCard.setName || "Unknown Set"}</p>
                  </div>
                </div>
                <div className="section-panel rounded-xl p-3">
                  <p className="text-xs text-slate-300">Raw Market Price</p>
                  <p className="text-sm font-semibold text-slate-100">
                    {investmentMetricsReady ? usd(selectedCard.rawPrice) : "Pending"}
                  </p>
                </div>
                <div className="section-panel rounded-xl p-3">
                  <p className="text-xs text-slate-300">Gem Rate / Liquidity %</p>
                  <p className="text-sm font-semibold text-slate-100">
                    {investmentMetricsReady
                      ? `${formatPercent(selectedCard.gemRateBlended)} / ${formatPercent(selectedCard.liquidityScore)}`
                      : "Pending"}
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-400">
                    Liquidity percentage score estimates how easily this card can be bought or sold at market price. Higher
                    values indicate stronger demand, more frequent sales, and typically faster exits.
                  </p>
                </div>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="section-panel rounded-xl p-3">
                  <p className="text-xs text-slate-300">PSA 10 / TAG 10</p>
                  <p className="text-sm font-semibold text-slate-100">
                    {investmentMetricsReady
                      ? `${usd(selectedCard.psa10Price)} / ${usd(selectedCard.tag10Price)}`
                      : "Pending"}
                  </p>
                </div>
                <div className="section-panel rounded-xl p-3">
                  <p className="text-xs text-slate-300">Scarcity / 12-Month ROI</p>
                  <p className="text-sm font-semibold text-slate-100">
                    {investmentMetricsReady
                      ? `${selectedCard.scarcityScore.toFixed(0)} / ${formatPercent(selectedCard.roi12m)}`
                      : "Pending"}
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-400">
                    Scarcity is a 0-100 score. Higher means harder to source. It blends graded-population scarcity
                    (65%) with a rarity tier bonus (35%). Quick read: below 40 = easier supply, 40-70 = moderate,
                    above 70 = tighter supply.
                  </p>
                </div>
                <div className="section-panel rounded-xl p-3">
                  <p className="text-xs text-slate-300">Grading Arbitrage</p>
                  <p className={`text-sm font-semibold ${selectedCard.gradingArbitrageUsd >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
                    {investmentMetricsReady ? usd(selectedCard.gradingArbitrageUsd) : "Pending"}
                  </p>
                </div>
              </div>
              <section className="section-panel rounded-xl p-3">
                <h3 className="mb-2 text-sm font-semibold text-slate-200">Market Price History</h3>
                <MultiSeriesChart labels={selectedCardChartLabels} series={selectedCardChartSeries} valueMode="currency" />
              </section>
              <section className="section-panel rounded-xl p-3">
                <h3 className="mb-2 text-sm font-semibold text-slate-200">Card Alerts</h3>
                <p className="mb-3 text-xs text-slate-300">
                  Create a threshold alert for this card. Alerts trigger when the condition is met and appear in Settings {" > "} Alerts.
                </p>
                <div className="grid gap-2 md:grid-cols-4">
                  <select
                    value={cardAlertCondition}
                    onChange={(event) => setCardAlertCondition(event.target.value as AlertRuleApi["condition"])}
                    className="rounded border border-white/20 bg-slate-900/60 px-2 py-2 text-sm text-slate-100"
                  >
                    {ALERT_CONDITION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={cardAlertThreshold}
                    onChange={(event) => setCardAlertThreshold(event.target.value)}
                    placeholder={isPercentAlertCondition(cardAlertCondition) ? "Percent change" : "Price in USD"}
                    className="rounded border border-white/20 bg-slate-900/60 px-2 py-2 text-sm text-slate-100 placeholder:text-slate-400"
                  />
                  <select
                    value={cardAlertLookback}
                    onChange={(event) => setCardAlertLookback(event.target.value)}
                    disabled={!isPercentAlertCondition(cardAlertCondition)}
                    className="rounded border border-white/20 bg-slate-900/60 px-2 py-2 text-sm text-slate-100 disabled:opacity-50"
                  >
                    <option value="1">1M Lookback</option>
                    <option value="3">3M Lookback</option>
                    <option value="6">6M Lookback</option>
                    <option value="12">12M Lookback</option>
                  </select>
                  <button
                    type="button"
                    disabled={cardAlertBusy}
                    onClick={async () => {
                      const threshold = Number(cardAlertThreshold);
                      if (!Number.isFinite(threshold) || threshold <= 0) {
                        setMessage("Enter a valid card alert threshold.");
                        return;
                      }
                      try {
                        setCardAlertBusy(true);
                        await createAlertRule({
                          entityType: "CARD",
                          entityId: selectedCard.cardId,
                          entityLabel: `${selectedCard.cardName} ${selectedCard.cardNumber}`,
                          condition: cardAlertCondition,
                          thresholdValue: threshold,
                          lookbackMonths: isPercentAlertCondition(cardAlertCondition)
                            ? Number(cardAlertLookback)
                            : undefined,
                        });
                      } catch (error) {
                        setMessage(error instanceof Error ? error.message : "Could not create card alert.");
                      } finally {
                        setCardAlertBusy(false);
                      }
                    }}
                    className="rounded border border-cyan-300/40 bg-cyan-500/20 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-60"
                  >
                    {cardAlertBusy ? "Creating..." : "Create Card Alert"}
                  </button>
                </div>
              </section>
            </>
          ) : (
            <p className="text-sm text-slate-300">No matching card found.</p>
          )}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-200">Search Results</h3>
            <p className="text-xs text-slate-300">
              These are the cards that match your current search. Select one to view its analytics above.
            </p>
            <div className="max-h-80 overflow-auto rounded-xl bg-white/[0.035]">
              {matchingCards.length === 0 ? (
                <p className="p-3 text-sm text-slate-300">No cards match your search.</p>
              ) : (
                matchingCards.map((card) => (
                  <button
                    key={card.cardId}
                    onClick={() => setQuickCardId(card.cardId)}
                    className={`grid w-full grid-cols-[1.8fr_1.6fr_1fr] gap-2 border-b border-white/5 px-3 py-2 text-left text-sm text-slate-100 hover:bg-white/[0.06] ${
                      selectedCard?.cardId === card.cardId ? "bg-cyan-500/15" : ""
                    }`}
                  >
                    <span className="flex w-full items-center justify-start gap-3 text-left">
                      <ProductThumbnail
                        imageUrl={card.imageUrl}
                        alt={`${card.cardName} ${card.cardNumber}`}
                        fallback={card.cardName}
                        className="h-14 w-10 shrink-0"
                      />
                      <span>
                        {card.cardName} {card.cardNumber}
                      </span>
                    </span>
                    <span className="flex w-full items-center justify-start gap-2 text-left">
                      <ProductThumbnail
                        imageUrl={card.setLogoUrl ?? card.setSymbolUrl}
                        alt={card.setName || "Set"}
                        fallback={card.setName || "Set"}
                        className="h-8 w-8 shrink-0 rounded-md"
                      />
                      <span>{card.setName || "Unknown Set"}</span>
                    </span>
                    <span>{investmentMetricsReady ? usd(card.rawPrice) : "Pending"}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === "SEALED_PRODUCT_DETAILS" || activeTab === "SEALED_ANALYTICS") {
      return (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-100">Sealed Analytics</h2>
          <div className="section-panel-soft rounded-xl p-3">
            <p className="text-sm text-slate-200">
              This section combines detailed sealed product analytics with market-wide sealed rankings so users can analyze one product and compare it against the broader sealed market in one place.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Search for a sealed product to inspect its history and metrics, then use the rankings below to compare returns, liquidity, and volatility.
            </p>
          </div>
          {selectedSealedProduct ? (
            <>
              <section className="section-panel rounded-xl p-3">
                <h3 className="mb-3 text-sm font-semibold text-slate-200">Selected Product Analytics</h3>
              <div className="flex flex-col gap-3 rounded-2xl bg-white/[0.03] p-3 md:flex-row md:items-start">
                <ProductThumbnail
                  imageUrl={selectedSealedProduct.imageUrl}
                  alt={selectedSealedProduct.productName}
                  fallback={selectedSealedProduct.productName}
                  className="h-36 w-28 shrink-0"
                />
                <div className="flex-1 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="section-panel rounded-xl p-3">
                    <p className="text-xs text-slate-300">Product</p>
                    <p className="text-sm font-semibold text-slate-100">{selectedSealedProduct.productName}</p>
                  </div>
                  <div className="section-panel rounded-xl p-3">
                    <p className="text-xs text-slate-300">Set</p>
                    <p className="text-sm font-semibold text-slate-100">
                      {selectedSealedProduct.setName ?? selectedSealedProduct.setCode.toUpperCase()}
                    </p>
                  </div>
                  <div className="section-panel rounded-xl p-3">
                    <p className="text-xs text-slate-300">Product Type</p>
                    <p className="text-sm font-semibold text-slate-100">
                      {formatSealedProductType(selectedSealedProduct.productType)}
                    </p>
                  </div>
                  <div className="section-panel rounded-xl p-3">
                    <p className="text-xs text-slate-300">Catalog Market Value</p>
                    <p className="text-sm font-semibold text-slate-100">
                      {usd(selectedSealedProduct.marketValueUsd)}
                    </p>
                  </div>
                </div>
              </div>
              </section>

              <section className="section-panel rounded-xl p-3">
                <h3 className="mb-3 text-sm font-semibold text-slate-200">Structured Product Details</h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="section-panel rounded-xl p-3">
                    <p className="text-xs text-slate-300">Release Date</p>
                    <p className="text-sm font-semibold text-slate-100">
                      {selectedSealedProduct.releaseDate
                        ? new Date(selectedSealedProduct.releaseDate).toLocaleDateString()
                        : "-"}
                    </p>
                  </div>
                  <div className="section-panel rounded-xl p-3">
                    <p className="text-xs text-slate-300">UPC</p>
                    <p className="text-sm font-semibold text-slate-100">
                      {selectedSealedProduct.upc ?? "-"}
                    </p>
                  </div>
                  <div className="section-panel rounded-xl p-3">
                    <p className="text-xs text-slate-300">Owned Quantity</p>
                    <p className="text-sm font-semibold text-slate-100">
                      x{selectedSealedProduct.inventoryQuantity}
                    </p>
                  </div>
                  <div className="section-panel rounded-xl p-3">
                    <p className="text-xs text-slate-300">Wishlist Demand</p>
                    <p className="text-sm font-semibold text-slate-100">
                      {selectedSealedProduct.wishlistCount
                        ? `${selectedSealedProduct.wishlistCount} ${selectedSealedProduct.wishlistCount === 1 ? "entry" : "entries"}${selectedSealedProduct.wishlistPriority ? ` | P${selectedSealedProduct.wishlistPriority}` : ""}`
                        : "Not on wishlist"}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-200">{selectedSealedProduct.meta}</p>
                <p className="mt-2 text-xs text-slate-400">
                  Sealed search now resolves against the full product catalog first, then overlays your owned and wishlist positions.
                </p>
              </section>
              <section className="section-panel rounded-xl p-3">
                <h3 className="mb-3 text-sm font-semibold text-slate-200">Sealed Investment Metrics</h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="section-panel rounded-xl p-3">
                    <p className="text-xs text-slate-300">12-Month ROI</p>
                    <p className="text-sm font-semibold text-slate-100">
                      {formatPercent(selectedSealedProduct.metrics.roi12m)}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-400">
                      Return from the earliest recorded sealed sale in the current history window to the latest recorded sale.
                    </p>
                  </div>
                  <div className="section-panel rounded-xl p-3">
                    <p className="text-xs text-slate-300">Volatility</p>
                    <p className="text-sm font-semibold text-slate-100">
                      {formatPercent(selectedSealedProduct.metrics.volatility)}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-400">
                      Measures how sharply monthly sealed sale prices move. Higher values indicate wider month-to-month swings.
                    </p>
                  </div>
                  <div className="section-panel rounded-xl p-3">
                    <p className="text-xs text-slate-300">Liquidity %</p>
                    <p className="text-sm font-semibold text-slate-100">
                      {formatPercent(selectedSealedProduct.metrics.liquidityScore)}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-400">
                      Estimates how easy the product is to move based on recent sealed sale frequency. Higher means faster exits.
                    </p>
                  </div>
                  <div className="section-panel rounded-xl p-3">
                    <p className="text-xs text-slate-300">Sales (90D)</p>
                    <p className="text-sm font-semibold text-slate-100">
                      {selectedSealedProduct.metrics.salesLast90d}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-400">
                      Number of recorded sealed sale entries in the last 90 days for this product.
                    </p>
                  </div>
                  <div className="section-panel rounded-xl p-3">
                    <p className="text-xs text-slate-300">Average Sale</p>
                    <p className="text-sm font-semibold text-slate-100">
                      {usd(selectedSealedProduct.metrics.averageSalePrice)}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-400">
                      Average across all recorded sealed sale entries currently stored for this product.
                    </p>
                  </div>
                  <div className="section-panel rounded-xl p-3">
                    <p className="text-xs text-slate-300">Latest Sale</p>
                    <p className="text-sm font-semibold text-slate-100">
                      {usd(selectedSealedProduct.metrics.latestMarketPrice)}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-400">
                      Most recent recorded sealed sale price used as the current market reference.
                    </p>
                  </div>
                </div>
              </section>
              {selectedSealedChartSeries.length ? (
                <section className="section-panel rounded-xl p-3">
                  <h3 className="mb-2 text-sm font-semibold text-slate-200">Sealed Price History</h3>
                  <p className="mb-3 text-xs text-slate-400">
                    Built from recorded sealed sale entries, with your tracked collection values and wishlist targets layered on top when available.
                  </p>
                  <MultiSeriesChart
                    labels={selectedSealedChartLabels}
                    series={selectedSealedChartSeries}
                    valueMode="currency"
                  />
                </section>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-slate-300">
              Search for a sealed product, booster box, ETB, tin, or collection box to view details here.
            </p>
          )}

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-200">Matching Sealed Products</h3>
            <div className="max-h-72 overflow-auto rounded-xl bg-white/[0.035]">
              {matchingSealedProducts.length === 0 ? (
                <p className="p-3 text-sm text-slate-300">No sealed products match your search.</p>
              ) : (
                matchingSealedProducts.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setQuickSealedId(item.id)}
                    className={`grid w-full grid-cols-[2fr_1fr_1fr] gap-2 border-b border-white/5 px-3 py-2 text-left text-sm text-slate-100 hover:bg-white/[0.06] ${
                      selectedSealedProduct?.id === item.id ? "bg-cyan-500/10" : ""
                    }`}
                  >
                    <span className="flex w-full items-center justify-start gap-3 text-left">
                      <ProductThumbnail
                        imageUrl={item.imageUrl}
                        alt={item.productName}
                        fallback={item.productName}
                        className="h-14 w-10 shrink-0"
                      />
                      <span>{item.productName}</span>
                    </span>
                    <span>{item.setCode.toUpperCase()}</span>
                    <span className="text-right">{item.meta} | {item.valueLabel}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {sealedAnalyticsCards.map((card) => (
              <ExplainableMetricCard
                key={card.id}
                {...card}
                expandedId={expandedDashboardKpi}
                onToggle={setExpandedDashboardKpi}
              />
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <section className="section-panel rounded-xl p-3">
              <h3 className="mb-2 text-sm font-semibold text-slate-200">Best 12-Month Sealed Returns</h3>
              <p className="mb-3 text-xs text-slate-300">
                `12-Month ROI` measures return from the earliest recorded sealed sale in the current history window to the latest recorded sale.
              </p>
              <AnalyticsDataTable
                rows={sealedRoiLeaders}
                getRowId={(item) => item.id}
                gridClassName="grid-cols-[2fr_1fr_1fr]"
                maxHeightClassName="max-h-[24rem]"
                emptyMessage="No sealed ROI leaders are available."
                columns={[
                  {
                    key: "productName",
                    label: "Product",
                    value: (item) => `${item.productName} ${item.setName}`,
                    render: (item) => (
                      <span className="flex w-full items-center justify-start gap-3 text-left">
                        <ProductThumbnail
                          imageUrl={item.imageUrl ?? item.setLogoUrl ?? item.setSymbolUrl}
                          alt={item.productName}
                          fallback={item.productName}
                          className="h-14 w-10 shrink-0"
                        />
                        <span>{item.productName}</span>
                      </span>
                    ),
                  },
                  {
                    key: "roi12m",
                    label: "12-Month ROI",
                    value: (item) => item.metrics.roi12m,
                    render: (item) => formatPercent(item.metrics.roi12m),
                  },
                  {
                    key: "latestMarketPrice",
                    label: "Latest Sale",
                    value: (item) => item.metrics.latestMarketPrice,
                    render: (item) => usd(item.metrics.latestMarketPrice),
                  },
                ]}
              />
            </section>

            <section className="section-panel rounded-xl p-3">
              <h3 className="mb-2 text-sm font-semibold text-slate-200">Fastest-Moving Sealed Products</h3>
              <p className="mb-3 text-xs text-slate-300">
                `Liquidity %` estimates how fast a sealed product can move based on recent sale frequency and spacing.
              </p>
              <AnalyticsDataTable
                rows={sealedLiquidityLeaders}
                getRowId={(item) => item.id}
                gridClassName="grid-cols-[2fr_1fr_1fr]"
                maxHeightClassName="max-h-[24rem]"
                emptyMessage="No sealed liquidity leaders are available."
                columns={[
                  {
                    key: "productName",
                    label: "Product",
                    value: (item) => `${item.productName} ${item.setName}`,
                    render: (item) => (
                      <span className="flex w-full items-center justify-start gap-3 text-left">
                        <ProductThumbnail
                          imageUrl={item.imageUrl ?? item.setLogoUrl ?? item.setSymbolUrl}
                          alt={item.productName}
                          fallback={item.productName}
                          className="h-14 w-10 shrink-0"
                        />
                        <span>{item.productName}</span>
                      </span>
                    ),
                  },
                  {
                    key: "liquidityScore",
                    label: "Liquidity %",
                    value: (item) => item.metrics.liquidityScore,
                    render: (item) => formatPercent(item.metrics.liquidityScore),
                  },
                  {
                    key: "salesLast90d",
                    label: "Sales (90D)",
                    value: (item) => item.metrics.salesLast90d,
                  },
                ]}
              />
            </section>

            <section className="section-panel rounded-xl p-3">
              <h3 className="mb-2 text-sm font-semibold text-slate-200">Largest Sealed Price Swings</h3>
              <p className="mb-3 text-xs text-slate-300">
                `Volatility` captures how sharply monthly sealed sale prices move. Higher values indicate wider price swings.
              </p>
              <AnalyticsDataTable
                rows={sealedVolatilityLeaders}
                getRowId={(item) => item.id}
                gridClassName="grid-cols-[2fr_1fr_1fr]"
                maxHeightClassName="max-h-[24rem]"
                emptyMessage="No sealed volatility leaders are available."
                columns={[
                  {
                    key: "productName",
                    label: "Product",
                    value: (item) => `${item.productName} ${item.setName}`,
                    render: (item) => (
                      <span className="flex w-full items-center justify-start gap-3 text-left">
                        <ProductThumbnail
                          imageUrl={item.imageUrl ?? item.setLogoUrl ?? item.setSymbolUrl}
                          alt={item.productName}
                          fallback={item.productName}
                          className="h-14 w-10 shrink-0"
                        />
                        <span>{item.productName}</span>
                      </span>
                    ),
                  },
                  {
                    key: "volatility",
                    label: "Volatility",
                    value: (item) => item.metrics.volatility,
                    render: (item) => formatPercent(item.metrics.volatility),
                  },
                  {
                    key: "averageSalePrice",
                    label: "Avg Sale",
                    value: (item) => item.metrics.averageSalePrice,
                    render: (item) => usd(item.metrics.averageSalePrice),
                  },
                ]}
              />
            </section>
          </div>
        </div>
      );
    }

    if (activeTab === "SET_VALUES") {
      return (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">Set Values</h2>
          <div className="section-panel-soft rounded-xl p-3">
            <p className="text-sm text-slate-200">
              This section estimates how much a full set is worth when you add together the current average value of each tracked card in that set.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {query
                ? `Filtered by "${cardSearch}".`
                : "Use it to compare which sets currently look larger, smaller, or stronger over the last year."}
            </p>
          </div>
          {!investmentMetricsReady ? (
            <p className="rounded-xl border border-amber-300/40 bg-amber-500/10 p-2 text-xs text-amber-100">
              {dataQuality?.blockingReason ??
                "Set value estimates stay hidden until enough live pricing and population coverage have been loaded."}
            </p>
          ) : null}
          <section className="section-panel rounded-xl p-3">
            <h3 className="mb-2 text-sm font-semibold text-slate-200">How Set Values Are Moving</h3>
            <p className="mb-3 text-xs text-slate-300">
              This chart shows how tracked set values have changed over time. Larger swings usually mean faster-changing prices.
            </p>
            <MultiSeriesChart
              labels={setTrendLabels.map((date) => date.slice(0, 7))}
              series={setVolatilityChartSeries}
              valueMode="currency"
            />
          </section>
          <section className="section-panel rounded-xl p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">
                  TCGplayer Sealed Supply vs Market Value
                </h3>
                <p className="mt-1 text-xs text-slate-300">
                  This chart uses two lines: one for TCGplayer listing count and one for the selected product-type market value over the same period.
                </p>
              </div>
              <div className="grid w-full gap-2 md:min-w-[30rem] md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-[10px] capitalize tracking-wide text-slate-400">
                    Select Set
                  </span>
                  <select
                    value={selectedSealedSetHistory?.setId ?? ""}
                    onChange={(event) => setSelectedSealedSetId(event.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                  >
                    {sealedSetSelectorOptions.map((entry) => (
                      <option key={entry.setId} value={entry.setId}>
                        {entry.setName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] capitalize tracking-wide text-slate-400">
                    Product Type
                  </span>
                  <select
                    value={selectedSealedMarketType}
                    onChange={(event) => setSelectedSealedMarketType(event.target.value as SealedMarketTypeFilter)}
                    className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                  >
                    {SEALED_MARKET_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            {selectedSealedSetHistory ? (
              <div className="mt-4 space-y-3">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <div className="section-panel-deep rounded-xl p-3">
                    <p className="text-[10px] capitalize tracking-wide text-slate-400">
                      Latest TCGplayer Listings
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-50">
                      {latestSelectedSealedSetPoint?.tcgplayerListings.toLocaleString() ?? 0}
                    </p>
                    <p className="mt-1 text-xs text-slate-300">
                      Current number of tracked sealed listings for this set.
                    </p>
                  </div>
                  <div className="section-panel-deep rounded-xl p-3">
                    <p className="text-[10px] capitalize tracking-wide text-slate-400">
                      Latest {selectedSealedMarketTypeLabel} Market Value
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-50">
                      {usd(latestSelectedSealedSetMarketValue)}
                    </p>
                    <p className="mt-1 text-xs text-slate-300">
                      Current average {selectedSealedMarketTypeLabel.toLowerCase()} market value for this set.
                    </p>
                  </div>
                  <div className="section-panel-deep rounded-xl p-3 md:col-span-2 xl:col-span-1">
                    <p className="text-[10px] capitalize tracking-wide text-slate-400">
                      Why This Matters
                    </p>
                    <p className="mt-2 text-sm text-slate-200">
                      Rising prices with falling listings can signal tightening supply. Falling prices with rising listings can point to weaker demand or growing sell pressure.
                    </p>
                  </div>
                </div>
                <DualAxisLineChart
                  labels={selectedSealedSetLabels}
                  left={{
                    label: "TCGplayer Listings",
                    color: "#38bdf8",
                    values: selectedSealedSetListingValues,
                    valueFormat: "number",
                  }}
                  right={{
                    label: `${selectedSealedMarketTypeLabel} Market Value`,
                    color: "#f59e0b",
                    values: selectedSealedSetMarketValues,
                    valueFormat: "currency",
                  }}
                />
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-300">
                No sealed product history is available yet for the current set catalog.
              </p>
            )}
          </section>
          <AnalyticsDataTable
            rows={setRows}
            getRowId={(set) => set.setId}
            gridClassName="grid-cols-[2fr_1fr_1fr]"
            emptyMessage="No sets match your current search."
            columns={[
              { key: "name", label: "Set", value: (set) => set.name },
              {
                key: "totalSetValue",
                label: "Estimated Full Set Value",
                value: (set) => set.totalSetValue,
                render: (set) => (investmentMetricsReady ? usd(set.totalSetValue) : "Pending"),
              },
              {
                key: "roi12m",
                label: "1-Year Return",
                value: (set) => set.roi12m,
                render: (set) => (investmentMetricsReady ? formatPercent(set.roi12m) : "Pending"),
              },
            ]}
          />
          <section className="section-panel rounded-xl p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Historical Sealed % Trends</h3>
                <p className="mt-1 text-xs text-slate-300">
                  Select a set and timeframe to view each sealed product-type percentage trend in the subsection cards below.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-[10px] capitalize tracking-wide text-slate-400">Set</span>
                  <select
                    value={selectedSetRatioSet?.setId ?? ""}
                    onChange={(event) => setSelectedSetRatioSetId(event.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                  >
                    {setRatioSetOptions.map((set) => (
                      <option key={set.setId} value={set.setId}>
                        {set.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] capitalize tracking-wide text-slate-400">Historical Range</span>
                  <select
                    value={setRatioHistoryRange}
                    onChange={(event) => setSetRatioHistoryRange(event.target.value as ChartRangeOption)}
                    className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                  >
                    <option value="3M">Last 3 Months</option>
                    <option value="6M">Last 6 Months</option>
                    <option value="12M">Last 12 Months</option>
                    <option value="ALL">All History</option>
                  </select>
                </label>
              </div>
            </div>
          </section>
          <div className="grid gap-3 xl:grid-cols-2">
            <section className="section-panel rounded-xl p-3">
              <h3 className="mb-2 text-sm font-semibold text-slate-200">Booster Box % Of Total Set Value</h3>
              <AnalyticsDataTable
                rows={boosterBoxRatioRows}
                getRowId={(row) => row.setId}
                gridClassName="grid-cols-[2fr_1fr]"
                maxHeightClassName="max-h-[20rem]"
                emptyMessage="No booster box pricing data is available for the current set selection."
                columns={[
                  { key: "setName", label: "Set", value: (row) => row.setName },
                  {
                    key: "boosterBoxPct",
                    label: "Booster Box %",
                    value: (row) => row.boosterBoxPct ?? -1,
                    render: (row) =>
                      investmentMetricsReady
                        ? typeof row.boosterBoxPct === "number"
                          ? formatPercent(row.boosterBoxPct)
                          : "-"
                        : "Pending",
                  },
                ]}
              />
              <div className="mt-3">
                <p className="mb-2 text-xs text-slate-300">
                  Historical trend for {selectedSetRatioSet?.name ?? "the selected set"}.
                </p>
                {selectedSetRatioSet && visibleSetRatioMonths.length && hasSetValueHistory && hasBoosterBoxPctHistory ? (
                  <DualAxisLineChart
                    labels={visibleSetRatioMonths}
                    left={{
                      label: "Total Set Value",
                      color: "#38bdf8",
                      values: setValueHistorySeries,
                      valueFormat: "currency",
                    }}
                    right={{
                      label: "Booster Box %",
                      color: "#a78bfa",
                      values: boosterBoxPctSeries,
                      valueFormat: "percent",
                    }}
                    showRangeControls={false}
                  />
                ) : (
                  <p className="text-sm text-slate-300">
                    No combined booster box % and total set value history is available yet for this set and timeframe.
                  </p>
                )}
              </div>
            </section>
            <section className="section-panel rounded-xl p-3">
              <h3 className="mb-2 text-sm font-semibold text-slate-200">Booster Bundle % Of Total Set Value</h3>
              <AnalyticsDataTable
                rows={boosterBundleRatioRows}
                getRowId={(row) => row.setId}
                gridClassName="grid-cols-[2fr_1fr]"
                maxHeightClassName="max-h-[20rem]"
                emptyMessage="No booster bundle pricing data is available for the current set selection."
                columns={[
                  { key: "setName", label: "Set", value: (row) => row.setName },
                  {
                    key: "boosterBundlePct",
                    label: "Booster Bundle %",
                    value: (row) => row.boosterBundlePct ?? -1,
                    render: (row) =>
                      investmentMetricsReady
                        ? typeof row.boosterBundlePct === "number"
                          ? formatPercent(row.boosterBundlePct)
                          : "-"
                        : "Pending",
                  },
                ]}
              />
              <div className="mt-3">
                <p className="mb-2 text-xs text-slate-300">
                  Historical trend for {selectedSetRatioSet?.name ?? "the selected set"}.
                </p>
                {selectedSetRatioSet &&
                visibleSetRatioMonths.length &&
                hasSetValueHistory &&
                hasBoosterBundlePctHistory ? (
                  <DualAxisLineChart
                    labels={visibleSetRatioMonths}
                    left={{
                      label: "Total Set Value",
                      color: "#38bdf8",
                      values: setValueHistorySeries,
                      valueFormat: "currency",
                    }}
                    right={{
                      label: "Booster Bundle %",
                      color: "#f59e0b",
                      values: boosterBundlePctSeries,
                      valueFormat: "percent",
                    }}
                    showRangeControls={false}
                  />
                ) : (
                  <p className="text-sm text-slate-300">
                    No combined booster bundle % and total set value history is available yet for this set and timeframe.
                  </p>
                )}
              </div>
            </section>
            <section className="section-panel rounded-xl p-3">
              <h3 className="mb-2 text-sm font-semibold text-slate-200">ETB % Of Total Set Value</h3>
              <AnalyticsDataTable
                rows={etbRatioRows}
                getRowId={(row) => row.setId}
                gridClassName="grid-cols-[2fr_1fr]"
                maxHeightClassName="max-h-[20rem]"
                emptyMessage="No ETB pricing data is available for the current set selection."
                columns={[
                  { key: "setName", label: "Set", value: (row) => row.setName },
                  {
                    key: "etbPct",
                    label: "ETB %",
                    value: (row) => row.etbPct ?? -1,
                    render: (row) =>
                      investmentMetricsReady
                        ? typeof row.etbPct === "number"
                          ? formatPercent(row.etbPct)
                          : "-"
                        : "Pending",
                  },
                ]}
              />
              <div className="mt-3">
                <p className="mb-2 text-xs text-slate-300">
                  Historical trend for {selectedSetRatioSet?.name ?? "the selected set"}.
                </p>
                {selectedSetRatioSet && visibleSetRatioMonths.length && hasSetValueHistory && hasEtbPctHistory ? (
                  <DualAxisLineChart
                    labels={visibleSetRatioMonths}
                    left={{
                      label: "Total Set Value",
                      color: "#38bdf8",
                      values: setValueHistorySeries,
                      valueFormat: "currency",
                    }}
                    right={{
                      label: "ETB %",
                      color: "#34d399",
                      values: etbPctSeries,
                      valueFormat: "percent",
                    }}
                    showRangeControls={false}
                  />
                ) : (
                  <p className="text-sm text-slate-300">
                    No combined ETB % and total set value history is available yet for this set and timeframe.
                  </p>
                )}
              </div>
            </section>
            <section className="section-panel rounded-xl p-3">
              <h3 className="mb-2 text-sm font-semibold text-slate-200">PC ETB % Of Total Set Value</h3>
              <AnalyticsDataTable
                rows={pokemonCenterEtbRatioRows}
                getRowId={(row) => row.setId}
                gridClassName="grid-cols-[2fr_1fr]"
                maxHeightClassName="max-h-[20rem]"
                emptyMessage="No PC ETB pricing data is available for the current set selection."
                columns={[
                  { key: "setName", label: "Set", value: (row) => row.setName },
                  {
                    key: "pokemonCenterEtbPct",
                    label: "PC ETB %",
                    value: (row) => row.pokemonCenterEtbPct ?? -1,
                    render: (row) =>
                      investmentMetricsReady
                        ? typeof row.pokemonCenterEtbPct === "number"
                          ? formatPercent(row.pokemonCenterEtbPct)
                          : "-"
                        : "Pending",
                  },
                ]}
              />
              <div className="mt-3">
                <p className="mb-2 text-xs text-slate-300">
                  Historical trend for {selectedSetRatioSet?.name ?? "the selected set"}.
                </p>
                {selectedSetRatioSet &&
                visibleSetRatioMonths.length &&
                hasSetValueHistory &&
                hasPokemonCenterEtbPctHistory ? (
                  <DualAxisLineChart
                    labels={visibleSetRatioMonths}
                    left={{
                      label: "Total Set Value",
                      color: "#38bdf8",
                      values: setValueHistorySeries,
                      valueFormat: "currency",
                    }}
                    right={{
                      label: "PC ETB %",
                      color: "#f472b6",
                      values: pokemonCenterEtbPctSeries,
                      valueFormat: "percent",
                    }}
                    showRangeControls={false}
                  />
                ) : (
                  <p className="text-sm text-slate-300">
                    No combined PC ETB % and total set value history is available yet for this set and timeframe.
                  </p>
                )}
              </div>
            </section>
          </div>
        </div>
      );
    }

    if (activeTab === "CARDS_TOP_60") {
      return (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">Cards (Top 50)</h2>
          <div className="section-panel-soft rounded-xl p-3">
            <p className="text-sm text-slate-200">
              This view shows the top tracked cards with their current raw prices and their estimated chance of receiving a grade 10.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              It is meant to be a quick comparison list, not a full card-by-card breakdown.
            </p>
          </div>
          {!investmentMetricsReady ? (
            <p className="rounded-xl border border-amber-300/40 bg-amber-500/10 p-2 text-xs text-amber-100">
              Card investment metrics stay hidden until enough live pricing and population coverage have been loaded.
            </p>
          ) : null}
          <AnalyticsDataTable
            rows={cardsTopRows}
            getRowId={(card) => card.cardId}
            gridClassName="grid-cols-[2fr_1fr_1fr_1fr]"
            emptyMessage="No cards match your current search."
            columns={[
              {
                key: "cardName",
                label: "Card",
                value: (card) => `${card.cardName} ${card.cardNumber}`,
                render: (card) => (
                  <CardCell imageUrl={card.imageUrl ?? card.imageLargeUrl} name={card.cardName} number={card.cardNumber} />
                ),
              },
              { key: "setName", label: "Set", value: (card) => card.setName ?? card.setCode.toUpperCase() },
              {
                key: "rawPrice",
                label: "Current Raw Price",
                value: (card) => card.rawPrice,
                render: (card) => (investmentMetricsReady ? usd(card.rawPrice) : "Pending"),
              },
              {
                key: "gemRateBlended",
                label: "10 Grade Success Rate",
                value: (card) => card.gemRateBlended,
                render: (card) => (investmentMetricsReady ? formatPercent(card.gemRateBlended) : "Pending"),
              },
            ]}
          />
        </div>
      );
    }

    if (activeTab === "CARD_INDEX") {
      return (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-100">Card Index</h2>
          {!can("ADVANCED_ANALYTICS") ? (
            <p className="text-sm text-slate-300">Upgrade to Elite to unlock advanced analytics.</p>
          ) : (
            <>
              <div className="section-panel-soft rounded-xl p-3">
                <p className="text-sm text-slate-200">
                  The Card Index is your broad market benchmark. It helps users see how the overall tracked card market is moving, not just one card at a time.
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Click any top metric card below for a simple explanation and methodology.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {cardIndexCards.map((card) => (
                  <ExplainableMetricCard
                    key={card.id}
                    {...card}
                    expandedId={expandedDashboardKpi}
                    onToggle={setExpandedDashboardKpi}
                  />
                ))}
              </div>

              <section className="section-panel rounded-xl p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="group/title relative inline-flex max-w-full">
                    <h3 className="text-sm font-semibold text-slate-200 underline decoration-dotted underline-offset-3">
                      Card Index Trend
                    </h3>
                    <span className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-72 rounded-lg border border-white/10 bg-slate-950/95 px-3 py-2 text-[11px] normal-case text-slate-100 shadow-lg shadow-black/35 group-hover/title:block">
                      This chart tracks the overall movement of the app&apos;s card market benchmark over time. It helps users see whether the broader tracked card market is strengthening, flattening, or cooling off.
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab("CARD_DETAILS")}
                    className="rounded-lg border border-cyan-300/30 bg-cyan-500/15 px-3 py-1 text-xs font-semibold capitalize tracking-wide text-cyan-100 hover:bg-cyan-500/25"
                  >
                    Open Card Analytics
                  </button>
                </div>
                <MultiSeriesChart
                  labels={indexSeries.map((point) => point.date.slice(0, 7))}
                  series={[
                    {
                      label: "Card Index",
                      color: "#60a5fa",
                      values: indexSeries.map((point) => point.value),
                    },
                  ]}
                  valueMode="number"
                />
              </section>

              <section className="section-panel rounded-xl p-3">
                <h3 className="mb-2 text-sm font-semibold text-slate-200">Recent Benchmark History</h3>
                <p className="mb-3 text-xs text-slate-300">
                  This section shows monthly snapshots of Investige. `Period` is the year and month (`YYYY-MM`)
                  for each snapshot, and `Benchmark Score` is the calculated market benchmark value for that month.
                </p>
                {recentIndexRows.length ? (
                  <AnalyticsDataTable
                    rows={recentIndexRows}
                    getRowId={(point) => point.date}
                    gridClassName="grid-cols-[1fr_1fr]"
                    maxHeightClassName="max-h-72"
                    emptyMessage="Index history will appear after the first market series calculation."
                    columns={[
                      {
                        key: "date",
                        label: "Period",
                        value: (point) => point.date.slice(0, 7),
                      },
                      {
                        key: "value",
                        label: "Benchmark Score",
                        value: (point) => point.value,
                        render: (point) => point.value.toFixed(2),
                      },
                    ]}
                  />
                ) : (
                  <p className="text-sm text-slate-300">Index history will appear after the first market series calculation.</p>
                )}
              </section>

              <section className="section-panel rounded-xl p-3">
                <h3 className="mb-2 text-sm font-semibold text-slate-200">Top Cards Driving This Benchmark</h3>
                <AnalyticsDataTable
                  rows={indexComponents}
                  getRowId={(card) => card.cardId}
                  gridClassName="grid-cols-[2fr_1fr_1fr_1fr]"
                  maxHeightClassName="max-h-[26rem]"
                  emptyMessage="No index components are available yet."
                  columns={[
                    {
                      key: "cardName",
                      label: "Card",
                      value: (card) => `${card.cardName} ${card.cardNumber}`,
                      render: (card) => (
                        <CardCell imageUrl={card.imageUrl ?? card.imageLargeUrl} name={card.cardName} number={card.cardNumber} />
                      ),
                    },
                    {
                      key: "rawPrice",
                      label: "Raw Price",
                      value: (card) => card.rawPrice,
                      render: (card) => usd(card.rawPrice),
                    },
                    {
                    key: "weightPct",
                    label: "Benchmark Share",
                    value: (card) => card.weightPct,
                    render: (card) => formatPercent(card.weightPct),
                    },
                    {
                    key: "roi12m",
                    label: "12-Month ROI",
                    value: (card) => card.roi12m,
                    render: (card) => formatPercent(card.roi12m),
                    },
                  ]}
                />
              </section>
            </>
          )}
        </div>
      );
    }

    if (activeTab === "ARBITRAGE") {
      return (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-100">Grading Arbitrage</h2>
          {!can("ADVANCED_ANALYTICS") ? (
            <p className="text-sm text-slate-300">Upgrade to Elite to unlock advanced analytics.</p>
          ) : (
            <>
              <div className="section-panel-soft rounded-xl p-3">
                <p className="text-sm text-slate-200">
                  This section estimates which cards may gain the most value if bought raw and submitted for a top grade.
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Click any top metric card for a plain-English explanation before reviewing the ranked table.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {arbitrageCards.map((card) => (
                  <ExplainableMetricCard
                    key={card.id}
                    {...card}
                    expandedId={expandedDashboardKpi}
                    onToggle={setExpandedDashboardKpi}
                  />
                ))}
              </div>
              <AnalyticsDataTable
                rows={arbitrageRows}
                getRowId={(card) => card.cardId}
                gridClassName="grid-cols-[2fr_1fr_1fr_1fr_1fr]"
                maxHeightClassName="max-h-[34rem]"
                emptyMessage="No arbitrage candidates are available yet."
                columns={[
                  {
                    key: "cardName",
                    label: "Card",
                    value: (card) => `${card.cardName} ${card.cardNumber}`,
                    render: (card) => (
                      <CardCell imageUrl={card.imageUrl ?? card.imageLargeUrl} name={card.cardName} number={card.cardNumber} />
                    ),
                  },
                  {
                    key: "rawPrice",
                    label: "Raw Price",
                    value: (card) => card.rawPrice,
                    render: (card) => usd(card.rawPrice),
                  },
                  {
                    key: "psa10Price",
                    label: "Projected PSA 10 Value",
                    value: (card) => card.psa10Price,
                    render: (card) => usd(card.psa10Price),
                  },
                  {
                    key: "gemRateBlended",
                    label: "10 Grade Success Rate",
                    value: (card) => card.gemRateBlended,
                    render: (card) => formatPercent(card.gemRateBlended),
                  },
                  {
                    key: "gradingArbitrageUsd",
                    label: "Estimated Grading Profit",
                    value: (card) => card.gradingArbitrageUsd,
                    render: (card) => (
                      <span className={card.gradingArbitrageUsd >= 0 ? "text-emerald-300" : "text-rose-300"}>
                        {usd(card.gradingArbitrageUsd)}
                      </span>
                    ),
                  },
                ]}
              />
            </>
          )}
        </div>
      );
    }

    if (activeTab === "SIGNALS") {
      return (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-100">Signals</h2>
          {!can("ADVANCED_ANALYTICS") ? (
            <p className="text-sm text-slate-300">Upgrade to Elite to unlock advanced analytics.</p>
          ) : (
            <>
              <div className="section-panel-soft rounded-xl p-3">
                <p className="text-sm text-slate-200">
                  Signals are model-driven alerts that help users quickly spot possible buying or flipping opportunities.
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Think of this page as a shortlist of cards the app believes deserve a closer look right now.
                </p>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <section className="section-panel rounded-xl p-3">
                  <h3 className="mb-2 text-sm font-semibold text-slate-200">Potentially Undervalued Cards</h3>
                  {topUndervaluedAlerts.length ? (
                    <AnalyticsDataTable
                      rows={topUndervaluedAlerts}
                      getRowId={(item) => item.cardId}
                      gridClassName="grid-cols-[1fr_2fr]"
                      maxHeightClassName="max-h-[20rem]"
                      emptyMessage="No undervalued candidates are currently flagged."
                      expandableColumnKey="reason"
                      renderExpandedRow={(item) => <SignalDetailContent alert={item} />}
                      columns={[
                        {
                          key: "label",
                          label: "Card",
                          value: (item) => item.label,
                          render: (item) => {
                            const [name, number] = item.label.split(/ (?=[^ ]+$)/);
                            return (
                              <CardCell
                                imageUrl={item.imageUrl}
                                name={name ?? item.label}
                                number={number && number !== name ? number : undefined}
                              />
                            );
                          },
                        },
                        {
                          key: "reason",
                          label: "Why It Was Flagged",
                          value: (item) => item.reason,
                          filterable: false,
                        },
                      ]}
                    />
                  ) : (
                    <p className="text-sm text-slate-300">No undervalued candidates are currently flagged.</p>
                  )}
                </section>

                <section className="section-panel rounded-xl p-3">
                  <h3 className="mb-2 text-sm font-semibold text-slate-200">Short-Term Flip Watchlist</h3>
                  {flipperSignalAlerts.length ? (
                    <AnalyticsDataTable
                      rows={flipperSignalAlerts}
                      getRowId={(item) => item.cardId}
                      gridClassName="grid-cols-[2fr_1fr_1fr]"
                      maxHeightClassName="max-h-[20rem]"
                      emptyMessage="No flipper momentum signals are currently active."
                      expandableColumnKey="label"
                      renderExpandedRow={(item) => <SignalDetailContent alert={item} />}
                      columns={[
                        {
                          key: "label",
                          label: "Card",
                          value: (item) => item.label,
                          render: (item) => {
                            const [name, number] = item.label.split(/ (?=[^ ]+$)/);
                            return (
                              <CardCell
                                imageUrl={item.imageUrl}
                                name={name ?? item.label}
                                number={number && number !== name ? number : undefined}
                              />
                            );
                          },
                        },
                        {
                          key: "momentum4mPct",
                          label: "4-Month Momentum %",
                          value: (item) => item.momentum4mPct ?? 0,
                          render: (item) => (
                            <span className={flipperMomentumClass(item.momentum4mPct ?? 0)}>
                              {formatPercent(item.momentum4mPct ?? 0)}
                            </span>
                          ),
                        },
                        {
                          key: "liquidityScore",
                          label: "Liquidity %",
                          value: (item) => item.liquidityScore ?? 0,
                          render: (item) => (
                            <span className={flipperLiquidityClass(item.liquidityScore ?? 0)}>
                              {formatPercent(item.liquidityScore ?? 0)}
                            </span>
                          ),
                        },
                      ]}
                    />
                  ) : (
                    <p className="text-sm text-slate-300">No flipper momentum signals are currently active.</p>
                  )}
                </section>
              </div>
              <section className="section-panel rounded-xl p-3">
                <h3 className="mb-2 text-sm font-semibold text-slate-200">Signal Definitions</h3>
                <div className="grid gap-3 lg:grid-cols-3">
                  <div className="rounded-lg bg-white/[0.03] p-3 text-sm text-slate-200">
                    <p className="font-semibold text-emerald-100">Potentially Undervalued Cards</p>
                    <p className="mt-1">
                      These are cards the model believes may be priced below what their recent trend, demand, and upside suggest.
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] p-3 text-sm text-slate-200">
                    <p className="font-semibold text-amber-100">Short-Term Flip Watchlist</p>
                    <p className="mt-1">
                      These are cards the model sees as stronger short-term resale candidates based on current momentum and demand.
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <div className="rounded-lg bg-white/[0.03] p-3 text-sm text-slate-200">
                    <p className="font-semibold text-slate-100">4-Month Momentum %</p>
                    <p className="mt-1">
                      How much the raw card price has moved over the last four months. Higher positive momentum means the card is accelerating faster.
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] p-3 text-sm text-slate-200">
                    <p className="font-semibold text-slate-100">Liquidity %</p>
                    <p className="mt-1">
                      An estimate of how easily the card can be bought or sold right now, expressed as a percentage score. Higher liquidity usually means faster exits and stronger demand.
                    </p>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      );
    }

    if (
      activeTab === "PORTFOLIO_PERFORMANCE" ||
      activeTab === "PERSONAL_COLLECTION" ||
      activeTab === "QUICK_PORTFOLIO_ACTIONS"
    ) {
      return (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-100">Portfolio</h2>
          {!can("PORTFOLIO_TRACKING") ? (
            <p className="text-sm text-slate-300">Upgrade to Pro to track and analyze portfolios.</p>
          ) : (
            <>
              <div className="section-panel-soft rounded-xl p-3">
                <p className="text-sm text-slate-200">
                  Manage multiple portfolios here, view each one independently, or switch to a total combined view. Performance is summarized at the top, with the portfolio holdings listed below.
                </p>
              </div>

              <section className="section-panel rounded-xl p-3">
                <div className="grid gap-3 lg:grid-cols-[2fr]">
                  <label className="space-y-1">
                    <span className="text-xs text-slate-300">View Scope</span>
                    <select
                      className="w-full rounded border border-white/20 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                      value={selectedPortfolioView}
                      onChange={(event) => setSelectedPortfolioView(event.target.value)}
                    >
                      <option value="ALL">Total Portfolio</option>
                      {customPortfolios.map((portfolio) => (
                        <option key={portfolio.id} value={portfolio.id}>
                          {portfolio.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="mt-3 text-sm text-slate-300">
                  Currently viewing: {portfolioScopeLabel}
                </p>
              </section>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {portfolioCards.map((card) => (
                  <ExplainableMetricCard
                    key={card.id}
                    {...card}
                    expandedId={expandedDashboardKpi}
                    onToggle={setExpandedDashboardKpi}
                  />
                ))}
              </div>

              <div className="section-panel rounded-xl p-3 text-sm text-slate-200">
                Market comparison: the broad card benchmark is {benchmarkRoi >= 0 ? "up" : "down"} {formatPercent(Math.abs(benchmarkRoi))} over the current 12-month view.
              </div>

              <section className="section-panel rounded-xl p-3">
                <h3 className="mb-2 text-sm font-semibold text-slate-200">Portfolio Value Over Time</h3>
                <p className="mb-3 text-xs text-slate-300">
                  This chart reflects the current {selectedPortfolioView === "ALL" ? "cumulative" : "portfolio-specific"} view for raw cards, graded cards, and sealed items combined.
                </p>
                <MultiSeriesChart
                  labels={portfolioTrendLabels.map((date) => date.slice(0, 7))}
                  series={portfolioChartSeries}
                  valueMode="currency"
                />
              </section>

              <section className="section-panel rounded-xl p-3">
                <h3 className="mb-2 text-sm font-semibold text-slate-200">Card Holdings</h3>
                {collectionPositionRows.length ? (
                  <AnalyticsDataTable
                    rows={collectionPositionRows}
                    getRowId={(row) => row.id}
                    gridClassName="grid-cols-[1.4fr_1.2fr_1fr_0.9fr_0.9fr_0.9fr_1fr]"
                    maxHeightClassName="max-h-[28rem]"
                    emptyMessage="No card holdings are loaded for this portfolio view."
                    columns={[
                      {
                        key: "label",
                        label: "Card",
                        value: (row) => row.label,
                        render: (row) => (
                          <CardCell imageUrl={row.imageUrl} name={row.cardName} number={row.cardNumber} />
                        ),
                      },
                      { key: "setName", label: "Set", value: (row) => row.setName },
                      { key: "portfolioName", label: "Portfolio", value: (row) => row.portfolioName, filterable: selectedPortfolioView === "ALL" },
                      { key: "ownershipType", label: "Type", value: (row) => row.ownershipType },
                      {
                        key: "rawCondition",
                        label: "Condition",
                        value: (row) => row.rawCondition ?? "-",
                        render: (row) => (row.ownershipType === "RAW" ? (row.rawCondition ?? "NM") : "-"),
                      },
                      {
                        key: "quantity",
                        label: "Quantity",
                        value: (row) => row.quantity,
                        render: (row) => `x${row.quantity}`,
                      },
                      {
                        key: "marketValue",
                        label: "Market Value",
                        value: (row) => row.marketValue,
                        render: (row) => usd(row.marketValue),
                      },
                    ]}
                  />
                ) : (
                  <p className="text-sm text-slate-300">No card holdings are loaded for this portfolio view.</p>
                )}
              </section>

              <section className="section-panel rounded-xl p-3">
                <h3 className="mb-2 text-sm font-semibold text-slate-200">Sealed Holdings</h3>
                {sealedPositionRows.length ? (
                  <AnalyticsDataTable
                    rows={sealedPositionRows}
                    getRowId={(row) => row.id}
                    gridClassName="grid-cols-[1.6fr_1fr_1fr_1fr_1fr]"
                    maxHeightClassName="max-h-[28rem]"
                    emptyMessage="No sealed holdings are loaded for this portfolio view."
                    controlMode="singleFilterHeaderSort"
                    columns={[
                      {
                        key: "label",
                        label: "Set",
                        value: (row) => row.label,
                        render: (row) => <SealedCell imageUrl={row.imageUrl} name={row.label} />,
                      },
                      { key: "productType", label: "Product Type", value: (row) => row.productType },
                      { key: "portfolioName", label: "Portfolio", value: (row) => row.portfolioName, filterable: selectedPortfolioView === "ALL" },
                      {
                        key: "quantity",
                        label: "Quantity",
                        value: (row) => row.quantity,
                        render: (row) => `x${row.quantity}`,
                      },
                      {
                        key: "marketValue",
                        label: "Market Value",
                        value: (row) => row.marketValue,
                        render: (row) => usd(row.marketValue),
                      },
                    ]}
                  />
                ) : (
                  <p className="text-sm text-slate-300">No sealed holdings are loaded for this portfolio view.</p>
                )}
              </section>

              <section className="section-panel rounded-xl p-3">
                <h3 className="mb-2 text-sm font-semibold text-slate-200">Create New Portfolio</h3>
                <div className="grid gap-3 lg:grid-cols-[2fr_auto]">
                  <label className="space-y-1">
                    <span className="text-xs text-slate-300">Portfolio Name</span>
                    <input
                      className="w-full rounded border border-white/20 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/60"
                      value={newPortfolioName}
                      onChange={(event) => setNewPortfolioName(event.target.value)}
                      placeholder="Long-Term Holds"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={createPortfolio}
                    className="self-end rounded border border-cyan-300/40 bg-cyan-500/20 px-3 py-2 text-sm text-cyan-100"
                  >
                    Add Portfolio
                  </button>
                </div>
              </section>

              {quickPortfolioActionsPanel}
            </>
          )}
        </div>
      );
    }

    if (activeTab === "WISHLIST") {
      return (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">Wishlist</h2>
          {!can("PORTFOLIO_TRACKING") ? (
            <p className="text-sm text-slate-300">Upgrade to Pro to track wishlist items.</p>
          ) : (
            <div className="space-y-4">
              <section className="section-panel rounded-xl p-3">
                <h3 className="mb-2 text-sm font-semibold text-slate-200">Card Wishlist</h3>
                <AnalyticsDataTable
                  rows={wishlist}
                  getRowId={(item) => item.id}
                  gridClassName="grid-cols-[1.8fr_1.5fr_1fr_1fr]"
                  maxHeightClassName="max-h-[20rem]"
                  emptyMessage="No card wishlist items yet."
                  columns={[
                    {
                      key: "card",
                      label: "Item",
                      value: (item) =>
                        item.card
                          ? `${item.card.name} ${item.card.cardNumber}`
                          : "Unknown card",
                      render: (item) => (
                        <span className="flex w-full items-center justify-start gap-3 text-left">
                          <ProductThumbnail
                            imageUrl={item.card?.imageUrl ?? item.card?.imageLargeUrl}
                            alt={item.card ? `${item.card.name} ${item.card.cardNumber}` : "Wishlist item"}
                            fallback={item.card?.name ?? "Card"}
                            className="h-14 w-10 shrink-0"
                          />
                          <span>
                            {item.card?.name} {item.card?.cardNumber}
                          </span>
                        </span>
                      ),
                    },
                    {
                      key: "setName",
                      label: "Set",
                      value: (item) => item.card?.setName ?? item.card?.setCode?.toUpperCase() ?? "Unknown Set",
                    },
                    {
                      key: "priority",
                      label: "Priority",
                      value: (item) => item.priority,
                      render: (item) => `P${item.priority}`,
                    },
                    {
                      key: "targetPriceUsd",
                      label: "Target Price",
                      value: (item) => item.targetPriceUsd ?? 0,
                      render: (item) => usd(item.targetPriceUsd),
                    },
                  ]}
                />
              </section>

              <section className="section-panel rounded-xl p-3">
                <h3 className="mb-2 text-sm font-semibold text-slate-200">Sealed Wishlist</h3>
                <AnalyticsDataTable
                  rows={sealedWishlist}
                  getRowId={(item) => item.id}
                  gridClassName="grid-cols-[2fr_1fr_1fr_auto]"
                  maxHeightClassName="max-h-[20rem]"
                  emptyMessage="No sealed wishlist items yet."
                  expandableColumnKey="actions"
                  renderExpandedRow={(item) => (
                    <SealedWishlistEditor
                      item={item}
                      onSave={(changes) => saveSealedWishlistItem(item.id, changes)}
                      onRemove={() => removeSealedWishlistItem(item.id)}
                    />
                  )}
                  columns={[
                    {
                      key: "productName",
                      label: "Product",
                      value: (item) => `${item.productName} ${item.setCode} ${item.setName ?? ""}`,
                      render: (item) => (
                        <span className="flex w-full items-center justify-start gap-3 text-left">
                          <ProductThumbnail
                            imageUrl={item.imageUrl ?? item.setLogoUrl ?? item.setSymbolUrl}
                            alt={item.productName}
                            fallback={item.productName}
                            className="h-14 w-10 shrink-0"
                          />
                          <span>
                            {item.productName} ({item.setCode.toUpperCase()})
                          </span>
                        </span>
                      ),
                    },
                    {
                      key: "priority",
                      label: "Priority",
                      value: (item) => item.priority,
                      render: (item) => `P${item.priority}`,
                    },
                    {
                      key: "targetPriceUsd",
                      label: "Target Price",
                      value: (item) => item.targetPriceUsd ?? item.marketValueUsd ?? 0,
                      render: (item) => usd(item.targetPriceUsd ?? item.marketValueUsd),
                    },
                    {
                      key: "actions",
                      label: "Actions",
                      value: () => "",
                      sortable: false,
                      filterable: false,
                      render: () => (
                        <span className="inline-flex rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-semibold capitalize tracking-wide text-slate-200">
                          Manage
                        </span>
                      ),
                    },
                  ]}
                />
              </section>
            </div>
          )}
        </div>
      );
    }

    if (activeTab === "SEALED_INVENTORY") {
      return (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">Sealed Collection</h2>
          {!can("PORTFOLIO_TRACKING") ? (
            <p className="text-sm text-slate-300">Upgrade to Pro to track sealed inventory.</p>
          ) : (
            <AnalyticsDataTable
              rows={sealed}
              getRowId={(item) => item.id}
              gridClassName="grid-cols-[2fr_1fr_1fr_auto]"
              emptyMessage="No sealed inventory yet."
              expandableColumnKey="actions"
              renderExpandedRow={(item) => (
                <SealedCollectionEditor
                  item={item}
                  onSave={(changes) => saveSealedCollectionItem(item.id, changes)}
                  onRemove={() => removeSealedCollectionItem(item.id)}
                />
              )}
              columns={[
                {
                  key: "productName",
                  label: "Product",
                  value: (item) => `${item.productName} ${item.setCode} ${item.setName ?? ""}`,
                  render: (item) => (
                    <span className="flex w-full items-center justify-start gap-3 text-left">
                      <ProductThumbnail
                        imageUrl={item.imageUrl ?? item.setLogoUrl ?? item.setSymbolUrl}
                        alt={item.productName}
                        fallback={item.productName}
                        className="h-14 w-10 shrink-0"
                      />
                      <span>
                        {item.productName} ({item.setCode.toUpperCase()})
                      </span>
                    </span>
                  ),
                },
                {
                  key: "quantity",
                  label: "Quantity",
                  value: (item) => item.quantity,
                  render: (item) => `x${item.quantity}`,
                },
                {
                  key: "estimatedValueUsd",
                  label: "Est. Value",
                  value: (item) => item.estimatedValueUsd ?? item.marketValueUsd ?? 0,
                  render: (item) => usd(item.estimatedValueUsd ?? item.marketValueUsd),
                },
                {
                  key: "actions",
                  label: "Actions",
                  value: () => "",
                  sortable: false,
                  filterable: false,
                  render: () => (
                    <span className="inline-flex rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-semibold capitalize tracking-wide text-slate-200">
                      Manage
                    </span>
                  ),
                },
              ]}
            />
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-100">Settings</h2>
        <div className="section-panel rounded-xl p-3 text-sm text-slate-200">
          Cards: {dashboard?.totalTrackedCards ?? 0} | Sets: {dashboard?.totalSets ?? 0} | Sales:{" "}
          {sync?.totals.sales.toLocaleString() ?? 0}
        </div>
        <section className="section-panel rounded-xl p-3">
          <p className="text-sm font-semibold text-slate-100">Settings Sections</p>
          <div className="mt-3 grid gap-2 md:grid-cols-4">
            {[
              { id: "ACCOUNT" as const, label: "Account" },
              { id: "HEADER_BACKGROUND" as const, label: "Header Background" },
              { id: "BILLING_INFORMATION" as const, label: "Billing Information" },
              { id: "ALERTS" as const, label: "Alerts" },
            ].map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setSettingsSubsection(section.id)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  settingsSubsection === section.id
                    ? "border-cyan-300/40 bg-cyan-500/10 text-cyan-100"
                    : "border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.05]"
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>
        </section>

        {settingsSubsection === "ACCOUNT" ? (
          <section className="section-panel rounded-xl p-3">
            <h3 className="font-semibold">Account</h3>
            <p className="mt-1 text-sm text-slate-300">
              Update your profile details, email address, and password for this account.
            </p>
            <form
              className="mt-3 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void saveAccountSettings();
              }}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="rounded border border-white/20 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400"
                  value={accountFirstName}
                  onChange={(event) => setAccountFirstName(event.target.value)}
                  placeholder="First Name"
                  autoComplete="given-name"
                  name="accountFirstName"
                />
                <input
                  className="rounded border border-white/20 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400"
                  value={accountLastName}
                  onChange={(event) => setAccountLastName(event.target.value)}
                  placeholder="Last Name"
                  autoComplete="family-name"
                  name="accountLastName"
                />
              </div>
              <input
                className="w-full rounded border border-white/20 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400"
                value={accountEmail}
                onChange={(event) => setAccountEmail(event.target.value)}
                placeholder="Email Address"
                autoComplete="email"
                name="accountEmail"
                type="email"
              />
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="rounded border border-white/20 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400"
                  value={accountCurrentPassword}
                  onChange={(event) => setAccountCurrentPassword(event.target.value)}
                  placeholder="Current Password"
                  autoComplete="current-password"
                  name="accountCurrentPassword"
                  type="password"
                />
                <input
                  className="rounded border border-white/20 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400"
                  value={accountNewPassword}
                  onChange={(event) => setAccountNewPassword(event.target.value)}
                  placeholder="New Password"
                  autoComplete="new-password"
                  name="accountNewPassword"
                  type="password"
                />
              </div>
              <p className="text-xs text-slate-400">
                Leave the password fields blank if you only want to update your name or email address.
              </p>
              <button
                className="rounded border border-cyan-300/40 bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-60"
                type="submit"
                disabled={accountBusy}
              >
                {accountBusy ? "Saving..." : "Save Account Changes"}
              </button>
            </form>
          </section>
        ) : null}

        {settingsSubsection === "HEADER_BACKGROUND" ? (
          <section className="section-panel rounded-xl p-3">
            <h3 className="font-semibold">Header Background</h3>
            <p className="mt-1 text-sm text-slate-300">
              Choose the banner image that appears behind the title, logo, and search bar in the signed-in header.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Recommended banner size for new options: 1600 x 500. Keep the center area visually cleaner so the title and search bar stay readable.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {HEADER_BACKGROUND_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setHeaderBackgroundId(option.id)}
                  className={`rounded-xl border p-2 text-left transition ${
                    headerBackgroundId === option.id
                      ? "border-cyan-300/40 bg-cyan-500/10"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                  }`}
                >
                  <div
                    className={`h-24 rounded-lg ${
                      option.id === "DEFAULT"
                        ? "bg-[linear-gradient(160deg,#182f61_0%,#0f2551_45%,#0b1f45_100%)]"
                        : "bg-slate-950"
                    }`}
                  >
                    {option.imageUrl ? (
                      <div
                        className="h-full w-full rounded-lg bg-cover bg-top bg-no-repeat"
                        style={{ backgroundImage: `url(${option.imageUrl})`, backgroundPosition: "center top" }}
                      />
                    ) : (
                      <div className="h-full w-full rounded-lg bg-[radial-gradient(circle_at_16%_22%,rgba(214,96,198,0.24),transparent_24%),radial-gradient(circle_at_80%_18%,rgba(52,178,255,0.28),transparent_28%)]" />
                    )}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-100">{option.label}</p>
                  <p className="mt-1 text-xs text-slate-400">{option.description}</p>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {settingsSubsection === "BILLING_INFORMATION" ? (
          <section className="section-panel rounded-xl p-3">
            <h3 className="font-semibold">Billing Information</h3>
            <p className="mt-1 text-sm text-slate-300">
              Add, modify, or cancel your subscription plan. Current plan {sync?.subscription.tier ?? user.subscriptionTier} (
              {sync?.subscription.status ?? user.subscriptionStatus}).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="rounded border border-white/25 bg-white/5 px-3 py-1 text-sm text-slate-100 hover:bg-white/10"
                onClick={() => changePlan("FREE")}
                disabled={planBusy}
              >
                Start Free
              </button>
              <button
                className="rounded border border-cyan-300/40 bg-cyan-500/20 px-3 py-1 text-sm text-cyan-100 hover:bg-cyan-500/30"
                onClick={() => changePlan("PRO")}
                disabled={planBusy}
              >
                Switch To Pro
              </button>
              <button
                className="rounded border border-indigo-300/40 bg-indigo-500/20 px-3 py-1 text-sm text-indigo-100 hover:bg-indigo-500/30"
                onClick={() => changePlan("ELITE")}
                disabled={planBusy}
              >
                Switch To Elite
              </button>
              <button
                className="rounded border border-rose-300/40 bg-rose-500/20 px-3 py-1 text-sm text-rose-100 hover:bg-rose-500/30"
                onClick={() => changePlan("FREE")}
                disabled={planBusy}
              >
                Cancel Subscription
              </button>
              <button
                className="rounded border border-emerald-300/40 bg-emerald-500/20 px-3 py-1 text-sm text-emerald-100 hover:bg-emerald-500/30"
                onClick={openBillingPortal}
              >
                Open Billing Portal
              </button>
            </div>
          </section>
        ) : null}

        <section className="section-panel rounded-xl p-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">Background Sync + Queue</h3>
            <input className="w-24 rounded border border-white/20 bg-slate-900/60 px-2 py-1 text-sm text-slate-100 outline-none focus:border-cyan-300/60" type="number" value={syncPageLimit} onChange={(e) => setSyncPageLimit(Number(e.target.value))} />
            {user.role === "ADMIN" && can("LIVE_SYNC_QUEUE") ? (
              <>
                <button className="rounded bg-emerald-700 px-3 py-1 text-sm text-white" onClick={() => runSync("catalog")} data-testid="queue-catalog">Queue Catalog</button>
                <button className="rounded bg-emerald-500 px-3 py-1 text-sm text-slate-950" onClick={() => runSync("catalog", true)}>Run Catalog Sync Now</button>
                <button className="rounded bg-cyan-700 px-3 py-1 text-sm text-white" onClick={() => runSync("sales")} data-testid="queue-sales">Queue Sales</button>
                {can("DIRECT_TCGPLAYER_SYNC") ? <button className="rounded bg-indigo-700 px-3 py-1 text-sm text-white" onClick={queueDirectTcgplayerSync}>Queue TCGplayer Direct</button> : null}
                <button className="rounded bg-slate-900 px-3 py-1 text-sm text-white" onClick={runWorkerNow} data-testid="run-worker-tick">Run Worker Tick</button>
              </>
            ) : <p className="text-xs text-slate-300">Upgrade to Pro to run live sync jobs.</p>}
          </div>
          <p className="mt-2 text-sm text-slate-300">
            Jobs: {sync?.jobs.configured ?? 0} configured | {sync?.jobs.queued ?? 0} queued | {sync?.jobs.running ?? 0} running
          </p>
          {manualCatalogResult ? (
            <div className="mt-3 rounded-xl bg-emerald-500/10 p-3 text-sm text-slate-100">
              <p className="font-semibold">Last Manual Catalog Run</p>
              <p className="mt-1 text-xs text-slate-200">
                Task {manualCatalogResult.id} | Status: {manualCatalogResult.status}
              </p>
              {manualCatalogResult.result ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {Object.entries(manualCatalogResult.result).map(([key, value]) => (
                    <div key={key} className="rounded-lg bg-white/[0.05] px-2 py-1">
                      <p className="text-[11px] capitalize tracking-wide text-slate-300">{key}</p>
                      <p className="text-base font-semibold text-slate-100">{value}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              {manualCatalogResult.error ? (
                <p className="mt-2 text-xs text-rose-200">{manualCatalogResult.error}</p>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="section-panel rounded-xl p-3">
          <h3 className="font-semibold">Live Ingestion Status</h3>
          <p className="mt-1 text-sm text-slate-300">
            Source mode: {dataQuality?.label ?? "Unknown"} | Live sets/cards: {dataQuality?.counts.sets.live ?? 0}/{dataQuality?.counts.cards.live ?? 0}
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Live sales/pop reports: {dataQuality?.counts.sales.live ?? 0}/{dataQuality?.counts.populationReports.live ?? 0}
          </p>
          {dataQuality?.blockingReason ? (
            <p className="mt-2 rounded-xl bg-amber-500/10 p-2 text-xs text-amber-100">
              {dataQuality.blockingReason}
            </p>
          ) : null}
          {sync?.sync.lastError ? (
            <p className="mt-2 rounded-xl bg-rose-500/10 p-2 text-xs text-rose-100">
              Last sync error: {sync.sync.lastError}
            </p>
          ) : (
            <p className="mt-2 text-xs text-slate-400">No recent sync errors reported.</p>
          )}
          <div className="mt-3 rounded-xl bg-white/[0.04] p-3">
            <p className="text-sm font-semibold text-slate-100">External Sealed Feed</p>
            <p className="mt-1 text-sm text-slate-300">
              Status: {sync?.sealedFeed?.configured ? "Configured" : "Not configured"} | Mode: {sync?.sealedFeed?.mode ?? "NONE"}
            </p>
            <p className="mt-1 text-sm text-slate-300">
              Source: {sync?.sealedFeed?.target ?? "No feed path or URL set"}
            </p>
            <p className="mt-1 text-sm text-slate-300">
              Last sealed sales imported: {sync?.sealedFeed?.lastImportedCount ?? 0}
              {sync?.sealedFeed?.lastRunIncludedFeed ? " on the last sales sync" : " (last sales sync did not include an external sealed feed)"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Last sales sync: {sync?.sealedFeed?.lastSalesSyncAt ? new Date(sync.sealedFeed.lastSalesSyncAt).toLocaleString() : "No sales sync recorded yet"}
            </p>
          </div>
        </section>

        {user.role === "ADMIN" ? (
          <section className="section-panel rounded-xl p-3">
            <h3 className="font-semibold">Sealed Sales Admin</h3>
            <p className="mt-1 text-sm text-slate-300">
              View, import, edit, and remove sealed sale records that power the sealed product charts and metrics.
            </p>
            <div className="mt-3 grid gap-2 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
              <select
                className="rounded border border-white/20 bg-slate-900/60 px-2 py-2 text-sm text-slate-100"
                value={sealedSaleProductId}
                onChange={(event) => setSealedSaleProductId(event.target.value)}
              >
                {sealedProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.productName} ({product.setCode.toUpperCase()})
                  </option>
                ))}
              </select>
              <input
                className="rounded border border-white/20 bg-slate-900/60 px-2 py-2 text-sm text-slate-100"
                type="number"
                min={0}
                step="0.01"
                value={sealedSalePrice}
                onChange={(event) => setSealedSalePrice(event.target.value)}
                placeholder="Price"
              />
              <input
                className="rounded border border-white/20 bg-slate-900/60 px-2 py-2 text-sm text-slate-100"
                type="date"
                value={sealedSaleDate}
                onChange={(event) => setSealedSaleDate(event.target.value)}
              />
              <input
                className="rounded border border-white/20 bg-slate-900/60 px-2 py-2 text-sm text-slate-100"
                value={sealedSaleProviderRef}
                onChange={(event) => setSealedSaleProviderRef(event.target.value)}
                placeholder="Provider Ref"
              />
              <button
                className="rounded border border-cyan-300/40 bg-cyan-500/20 px-3 py-2 text-sm text-cyan-100"
                onClick={addSealedSale}
              >
                Add Sale
              </button>
            </div>
            <div className="mt-2">
              <input
                className="w-full rounded border border-white/20 bg-slate-900/60 px-2 py-2 text-sm text-slate-100"
                value={sealedSaleSource}
                onChange={(event) => setSealedSaleSource(event.target.value)}
                placeholder="Source label"
              />
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-[2fr_auto_auto]">
              <input
                className="rounded border border-white/20 bg-slate-900/60 px-2 py-2 text-sm text-slate-100 file:mr-3 file:rounded file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-sm file:text-slate-100"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => setSealedSalesCsvFile(event.target.files?.[0] ?? null)}
              />
              <button
                className="rounded border border-white/25 bg-white/5 px-3 py-2 text-sm text-slate-100 hover:bg-white/10"
                onClick={exportSealedSalesCsv}
              >
                Export CSV
              </button>
              <button
                className="rounded border border-emerald-300/40 bg-emerald-500/20 px-3 py-2 text-sm text-emerald-100"
                onClick={importSealedSalesCsv}
              >
                Import CSV
              </button>
            </div>
            <div className="mt-4">
              <AnalyticsDataTable
                rows={adminSealedSales}
                getRowId={(item) => item.id}
                gridClassName="grid-cols-[2fr_1fr_1fr_1fr_auto]"
                maxHeightClassName="max-h-[24rem]"
                emptyMessage="No sealed sale records are loaded."
                expandableColumnKey="actions"
                renderExpandedRow={(item) => (
                  <SealedSaleEditor
                    item={item}
                    onSave={(changes) => updateSealedSale(item.id, changes)}
                    onRemove={() => deleteSealedSale(item.id)}
                  />
                )}
                columns={[
                  {
                    key: "productName",
                    label: "Product",
                    value: (item) => `${item.productName} ${item.setCode} ${item.setName}`,
                    render: (item) => (
                      <span className="flex w-full items-center justify-start gap-3 text-left">
                        <ProductThumbnail
                          imageUrl={item.imageUrl}
                          alt={item.productName}
                          fallback={item.productName}
                          className="h-14 w-10 shrink-0"
                        />
                        <span>
                          {item.productName} ({item.setCode.toUpperCase()})
                        </span>
                      </span>
                    ),
                  },
                  {
                    key: "priceUsd",
                    label: "Price",
                    value: (item) => item.priceUsd,
                    render: (item) => usd(item.priceUsd),
                  },
                  {
                    key: "saleDate",
                    label: "Sale Date",
                    value: (item) => item.saleDate,
                    render: (item) => new Date(item.saleDate).toLocaleDateString(),
                  },
                  {
                    key: "source",
                    label: "Source",
                    value: (item) => item.source ?? "",
                    render: (item) => item.source ?? "-",
                  },
                  {
                    key: "actions",
                    label: "Actions",
                    value: () => "",
                    sortable: false,
                    filterable: false,
                    render: () => (
                      <span className="inline-flex rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-semibold capitalize tracking-wide text-slate-200">
                        Manage
                      </span>
                    ),
                  },
                ]}
              />
            </div>
          </section>
        ) : null}

        <section className="section-panel rounded-xl p-3">
          <h3 className="mb-2 font-semibold">Scanner</h3>
          {!can("CARD_SCANNER_TEXT") ? (
            <p className="mb-2 text-sm text-slate-300">Upgrade to Pro to use card scanner.</p>
          ) : null}
          <div className="mb-3 flex flex-wrap gap-2">
            <select
              className="rounded border border-white/20 bg-slate-900/60 px-2 py-2 text-slate-100"
              value={scanDest}
              onChange={(e) => setScanDest(e.target.value as "COLLECTION" | "WISHLIST" | "PRICE_CHECK")}
              disabled={!can("CARD_SCANNER_TEXT")}
            >
              <option value="COLLECTION">Collection</option>
              <option value="WISHLIST">Wishlist</option>
              <option value="PRICE_CHECK">Price Check</option>
            </select>
            <input
              className="rounded border border-white/20 bg-slate-900/60 px-2 py-2 text-sm text-slate-100"
              type="file"
              accept="image/*"
              onChange={(event) => setScanImageFile(event.target.files?.[0] ?? null)}
            />
            <button
              className="rounded bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-60"
              type="button"
              onClick={runImageScan}
              disabled={ocrBusy || !can("CARD_SCANNER_TEXT")}
            >
              {ocrBusy ? "Scanning..." : "Scan Photo"}
            </button>
          </div>
          <form className="flex flex-wrap gap-2 border-t border-white/10 pt-3" onSubmit={scanCard}>
            <input
              className="min-w-72 flex-1 rounded border border-white/20 bg-slate-900/60 px-3 py-2 text-slate-100 placeholder:text-slate-400"
              value={scanText}
              onChange={(e) => setScanText(e.target.value)}
              placeholder="Manual fallback: swsh7 215 Umbreon VMAX"
              required
              disabled={!can("CARD_SCANNER_TEXT")}
            />
            <button className="rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-60" type="submit" disabled={!can("CARD_SCANNER_TEXT")}>
              Scan Text
            </button>
          </form>
          {scanResult ? (
            <div className="mt-3 section-panel rounded-xl p-3 text-sm">
              <p className="font-medium">
                Result: {scanResult.itemKind.replaceAll("_", " ")} | OCR confidence {(scanResult.ocr?.confidence ?? 0).toFixed(1)}
              </p>
              {scanResult.actionPreview ? (
                <p className="mt-1 text-xs text-slate-300">
                  Photo scans now review the match first. Choose the exact item, then send it to collection, wishlist, or price details.
                </p>
              ) : null}
              {scanResult.barcode?.value ? (
                <p className="mt-2 text-xs text-slate-300">
                  Barcode: {scanResult.barcode.value} ({scanResult.barcode.format ?? "Unknown format"})
                </p>
              ) : null}
              {scanResult.match?.card ? (
                <p className="mt-2">
                  Card: {scanResult.match.card.name} {scanResult.match.card.cardNumber} ({scanResult.match.card.setCode?.toUpperCase()})
                </p>
              ) : null}
              {scanResult.sealedCandidates?.length ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold capitalize tracking-[0.16em] text-fuchsia-200">
                    Sealed Match Candidates
                  </p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {scanResult.sealedCandidates.map((candidate) => (
                      <button
                        key={candidate.productId}
                        type="button"
                        onClick={() => setScanSelectedSealedId(candidate.productId)}
                        className={`grid grid-cols-[auto_1fr] items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                          scannerPrimaryProductId === candidate.productId
                            ? "border-fuchsia-300/40 bg-fuchsia-500/10 text-slate-100"
                            : "border-white/10 bg-black/20 text-slate-200 hover:bg-white/[0.04]"
                        }`}
                      >
                        <ProductThumbnail
                          imageUrl={candidate.imageUrl}
                          alt={candidate.productName ?? "Sealed candidate"}
                          fallback={candidate.productName ?? "Sealed"}
                          className="h-16 w-12 shrink-0"
                        />
                        <span>
                          <span className="block font-medium">{candidate.productName}</span>
                          <span className="block text-xs text-slate-400">
                            {candidate.setName ?? candidate.setCode?.toUpperCase() ?? "Unknown Set"} |{" "}
                            {formatSealedProductType(candidate.productType)}
                          </span>
                          <span className="block text-xs text-slate-400">
                            {(candidate.viaBarcode ? "UPC match" : "Label match") +
                              ` • ${(candidate.confidence ?? 0).toFixed(2)} confidence`}
                          </span>
                          <span className="block text-xs text-slate-500">{candidate.reason}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {scanResult.sealed?.productName ? (
                <div className="mt-2">
                  <p>
                    Sealed: {scanResult.sealed.productName} ({scanResult.sealed.setCode?.toUpperCase() ?? scanResult.sealed.setName ?? "Unknown Set"}) |{" "}
                    {formatSealedProductType(scanResult.sealed.productType)} |{" "}
                    {usd(scanResult.sealed.marketValueUsd)}
                  </p>
                  {selectedScanSealedCandidate?.upc ? (
                    <p className="text-xs text-slate-400">UPC: {selectedScanSealedCandidate.upc}</p>
                  ) : scanResult.sealed.upc ? (
                    <p className="text-xs text-slate-400">UPC: {scanResult.sealed.upc}</p>
                  ) : null}
                </div>
              ) : null}
              {scanResult.actionPreview && scanResult.itemKind === "SEALED_PRODUCT" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded border border-fuchsia-300/35 bg-fuchsia-500/15 px-3 py-2 text-xs font-semibold capitalize tracking-wide text-fuchsia-100 disabled:opacity-60"
                    onClick={() => applyScannerSealedAction("PRICE_CHECK")}
                    disabled={scannerActionBusy || !scannerPrimaryProductId}
                  >
                    Open Price Details
                  </button>
                  <button
                    type="button"
                    className="rounded border border-cyan-300/35 bg-cyan-500/15 px-3 py-2 text-xs font-semibold capitalize tracking-wide text-cyan-100 disabled:opacity-60"
                    onClick={() => applyScannerSealedAction("COLLECTION")}
                    disabled={scannerActionBusy || !scannerPrimaryProductId}
                  >
                    Add To Sealed Collection
                  </button>
                  <button
                    type="button"
                    className="rounded border border-amber-300/35 bg-amber-500/15 px-3 py-2 text-xs font-semibold capitalize tracking-wide text-amber-100 disabled:opacity-60"
                    onClick={() => applyScannerSealedAction("WISHLIST")}
                    disabled={scannerActionBusy || !scannerPrimaryProductId}
                  >
                    Add To Wishlist
                  </button>
                </div>
              ) : null}
              {scanResult.actionPreview &&
              (scanResult.itemKind === "RAW_CARD" || scanResult.itemKind === "GRADED_SLAB") &&
              scanResult.match?.card ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded border border-cyan-300/35 bg-cyan-500/15 px-3 py-2 text-xs font-semibold capitalize tracking-wide text-cyan-100 disabled:opacity-60"
                    onClick={() => applyScannerCardAction("PRICE_CHECK")}
                    disabled={scannerActionBusy}
                  >
                    Open Card Analytics
                  </button>
                  <button
                    type="button"
                    className="rounded border border-emerald-300/35 bg-emerald-500/15 px-3 py-2 text-xs font-semibold capitalize tracking-wide text-emerald-100 disabled:opacity-60"
                    onClick={() => applyScannerCardAction("COLLECTION")}
                    disabled={scannerActionBusy}
                  >
                    Add To Collection
                  </button>
                  <button
                    type="button"
                    className="rounded border border-amber-300/35 bg-amber-500/15 px-3 py-2 text-xs font-semibold capitalize tracking-wide text-amber-100 disabled:opacity-60"
                    onClick={() => applyScannerCardAction("WISHLIST")}
                    disabled={scannerActionBusy}
                  >
                    Add To Wishlist
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        {user.role === "ADMIN" ? (
          <section className="section-panel rounded-xl p-3">
            <h3 className="mb-2 font-semibold">Email Outbox (Dev)</h3>
            <div className="max-h-56 overflow-auto text-xs">
              {outbox.length === 0 ? (
                <p className="text-slate-300">No recent messages.</p>
              ) : (
                outbox.map((mail) => (
                  <div key={mail.id} className="border-b border-white/5 py-2">
                    <p>
                      {mail.template} to {mail.to} at {new Date(mail.createdAt).toLocaleString()}
                    </p>
                    <p className="whitespace-pre-wrap text-slate-300">{mail.body}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        ) : null}
      </div>
    );
  };

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-4 p-4 sm:p-8">
      <section className="relative z-40 min-h-[13rem] overflow-visible rounded-3xl p-4 shadow-xl shadow-black/30 backdrop-blur-md sm:min-h-[14.5rem]">
        <div className="absolute inset-0 overflow-hidden rounded-3xl" aria-hidden>
          <div
            className={`absolute inset-0 ${
              activeHeaderBackground.id === "DEFAULT"
                ? "bg-[linear-gradient(160deg,#182f61_0%,#0f2551_45%,#0b1f45_100%)]"
                : "bg-slate-950"
            }`}
          />
          {activeHeaderBackground.imageUrl ? (
            <div
              className="absolute inset-0 bg-cover bg-top bg-no-repeat opacity-55"
              style={{
                backgroundImage: `url(${activeHeaderBackground.imageUrl})`,
                backgroundPosition: "center top",
              }}
            />
          ) : null}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_22%,rgba(214,96,198,0.14),transparent_22%),radial-gradient(circle_at_80%_18%,rgba(52,178,255,0.16),transparent_24%),linear-gradient(180deg,rgba(2,6,23,0.58),rgba(2,6,23,0.34))]" />
        </div>
        <div className="relative z-10">
        <div className="flex justify-end">
          <button className="rounded border border-white/25 bg-white/5 px-3 py-1.5 text-sm text-slate-100 hover:bg-white/10" onClick={logout}>
            Logout
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <div className="relative flex flex-col items-center gap-3 text-center sm:min-h-[5.5rem]">
            <div className="flex flex-col items-center justify-center gap-0 sm:absolute sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2">
              <Image
                src="/gemindex-logo-v5.png"
                alt="Investige app icon"
                width={420}
                height={420}
                priority
                className="h-28 w-28 object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.35)] sm:h-32 sm:w-32"
              />
            </div>
            <div className="flex flex-col gap-1 text-center text-sm text-slate-300 sm:ml-auto sm:items-end sm:text-right">
              <p>
                {user.name} ({user.role}) | {sync?.subscription.tier ?? user.subscriptionTier} plan
              </p>
              <p className="text-xs" data-testid="plan-badge">
                Status: {sync?.subscription.status ?? user.subscriptionStatus}
              </p>
              <p className="text-xs">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 font-medium ${sourceBadgeClass}`}
                  data-testid="data-source-badge"
                >
                  Data Source: {dataQuality?.label ?? "Seeded"}
                </span>
              </p>
            </div>
          </div>
            <div className="relative z-[60] mx-auto mt-6 w-full max-w-[24rem] sm:mt-8">
              <input
                id="global-search"
              value={cardSearch}
              onChange={(event) => applyGlobalSearch(event.target.value)}
              onFocus={() => {
                if (normalizeSearchText(cardSearch)) {
                  setSearchDropdownOpen(true);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setSearchDropdownOpen(false);
                  setSearchDropdownIndex(0);
                  return;
                }

                if (!searchDropdownOptions.length) {
                  return;
                }

                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setSearchDropdownOpen(true);
                  setSearchDropdownIndex((current) =>
                    showSearchDropdown ? (current + 1) % searchDropdownOptions.length : 0,
                  );
                  return;
                }

                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setSearchDropdownOpen(true);
                  setSearchDropdownIndex(
                    (current) =>
                      showSearchDropdown
                        ? (current - 1 + searchDropdownOptions.length) % searchDropdownOptions.length
                        : searchDropdownOptions.length - 1,
                  );
                  return;
                }

                if (event.key === "Enter" && showSearchDropdown) {
                  event.preventDefault();
                  const selected = searchDropdownOptions[effectiveSearchDropdownIndex];
                  if (!selected) {
                    return;
                  }
                  if (selected.kind === "CARD") {
                    selectSearchCard(selected.card);
                    return;
                  }
                  selectSearchSealed(selected.item);
                }
              }}
              placeholder="Search for raw, graded, or sealed product.."
              className="w-full rounded-xl border border-white/20 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 shadow-black/20 outline-none placeholder:text-slate-400 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
            />
            {showSearchDropdown ? (
              <div className="absolute left-0 right-0 top-full z-[80] mt-2 rounded-2xl border border-black/70 bg-[#020617] p-3 shadow-2xl shadow-black/80 ring-1 ring-slate-800/80">
                <div className="grid gap-3 md:grid-cols-2">
                  <section className="space-y-2 rounded-xl bg-[#030712] p-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold capitalize tracking-[0.18em] text-cyan-200">Cards</p>
                      <span className="text-[11px] text-slate-400">{dropdownCardMatches.length}</span>
                    </div>
                    <div className="space-y-1">
                      {dropdownCardMatches.length ? (
                        dropdownCardMatches.map((card, index) => (
                          <button
                            key={card.cardId}
                            type="button"
                            onClick={() => selectSearchCard(card)}
                            onMouseEnter={() => setSearchDropdownIndex(index)}
                            className={`grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl px-2 py-2 text-left text-sm text-slate-100 hover:bg-black/30 ${
                              effectiveSearchDropdownIndex === index ? "bg-cyan-500/10" : "bg-black/10"
                            }`}
                          >
                            <ProductThumbnail
                              imageUrl={card.imageUrl}
                              alt={`${card.cardName} ${card.cardNumber}`}
                              fallback={card.cardName}
                              className="h-14 w-10 shrink-0"
                            />
                            <span>
                              <span className="block font-medium">
                                {card.cardName} {card.cardNumber}
                              </span>
                              <span className="block text-xs text-slate-400">{card.setCode.toUpperCase()}</span>
                            </span>
                            <span className="text-xs text-slate-300">{investmentMetricsReady ? usd(card.rawPrice) : "Pending"}</span>
                          </button>
                        ))
                      ) : (
                        <p className="rounded-xl bg-black/20 px-3 py-2 text-xs text-slate-400">No card matches found.</p>
                      )}
                    </div>
                  </section>
                  <section className="space-y-2 rounded-xl bg-[#030712] p-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold capitalize tracking-[0.18em] text-fuchsia-200">Sealed Products</p>
                      <span className="text-[11px] text-slate-400">{dropdownSealedMatches.length}</span>
                    </div>
                    <div className="space-y-1">
                      {dropdownSealedMatches.length ? (
                        dropdownSealedMatches.map((item, index) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => selectSearchSealed(item)}
                            onMouseEnter={() => setSearchDropdownIndex(dropdownCardMatches.length + index)}
                            className={`grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl px-2 py-2 text-left text-sm text-slate-100 hover:bg-black/30 ${
                              effectiveSearchDropdownIndex === dropdownCardMatches.length + index ? "bg-fuchsia-500/10" : "bg-black/10"
                            }`}
                          >
                            <ProductThumbnail
                              imageUrl={item.imageUrl}
                              alt={item.productName}
                              fallback={item.productName}
                              className="h-14 w-10 shrink-0"
                            />
                            <span>
                              <span className="block font-medium">{item.productName}</span>
                              <span className="block text-xs text-slate-400">
                                {item.setName ?? item.setCode.toUpperCase()} | {item.meta}
                              </span>
                            </span>
                            <span className="text-xs text-slate-300">{item.valueLabel}</span>
                          </button>
                        ))
                      ) : (
                        <p className="rounded-xl bg-black/20 px-3 py-2 text-xs text-slate-400">No sealed matches found.</p>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            ) : null}
          </div>
          {message ? <p className="text-sm text-slate-200">{message}</p> : null}
        </div>
        </div>
      </section>

      <section className="relative z-10 space-y-4">
        <aside className="relative z-40 overflow-visible rounded-2xl bg-slate-950/18 p-3 backdrop-blur-sm">
          <nav className="relative z-40 flex flex-wrap items-center justify-center gap-2 overflow-visible">
            <div className="group relative">
              <div
                className={`rounded-lg px-4 py-2 text-center text-sm font-medium ${
                  ANALYTICS_HOME_TABS.some((tab) => tab.id === activeTab)
                    ? "bg-cyan-500/18 text-cyan-50"
                    : "bg-white/[0.03] text-slate-200"
                }`}
              >
                Analytics
              </div>
              <div className="pointer-events-none absolute left-1/2 top-full z-50 hidden min-w-64 -translate-x-1/2 flex-col gap-2 rounded-2xl border border-white/10 bg-slate-950/95 p-2 pt-4 shadow-2xl shadow-black/60 group-hover:pointer-events-auto group-hover:flex">
                {ANALYTICS_HOME_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-lg px-3 py-2 text-left text-sm font-medium ${
                      activeTab === tab.id
                        ? "bg-cyan-500/18 text-cyan-50"
                        : "bg-white/[0.03] text-slate-200 hover:bg-white/[0.07]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="group relative">
              <div
                className={`rounded-lg px-4 py-2 text-center text-sm font-medium ${
                  MARKET_RESEARCH_HOME_TABS.some((tab) => tab.id === activeTab)
                    ? "bg-cyan-500/18 text-cyan-50"
                    : "bg-white/[0.03] text-slate-200"
                }`}
              >
                Market Research
              </div>
              <div className="pointer-events-none absolute left-1/2 top-full z-50 hidden min-w-64 -translate-x-1/2 flex-col gap-2 rounded-2xl border border-white/10 bg-slate-950/95 p-2 pt-4 shadow-2xl shadow-black/60 group-hover:pointer-events-auto group-hover:flex">
                {MARKET_RESEARCH_HOME_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-lg px-3 py-2 text-left text-sm font-medium ${
                      activeTab === tab.id
                        ? "bg-cyan-500/18 text-cyan-50"
                        : "bg-white/[0.03] text-slate-200 hover:bg-white/[0.07]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="group relative">
              <div
                className={`rounded-lg px-4 py-2 text-center text-sm font-medium ${
                  (activeTab === "PERSONAL_COLLECTION" ||
                    PORTFOLIO_HOME_TABS.some((tab) => tab.id === activeTab))
                    ? "bg-cyan-500/18 text-cyan-50"
                    : "bg-white/[0.03] text-slate-200"
                }`}
              >
                Portfolio
              </div>
              <div className="pointer-events-none absolute left-1/2 top-full z-50 hidden min-w-64 -translate-x-1/2 flex-col gap-2 rounded-2xl border border-white/10 bg-slate-950/95 p-2 pt-4 shadow-2xl shadow-black/60 group-hover:pointer-events-auto group-hover:flex">
                {PORTFOLIO_HOME_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-lg px-3 py-2 text-left text-sm font-medium ${
                      activeTab === tab.id
                        ? "bg-cyan-500/18 text-cyan-50"
                        : "bg-white/[0.03] text-slate-200 hover:bg-white/[0.07]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="group relative">
              <div
                className={`rounded-lg px-4 py-2 text-center text-sm font-medium ${
                  activeTab === "SETTINGS"
                    ? "bg-cyan-500/18 text-cyan-50"
                    : "bg-white/[0.03] text-slate-200"
                }`}
              >
                Settings
              </div>
              <div className="pointer-events-none absolute left-1/2 top-full z-50 hidden min-w-64 -translate-x-1/2 flex-col gap-2 rounded-2xl border border-white/10 bg-slate-950/95 p-2 pt-4 shadow-2xl shadow-black/60 group-hover:pointer-events-auto group-hover:flex">
                {SETTINGS_HOME_TABS.map((tab) => (
                  <button
                    key={tab.subsection}
                    onClick={() => openSettingsSubsection(tab.subsection)}
                    className={`rounded-lg px-3 py-2 text-left text-sm font-medium ${
                      activeTab === "SETTINGS" && settingsSubsection === tab.subsection
                        ? "bg-cyan-500/18 text-cyan-50"
                        : "bg-white/[0.03] text-slate-200 hover:bg-white/[0.07]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            {PRIMARY_HOME_TABS.filter((tab) => tab.id !== "PERSONAL_COLLECTION" && tab.id !== "SETTINGS").map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-4 py-2 text-center text-sm font-medium ${
                  activeTab === tab.id
                    ? "bg-cyan-500/18 text-cyan-50"
                    : "bg-white/[0.03] text-slate-200 hover:bg-white/[0.07]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="relative z-0 rounded-2xl bg-slate-950/18 p-4 backdrop-blur-sm">{renderActiveTab()}</div>
      </section>
    </main>
  );
}




