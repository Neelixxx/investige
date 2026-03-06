import type { GemIndexDatabase, SealedProductRecord, SealedProductType } from "./types";

function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function encodeSvg(value: string): string {
  return value
    .replace(/%/g, "%25")
    .replace(/#/g, "%23")
    .replace(/</g, "%3C")
    .replace(/>/g, "%3E")
    .replace(/"/g, "%22")
    .replace(/\s+/g, " ");
}

export function createSealedProductId(
  setId: string,
  productType: SealedProductType,
  productName: string,
): string {
  return `sealed_product_${normalizeLabel(`${setId}-${productType}-${productName}`)}`;
}

export function createSealedProductImageDataUrl(
  productName: string,
  setCode: string,
  productType: SealedProductType,
): string {
  const typeLabel = productType
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
  const topLine = productName.length > 22 ? `${productName.slice(0, 22)}...` : productName;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="420" height="600" viewBox="0 0 420 600">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1d4ed8"/>
          <stop offset="45%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
        <linearGradient id="foil" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#67e8f9"/>
          <stop offset="50%" stop-color="#c084fc"/>
          <stop offset="100%" stop-color="#fcd34d"/>
        </linearGradient>
      </defs>
      <rect width="420" height="600" rx="36" fill="url(#bg)"/>
      <rect x="24" y="24" width="372" height="552" rx="28" fill="rgba(15,23,42,0.45)" stroke="rgba(255,255,255,0.12)"/>
      <rect x="48" y="68" width="324" height="220" rx="22" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)"/>
      <rect x="70" y="96" width="280" height="164" rx="18" fill="url(#foil)" opacity="0.9"/>
      <text x="210" y="142" text-anchor="middle" fill="#082f49" font-size="22" font-family="Verdana, Arial, sans-serif" font-weight="700">${setCode.toUpperCase()}</text>
      <text x="210" y="178" text-anchor="middle" fill="#082f49" font-size="34" font-family="Verdana, Arial, sans-serif" font-weight="700">Investige</text>
      <text x="210" y="214" text-anchor="middle" fill="#0f172a" font-size="20" font-family="Verdana, Arial, sans-serif" font-weight="700">${typeLabel}</text>
      <text x="48" y="352" fill="#e2e8f0" font-size="18" font-family="Verdana, Arial, sans-serif" font-weight="700">${topLine}</text>
      <text x="48" y="388" fill="#94a3b8" font-size="14" font-family="Verdana, Arial, sans-serif">${setCode.toUpperCase()} sealed catalog item</text>
      <rect x="48" y="430" width="324" height="96" rx="16" fill="rgba(255,255,255,0.05)"/>
      <text x="70" y="468" fill="#f8fafc" font-size="16" font-family="Verdana, Arial, sans-serif" font-weight="700">Pokemon TCG</text>
      <text x="70" y="496" fill="#cbd5e1" font-size="14" font-family="Verdana, Arial, sans-serif">Tracked product record</text>
      <text x="70" y="520" fill="#cbd5e1" font-size="14" font-family="Verdana, Arial, sans-serif">Image-ready sealed catalog entry</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeSvg(svg)}`;
}

export function ensureSealedProductRecord(
  db: GemIndexDatabase,
  input: {
    setId: string;
    productName: string;
    productType: SealedProductType;
    imageUrl?: string;
    releaseDate?: string;
    upc?: string;
    marketValueUsd?: number;
    source?: SealedProductRecord["source"];
    externalId?: string;
  },
): SealedProductRecord {
  const existingByName = db.sealedProducts.find(
    (item) =>
      item.setId === input.setId &&
      item.productType === input.productType &&
      item.productName.toLowerCase() === input.productName.toLowerCase(),
  );
  if (existingByName) {
    existingByName.imageUrl = input.imageUrl ?? existingByName.imageUrl;
    existingByName.releaseDate = input.releaseDate ?? existingByName.releaseDate;
    existingByName.upc = input.upc ?? existingByName.upc;
    existingByName.marketValueUsd = input.marketValueUsd ?? existingByName.marketValueUsd;
    existingByName.source = input.source ?? existingByName.source;
    existingByName.externalId = input.externalId ?? existingByName.externalId;
    return existingByName;
  }

  const set = db.sets.find((entry) => entry.id === input.setId);
  const record: SealedProductRecord = {
    id: createSealedProductId(input.setId, input.productType, input.productName),
    setId: input.setId,
    productName: input.productName,
    productType: input.productType,
    imageUrl:
      input.imageUrl ??
      createSealedProductImageDataUrl(input.productName, set?.code ?? "pkmn", input.productType),
    releaseDate: input.releaseDate ?? set?.releaseDate,
    upc: input.upc,
    marketValueUsd: input.marketValueUsd,
    source: input.source ?? "MANUAL",
    externalId: input.externalId,
  };
  db.sealedProducts.push(record);
  return record;
}

export function matchSealedProduct(
  db: GemIndexDatabase,
  input: {
    productId?: string;
    upc?: string;
    setId?: string;
    productName?: string;
    productType?: SealedProductType;
  },
): SealedProductRecord | null {
  if (input.productId) {
    return db.sealedProducts.find((item) => item.id === input.productId) ?? null;
  }

  const targetUpc = (input.upc ?? "").replace(/\D+/g, "");
  if (targetUpc) {
    const byUpc =
      db.sealedProducts.find((item) => (item.upc ?? "").replace(/\D+/g, "") === targetUpc) ?? null;
    if (byUpc) {
      return byUpc;
    }
  }

  const setId = input.setId;
  const productName = input.productName;
  const productType = input.productType;
  if (!setId || !productName || !productType) {
    return null;
  }

  const exact = db.sealedProducts.find(
    (item) =>
      item.setId === setId &&
      item.productType === productType &&
      item.productName.toLowerCase() === productName.toLowerCase(),
  );
  if (exact) {
    return exact;
  }

  const sameSetAndType = db.sealedProducts.filter(
    (item) => item.setId === setId && item.productType === productType,
  );
  if (sameSetAndType.length === 1) {
    return sameSetAndType[0];
  }

  return null;
}
