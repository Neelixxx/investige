export type Grader = "PSA" | "TAG";
export type CardCondition = "RAW" | "PSA10" | "TAG10";
export type OwnershipType = "RAW" | "GRADED";
export type RawCardCondition = "NM" | "LP" | "HP" | "DMG";
export type ScanDestination = "COLLECTION" | "WISHLIST" | "PRICE_CHECK";
export type UserRole = "ADMIN" | "USER";
export type SubscriptionTier = "FREE" | "PRO" | "ELITE";
export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";

export type SyncJobType = "CATALOG_SYNC" | "SALES_SYNC" | "TCGPLAYER_DIRECT_SYNC";
export type SyncTaskStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
export type OutboxStatus = "PENDING" | "SENT" | "FAILED";
export type AlertEntityType = "CARD" | "SEALED_PRODUCT" | "SET";
export type AlertConditionType =
  | "PRICE_BELOW"
  | "PRICE_ABOVE"
  | "PCT_CHANGE_UP"
  | "PCT_CHANGE_DOWN";
export type SealedProductType =
  | "BOOSTER_BOX"
  | "ELITE_TRAINER_BOX"
  | "COLLECTION_BOX"
  | "TIN"
  | "BLISTER"
  | "OTHER";

export interface PokemonSetRecord {
  id: string;
  code: string;
  name: string;
  releaseDate: string;
  series?: string;
  printedTotal?: number;
  total?: number;
  symbolUrl?: string;
  logoUrl?: string;
  source?: "SEED" | "POKEMONTCG";
  externalId?: string;
  lastSyncedAt?: string;
}

export interface CardRecord {
  id: string;
  setId: string;
  name: string;
  cardNumber: string;
  rarity: string;
  imageUrl?: string;
  imageLargeUrl?: string;
  supertype?: string;
  subtypes?: string[];
  source?: "SEED" | "POKEMONTCG";
  externalId?: string;
  tcgplayerUrl?: string;
  cardmarketUrl?: string;
  tcgplayerProductId?: number;
  tcgplayerGroupId?: number;
  tcgplayerMatchConfidence?: number;
  tcgplayerMatchMethod?: "AUTO" | "MANUAL";
  tcgplayerMatchedAt?: string;
  lastSyncedAt?: string;
}

export interface PopulationReportRecord {
  id: string;
  cardId: string;
  grader: Grader;
  totalGraded: number;
  grade10: number;
  asOfDate: string;
  source?: "SEED" | "MANUAL" | "PSA" | "TAG";
}

export interface SaleRecord {
  id: string;
  cardId: string;
  condition: CardCondition;
  priceUsd: number;
  saleDate: string;
  source?: string;
  provider?: "SEED" | "POKEMONTCG_TCGPLAYER" | "POKEMONTCG_CARDMARKET" | "TCGPLAYER_DIRECT";
  providerRef?: string;
  currency?: string;
}

