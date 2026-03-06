import type {
  CardRecord,
  CollectionItemRecord,
  GemIndexDatabase,
  PortfolioRecord,
  SealedSaleRecord,
  SealedProductRecord,
  SealedInventoryRecord,
  SealedWishlistItemRecord,
  WishlistItemRecord,
} from "./types";

export interface CardWithSet extends CardRecord {
  setCode: string;
  setName: string;
}

export interface SealedProductWithSet extends SealedProductRecord {
  setCode: string;
  setName: string;
  setLogoUrl?: string;
  setSymbolUrl?: string;
}

export interface EnrichedSealedInventoryItem extends SealedInventoryRecord {
  portfolioName: string;
  product: SealedProductWithSet | null;
  setCode: string;
  setName: string;
  setLogoUrl?: string;
  setSymbolUrl?: string;
  imageUrl?: string;
  releaseDate?: string;
  upc?: string;
  marketValueUsd?: number;
}

export interface EnrichedSealedWishlistItem extends SealedWishlistItemRecord {
  product: SealedProductWithSet | null;
  setCode: string;
  setName: string;
  setLogoUrl?: string;
  setSymbolUrl?: string;
  imageUrl?: string;
  releaseDate?: string;
  upc?: string;
  marketValueUsd?: number;
}

export interface SealedSaleWithProduct extends SealedSaleRecord {
  product: SealedProductWithSet | null;
  productName: string;
  productType: SealedProductRecord["productType"] | "OTHER";
  setCode: string;
  setName: string;
  imageUrl?: string;
}

export function cardWithSet(db: GemIndexDatabase, cardId: string): CardWithSet | null {
  const card = db.cards.find((entry) => entry.id === cardId);
  if (!card) {
    return null;
  }

  const set = db.sets.find((entry) => entry.id === card.setId);
  if (!set) {
    return null;
  }

  return {
    ...card,
    setCode: set.code,
    setName: set.name,
  };
}

export function sealedProductWithSet(
  db: GemIndexDatabase,
  productId: string,
): SealedProductWithSet | null {
  const product = db.sealedProducts.find((entry) => entry.id === productId);
  if (!product) {
    return null;
  }

  const set = db.sets.find((entry) => entry.id === product.setId);
  return {
    ...product,
    setCode: set?.code ?? "unknown",
    setName: set?.name ?? "Unknown Set",
    setLogoUrl: set?.logoUrl,
    setSymbolUrl: set?.symbolUrl,
  };
}

export function listSealedProducts(db: GemIndexDatabase): SealedProductWithSet[] {
  return db.sealedProducts
    .map((product) => sealedProductWithSet(db, product.id))
    .filter((product): product is SealedProductWithSet => Boolean(product))
    .sort((left, right) =>
      left.setName.localeCompare(right.setName, undefined, { sensitivity: "base" }) ||
      left.productName.localeCompare(right.productName, undefined, { sensitivity: "base" }),
    );
}

function resolveSealedProduct(
  db: GemIndexDatabase,
  item: Pick<SealedInventoryRecord | SealedWishlistItemRecord, "productId" | "setId" | "productName" | "productType">,
): SealedProductWithSet | null {
  if (item.productId) {
    return sealedProductWithSet(db, item.productId);
  }

  const fallback = db.sealedProducts.find(
    (entry) =>
      entry.setId === item.setId &&
      entry.productType === item.productType &&
      entry.productName.toLowerCase() === item.productName.toLowerCase(),
  );
  if (!fallback) {
    return null;
  }

  return sealedProductWithSet(db, fallback.id);
}

export function enrichCollection(
  db: GemIndexDatabase,
  userId: string,
): Array<CollectionItemRecord & { portfolioName: string; card: CardWithSet | null }> {
  return db.collectionItems
    .filter((item) => item.userId === userId)
    .map((item) => ({
      ...item,
      portfolioName:
        db.portfolios.find((portfolio) => portfolio.id === item.portfolioId)?.name ?? "Main Portfolio",
      card: cardWithSet(db, item.cardId),
    }));
}

export function enrichWishlist(db: GemIndexDatabase, userId: string): Array<WishlistItemRecord & { card: CardWithSet | null }> {
  return db.wishlistItems
    .filter((item) => item.userId === userId)
    .map((item) => ({
      ...item,
      card: cardWithSet(db, item.cardId),
    }));
}

export function enrichSealed(
  db: GemIndexDatabase,
  userId: string,
): EnrichedSealedInventoryItem[] {
  return db.sealedInventoryItems
    .filter((item) => item.userId === userId)
    .map((item) => {
      const product = resolveSealedProduct(db, item);
      const set = db.sets.find((entry) => entry.id === (product?.setId ?? item.setId));
      return {
        ...item,
        portfolioName:
          db.portfolios.find((portfolio) => portfolio.id === item.portfolioId)?.name ?? "Main Portfolio",
        productId: product?.id ?? item.productId,
        setId: product?.setId ?? item.setId,
        productName: product?.productName ?? item.productName,
        productType: product?.productType ?? item.productType,
        product,
        setCode: product?.setCode ?? set?.code ?? "unknown",
        setName: product?.setName ?? set?.name ?? "Unknown Set",
        imageUrl: product?.imageUrl ?? set?.logoUrl ?? set?.symbolUrl,
        releaseDate: product?.releaseDate,
        upc: product?.upc,
        marketValueUsd: product?.marketValueUsd,
        setLogoUrl: set?.logoUrl,
        setSymbolUrl: set?.symbolUrl,
      };
    });
}

export function listPortfolios(db: GemIndexDatabase, userId: string): PortfolioRecord[] {
  return db.portfolios
    .filter((portfolio) => portfolio.userId === userId)
    .slice()
    .sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt) ||
      left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
    );
}

export function enrichSealedWishlist(
  db: GemIndexDatabase,
  userId: string,
): EnrichedSealedWishlistItem[] {
  return db.sealedWishlistItems
    .filter((item) => item.userId === userId)
    .map((item) => {
      const product = resolveSealedProduct(db, item);
      const set = db.sets.find((entry) => entry.id === (product?.setId ?? item.setId));
      return {
        ...item,
        productId: product?.id ?? item.productId,
        setId: product?.setId ?? item.setId,
        productName: product?.productName ?? item.productName,
        productType: product?.productType ?? item.productType,
        product,
        setCode: product?.setCode ?? set?.code ?? "unknown",
        setName: product?.setName ?? set?.name ?? "Unknown Set",
        imageUrl: product?.imageUrl ?? set?.logoUrl ?? set?.symbolUrl,
        releaseDate: product?.releaseDate,
        upc: product?.upc,
        marketValueUsd: product?.marketValueUsd,
        setLogoUrl: set?.logoUrl,
        setSymbolUrl: set?.symbolUrl,
      };
    });
}

export function listSealedSales(
  db: GemIndexDatabase,
  limit = 250,
): SealedSaleWithProduct[] {
  return db.sealedSales
    .slice()
    .sort((left, right) => new Date(right.saleDate).getTime() - new Date(left.saleDate).getTime())
    .slice(0, limit)
    .map((sale) => {
      const product = sealedProductWithSet(db, sale.productId);
      return {
        ...sale,
        product,
        productName: product?.productName ?? "Unknown Product",
        productType: product?.productType ?? "OTHER",
        setCode: product?.setCode ?? "unknown",
        setName: product?.setName ?? "Unknown Set",
        imageUrl: product?.imageUrl ?? product?.setLogoUrl ?? product?.setSymbolUrl,
      };
    });
}
