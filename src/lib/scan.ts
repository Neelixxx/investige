import type {
  CardRecord,
  GemIndexDatabase,
  Grader,
  SealedInventoryRecord,
  SealedProductRecord,
} from "./types";
import {
  extractBarcodeLikeTokens as extractBarcodeLikeTokensFromTemplates,
  matchSealedBarcodeTemplate,
  matchSealedLabelTemplate,
  matchSlabLabelTemplate,
} from "./scan-templates";

export interface ScanMatch {
  card: CardRecord;
  confidence: number;
  reason: string;
}

export interface SetScanMatch {
  id: string;
  code: string;
  name: string;
  confidence: number;
  reason: string;
}

export interface SlabScanDetails {
  grader?: Grader;
  grade?: number;
  confidence?: number;
  templateId?: string;
  barcode?: string;
}

export interface SealedScanDetails {
  productType: SealedInventoryRecord["productType"];
  productName: string;
  confidence?: number;
  templateId?: string;
  barcode?: string;
  setCode?: string;
}

export interface SealedProductScanMatch {
  product: SealedProductRecord;
  confidence: number;
  reason: string;
  viaBarcode: boolean;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokenOverlapScore(text: string, target: string): number {
  const tokens = normalize(target).split(" ").filter((token) => token.length > 2);
  if (!tokens.length) {
    return 0;
  }
  const hits = tokens.filter((token) => text.includes(token)).length;
  return hits / tokens.length;
}

function compactDigits(value: string | undefined): string {
  return (value ?? "").replace(/\D+/g, "");
}

function normalizeProductType(value: SealedInventoryRecord["productType"]): string {
  return value.replace(/_/g, " ").toLowerCase();
}

export function findSealedProductCandidatesFromScan(
  db: GemIndexDatabase,
  scannedText: string,
  barcode?: string,
): SealedProductScanMatch[] {
  const clean = normalize(scannedText);
  const barcodeToken = compactDigits(barcode ?? extractBarcodeLikeTokensFromTemplates(scannedText)[0]);
  const setById = new Map(db.sets.map((set) => [set.id, set]));

  const ranked = db.sealedProducts
    .map((product) => {
      const productUpc = compactDigits(product.upc);
      const barcodeMatched = Boolean(barcodeToken && productUpc && barcodeToken === productUpc);
      if (barcodeMatched) {
        return {
          product,
          confidence: 0.99,
          reason: `Exact UPC match ${product.upc}`,
          viaBarcode: true,
        } satisfies SealedProductScanMatch;
      }

      if (!clean) {
        return null;
      }

      const set = setById.get(product.setId);
      const exactNameMatch = clean.includes(normalize(product.productName));
      const nameScore = exactNameMatch ? 0.72 : tokenOverlapScore(clean, product.productName) * 0.7;
      const typeScore = clean.includes(normalizeProductType(product.productType))
        ? 0.12
        : tokenOverlapScore(clean, normalizeProductType(product.productType)) * 0.1;
      const setCodeScore = set && clean.includes(normalize(set.code)) ? 0.2 : 0;
      const setNameScore = set ? tokenOverlapScore(clean, set.name) * 0.18 : 0;
      const confidence = Math.min(0.97, nameScore + typeScore + setCodeScore + setNameScore);

      if (confidence < 0.45) {
        return null;
      }

      const reasons = [
        exactNameMatch
          ? `Matched sealed label ${product.productName}`
          : `Name overlap ${(nameScore * 100).toFixed(0)}%`,
        setCodeScore > 0 ? `set code ${set?.code}` : undefined,
        setNameScore >= 0.08 ? `set ${(setNameScore * 100).toFixed(0)}%` : undefined,
      ]
        .filter(Boolean)
        .join(" | ");

      return {
        product,
        confidence,
        reason: reasons || "Template match",
        viaBarcode: false,
      } satisfies SealedProductScanMatch;
    })
    .filter((entry): entry is SealedProductScanMatch => Boolean(entry))
    .sort((a, b) => b.confidence - a.confidence || a.product.productName.localeCompare(b.product.productName));

  return ranked.slice(0, 6);
}

export function findSetFromScan(db: GemIndexDatabase, scannedText: string): SetScanMatch | null {
  const clean = normalize(scannedText);
  if (!clean) {
    return null;
  }

  const ranked = db.sets
    .map((set) => {
      const code = normalize(set.code);
      const name = normalize(set.name);
      if (clean.includes(code)) {
        return {
          id: set.id,
          code: set.code,
          name: set.name,
          confidence: 0.95,
          reason: `Matched set code ${set.code}`,
        } satisfies SetScanMatch;
      }

      if (clean.includes(name)) {
        return {
          id: set.id,
          code: set.code,
          name: set.name,
          confidence: 0.9,
          reason: `Matched set name ${set.name}`,
        } satisfies SetScanMatch;
      }

      const overlap = tokenOverlapScore(clean, set.name);
      return {
        id: set.id,
        code: set.code,
        name: set.name,
        confidence: overlap,
        reason: `Set token overlap ${(overlap * 100).toFixed(0)}%`,
      } satisfies SetScanMatch;
    })
    .sort((a, b) => b.confidence - a.confidence);

  const best = ranked[0];
  if (!best || best.confidence < 0.5) {
    return null;
  }

  return best;
}

export function findSlabDetailsFromScan(scannedText: string): SlabScanDetails {
  const template = matchSlabLabelTemplate(scannedText);
  const upper = scannedText.toUpperCase();
  const grader = upper.includes("PSA")
    ? "PSA"
    : upper.includes("TAG")
      ? "TAG"
      : template?.grader;

  const gradeMatch =
    scannedText.match(/\b(PRISTINE|PRISMATIC)\s*(10|9)\b/i) ??
    scannedText.match(/\bGEM\s*(MINT|MT)\s*(10|9)\b/i) ??
    scannedText.match(/\b(?:GEM\s*MINT|MINT|GRADE|GR)\s*([1-9]|10)\b/i) ??
    scannedText.match(/\b(?:PSA|TAG)\s*([1-9]|10)\b/i) ??
    scannedText.match(/\b([1-9]|10)\b/);

  const rawGrade = Number(gradeMatch?.[2] ?? gradeMatch?.[1] ?? NaN);
  const grade = Number.isFinite(rawGrade) && rawGrade >= 1 && rawGrade <= 10 ? rawGrade : undefined;
  const barcode = extractBarcodeLikeTokensFromTemplates(scannedText)[0];

  return { grader, grade, confidence: template?.confidence, templateId: template?.templateId, barcode };
}

export function findSealedDetailsFromScan(
  scannedText: string,
  barcode?: string,
): SealedScanDetails | null {
  const clean = normalize(scannedText);
  const barcodeToken = barcode ?? extractBarcodeLikeTokensFromTemplates(scannedText)[0];
  const barcodeTemplate = matchSealedBarcodeTemplate(barcodeToken);
  if (barcodeTemplate) {
    return {
      productType: barcodeTemplate.productType,
      productName: barcodeTemplate.productName,
      confidence: barcodeTemplate.confidence,
      templateId: "barcode-template",
      barcode: barcodeTemplate.barcode,
      setCode: barcodeTemplate.setCode,
    };
  }

  const labelTemplate = matchSealedLabelTemplate(scannedText);
  if (!labelTemplate) {
    return null;
  }

  const labelPart = labelTemplate.productName.toLowerCase();
  const start = clean.indexOf(labelPart);
  const rawName = start > 0 ? scannedText.slice(0, start + labelPart.length).trim() : "";
  const productName = rawName.length >= 4 ? rawName : labelTemplate.productName;

  return {
    productType: labelTemplate.productType,
    productName,
    confidence: labelTemplate.confidence,
    templateId: labelTemplate.templateId,
    barcode: barcodeToken,
  };
}

export function extractBarcodeLikeTokens(text: string): string[] {
  return extractBarcodeLikeTokensFromTemplates(text);
}

export function findCardFromScan(db: GemIndexDatabase, scannedText: string): ScanMatch | null {
  const clean = normalize(scannedText);
  if (!clean) {
    return null;
  }

  const numberMatch = scannedText.match(/([a-z]{0,2}\d+[a-z]{0,2}|\d+[a-z]{0,2})\s*\//i) ??
    scannedText.match(/\b([a-z]{0,2}\d+[a-z]{0,2})\b/i);
  const parsedNumber = numberMatch?.[1]?.toUpperCase();

  const setMatch = db.sets.find((set) => {
    const code = set.code.toLowerCase();
    const name = set.name.toLowerCase();
    return clean.includes(code) || clean.includes(name);
  });

  const setScopedCards = setMatch
    ? db.cards.filter((card) => card.setId === setMatch.id)
    : db.cards;

  if (parsedNumber) {
    const exactByNumber = setScopedCards.find(
      (card) => card.cardNumber.toUpperCase() === parsedNumber,
    );

    if (exactByNumber) {
      return {
        card: exactByNumber,
        confidence: setMatch ? 0.95 : 0.8,
        reason: `Matched card number ${parsedNumber}`,
      };
    }
  }

  const nameRanked = setScopedCards
    .map((card) => {
      const cardName = normalize(card.name);
      if (clean.includes(cardName)) {
        return { card, confidence: 0.9, reason: `Matched full card name ${card.name}` };
      }

      const tokens = cardName.split(" ");
      const tokenHits = tokens.filter((token) => clean.includes(token)).length;
      const confidence = tokens.length ? tokenHits / tokens.length : 0;
      return { card, confidence, reason: `Token overlap ${tokenHits}/${tokens.length}` };
    })
    .sort((a, b) => b.confidence - a.confidence);

  const best = nameRanked[0];
  if (!best || best.confidence < 0.5) {
    return null;
  }

  return best;
}