export interface UserRecord {
  id: string;
  name: string;
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  subscriptionTier?: SubscriptionTier;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionCurrentPeriodEnd?: string;
  trialEndsAt?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  emailVerified: boolean;
  emailVerifiedAt?: string;
  totpEnabled?: boolean;
  totpSecret?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailVerificationTokenRecord {
  id: string;
  userId: string;
  email: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
  consumedAt?: string;
}

export interface PasswordResetTokenRecord {
  id: string;
  userId: string;
  email: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
  consumedAt?: string;
}

export interface EmailOutboxRecord {
  id: string;
  userId?: string;
  to: string;
  subject: string;
  template: "VERIFY_EMAIL" | "PASSWORD_RESET" | "USERNAME_RECOVERY";
  body: string;
  status: OutboxStatus;
  createdAt: string;
  sentAt?: string;
  error?: string;
}

export interface SyncJobRecord {
  id: string;
  type: SyncJobType;
  name: string;
  enabled: boolean;
  intervalMinutes: number;
  nextRunAt: string;
  running: boolean;
  options?: {
    pageLimit?: number;
    cardLimit?: number;
  };
  lastRunAt?: string;
  lastSuccessAt?: string;
  lastStatus?: "SUCCESS" | "FAILED";
  lastError?: string;
}

export interface SyncTaskRecord {
  id: string;
  type: SyncJobType;
  status: SyncTaskStatus;
  requestedBy?: string;
  options?: {
    pageLimit?: number;
    cardLimit?: number;
  };
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  result?: Record<string, number>;
  resultSummary?: string;
  error?: string;
}

export interface PortfolioRecord {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionItemRecord {
  id: string;
  userId: string;
  portfolioId?: string;
  cardId: string;
  ownershipType: OwnershipType;
  rawCondition?: RawCardCondition;
  grader?: Grader;
  grade?: number;
  certificationNumber?: string;
  quantity: number;
  acquiredAt?: string;
  acquisitionPriceUsd?: number;
  notes?: string;
}

export interface WishlistItemRecord {
  id: string;
  userId: string;
  cardId: string;
  targetPriceUsd?: number;
  priority: number;
  createdAt: string;
}

export interface SealedInventoryRecord {
  id: string;
  userId: string;
  portfolioId?: string;
  productId?: string;
  setId: string;
  productName: string;
  productType: SealedProductType;
  grader?: Grader;
  grade?: number;
  certificationNumber?: string;
  quantity: number;
  acquisitionPriceUsd?: number;
  estimatedValueUsd?: number;
  acquiredAt?: string;
  notes?: string;
}

export interface SealedWishlistItemRecord {
  id: string;
  userId: string;
  productId?: string;
  setId: string;
  productName: string;
  productType: SealedProductType;
  targetPriceUsd?: number;
  priority: number;
  createdAt: string;
  notes?: string;
}

export interface SealedProductRecord {
  id: string;
  setId: string;
  productName: string;
  productType: SealedProductType;
  imageUrl?: string;
  releaseDate?: string;
  upc?: string;
  marketValueUsd?: number;
  source?: "SEED" | "MANUAL" | "SCANNER";
  externalId?: string;
}

export interface SealedSaleRecord {
  id: string;
  productId: string;
  priceUsd: number;
  saleDate: string;
  source?: string;
  provider?: "SEED" | "MANUAL" | "INGESTED";
  providerRef?: string;
  currency?: string;
}

export interface SealedSetMarketSnapshotRecord {
  id: string;
  setId: string;
  snapshotDate: string;
  tcgplayerListings: number;
  marketValueUsd: number;
  source?: "SEED" | "TCGPLAYER";
}

export interface ScanEventRecord {
  id: string;
  userId: string;
  cardId?: string;
  destination: ScanDestination;
  scannedText: string;
  createdAt: string;
}

export interface AlertRuleRecord {
  id: string;
  userId: string;
  entityType: AlertEntityType;
  entityId: string;
  entityLabel: string;
  condition: AlertConditionType;
  thresholdValue: number;
  lookbackMonths?: number;
  enabled: boolean;
  lastConditionMet?: boolean;
  lastEvaluatedValue?: number;
  lastTriggeredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AlertEventRecord {
  id: string;
  userId: string;
  ruleId: string;
  entityType: AlertEntityType;
  entityId: string;
  entityLabel: string;
  condition: AlertConditionType;
  thresholdValue: number;
  currentValue: number;
  baselineValue?: number;
  percentChange?: number;
  message: string;
  triggeredAt: string;
  readAt?: string;
}

export interface SyncState {
  lastCatalogSyncAt?: string;
  lastSalesSyncAt?: string;
  lastCatalogProvider?: string;
  lastSalesProviders?: string[];
  lastSealedSalesUpserted?: number;
  lastError?: string;
  lastWorkerRunAt?: string;
  schedulerStartedAt?: string;
}

export interface GemIndexDatabase {
  version: number;
  sets: PokemonSetRecord[];
  cards: CardRecord[];
  populationReports: PopulationReportRecord[];
  sales: SaleRecord[];
  users: UserRecord[];
  emailVerificationTokens: EmailVerificationTokenRecord[];
  passwordResetTokens: PasswordResetTokenRecord[];
  emailOutbox: EmailOutboxRecord[];
  syncJobs: SyncJobRecord[];
  syncTasks: SyncTaskRecord[];
  portfolios: PortfolioRecord[];
  collectionItems: CollectionItemRecord[];
  wishlistItems: WishlistItemRecord[];
  sealedProducts: SealedProductRecord[];
  sealedSales: SealedSaleRecord[];
  sealedSetMarketSnapshots: SealedSetMarketSnapshotRecord[];
  sealedInventoryItems: SealedInventoryRecord[];
  sealedWishlistItems: SealedWishlistItemRecord[];
  scanEvents: ScanEventRecord[];
  alertRules: AlertRuleRecord[];
  alertEvents: AlertEventRecord[];
  sync: SyncState;
}

export interface CardMetrics {
  cardId: string;
  setId: string;
  setName: string;
  cardLabel: string;
  rarity: string;
  rawPrice: number;
  psa10Price: number;
  tag10Price: number;
  gemRatePsa: number;
  gemRateTag: number;
  gemRateBlended: number;
  liquidityScore: number;
  scarcityScore: number;
  roi12m: number;
  gradingArbitrageUsd: number;
}

export interface SetMetrics {
  setId: string;
  code: string;
  name: string;
  imageUrl?: string;
  releaseDate: string;
  cardCount: number;
  totalSetValue: number;
  roi12m: number;
  volatility: number;
}

export interface IndexPoint {
  date: string;
  value: number;
}

export interface MarketSeriesPoint {
  date: string;
  raw?: number;
  psa10?: number;
  tag10?: number;
}

export interface SealedMarketSeriesPoint {
  date: string;
  market?: number;
  tracked?: number;
  target?: number;
}

export interface DashboardAlert {
  cardId: string;
  label: string;
  setName?: string;
  imageUrl?: string;
  score: number;
  reason: string;
  momentum4mPct?: number;
  liquidityScore?: number;
  details?: Array<{
    label: string;
    value: string;
  }>;
}

export type DataSourceStatus = "SEEDED" | "PARTIAL_LIVE" | "LIVE_READY";

export interface SourceCount {
  total: number;
  seeded: number;
  live: number;
  livePct: number;
}

export interface DataQualitySnapshot {
  status: DataSourceStatus;
  label: string;
  investmentMetricsReady: boolean;
  blockingReason?: string;
  counts: {
    sets: SourceCount;
    cards: SourceCount;
    sales: SourceCount;
    populationReports: SourceCount;
    totalCards: number;
    liveSalesCards: number;
    livePopulationCards: number;
    liveSalesCardCoveragePct: number;
    livePopulationCardCoveragePct: number;
  };
  thresholds: {
    minLiveSets: number;
    minLiveCards: number;
    minLiveSales: number;
    minLiveSalesCardCoveragePct: number;
    minLivePopulationReports: number;
    minLivePopulationCardCoveragePct: number;
  };
  evaluatedAt: string;
}

export interface DashboardData {
  generatedAt: string;
  totalTrackedCards: number;
  totalSets: number;
  cardIndex: IndexPoint[];
  topUndervalued: DashboardAlert[];
  flipperSignals: DashboardAlert[];
  topArbitrage: DashboardAlert[];
  dataQuality: DataQualitySnapshot;
  sync?: SyncState;
}

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: UserRole;
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus;
  subscriptionCurrentPeriodEnd?: string;
  trialEndsAt?: string;
  emailVerified: boolean;
  totpEnabled?: boolean;
}
