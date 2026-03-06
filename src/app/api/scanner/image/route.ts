import { NextRequest, NextResponse } from "next/server";

import { cardMetrics, setMetrics } from "@/lib/analytics";
import { requireUser } from "@/lib/auth";
import { detectBarcodesFromImage } from "@/lib/barcode";
import { nextId, readDb, withDbMutation } from "@/lib/db";
import { featureErrorMessage, hasFeature } from "@/lib/entitlements";
import { runImageOcr } from "@/lib/ocr";
import {
  extractBarcodeLikeTokens,
  findCardFromScan,
  findSealedDetailsFromScan,
  findSealedProductCandidatesFromScan,
  findSetFromScan,
  findSlabDetailsFromScan,
} from "@/lib/scan";
import { ensureSealedProductRecord, matchSealedProduct } from "@/lib/sealed-products";
import {
  cardWithSet,
  enrichCollection,
  enrichSealed,
  enrichSealedWishlist,
  enrichWishlist,
} from "@/lib/selectors";
import type { CardCondition, RawCardCondition } from "@/lib/types";

export const runtime = "nodejs";

type ScanIntent = "COLLECTION" | "WISHLIST" | "PRICE_CHECK";
type ScanItemKind = "RAW_CARD" | "GRADED_SLAB" | "SEALED_PRODUCT" | "UNKNOWN";

function normalizeRawCondition(condition?: RawCardCondition): RawCardCondition {
  return condition ?? "NM";
}

function parseIntent(input: FormDataEntryValue | null): ScanIntent {
  const value = (typeof input === "string" ? input : "").toUpperCase();
  if (value === "WISHLIST") {
    return "WISHLIST";
  }
  if (value === "PRICE_CHECK") {
    return "PRICE_CHECK";
  }
  return "COLLECTION";
}

function parseQuantity(input: FormDataEntryValue | null): number {
  const raw = Number(typeof input === "string" ? input : "1");
  if (!Number.isFinite(raw) || raw < 1) {
    return 1;
  }
  return Math.max(1, Math.floor(raw));
}

function parseTargetPrice(input: FormDataEntryValue | null): number | undefined {
  const raw = Number(typeof input === "string" ? input : "");
  if (!Number.isFinite(raw) || raw < 0) {
    return undefined;
  }
  return raw;
}

function parsePreviewOnly(input: FormDataEntryValue | null): boolean {
  const value = (typeof input === "string" ? input : "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function latestConditionPrice(
  db: Awaited<ReturnType<typeof readDb>>,
  cardId: string,
  condition: CardCondition,
): number {
  const sorted = db.sales
    .filter((entry) => entry.cardId === cardId && entry.condition === condition)
    .sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime());
  return sorted[0]?.priceUsd ?? 0;
}

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireUser(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasFeature(user, "CARD_SCANNER_TEXT")) {
    return NextResponse.json(
      { error: featureErrorMessage(user, "CARD_SCANNER_TEXT") },
      { status: 402 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "image file is required" }, { status: 400 });
  }

  const destination = parseIntent(formData.get("destination"));
  const quantity = parseQuantity(formData.get("quantity"));
  const targetPriceUsd = parseTargetPrice(formData.get("targetPriceUsd"));
  const previewOnly = parsePreviewOnly(formData.get("previewOnly"));
  if (destination !== "PRICE_CHECK" && !hasFeature(user, "PORTFOLIO_TRACKING")) {
    return NextResponse.json(
      { error: featureErrorMessage(user, "PORTFOLIO_TRACKING") },
      { status: 402 },
    );
  }

  const [ocr, barcodes] = await Promise.all([runImageOcr(file), detectBarcodesFromImage(file)]);
  const barcodeFromImage = barcodes[0]?.value;
  const barcodeFromText = extractBarcodeLikeTokens(ocr.text)[0];
  const barcodeValue = barcodeFromImage ?? barcodeFromText;
  const snapshot = await readDb();
  const cardMatch = findCardFromScan(snapshot, ocr.text);
  const slab = findSlabDetailsFromScan(ocr.text);
  const sealed = findSealedDetailsFromScan(ocr.text, barcodeValue);
  const sealedCandidates = findSealedProductCandidatesFromScan(snapshot, ocr.text, barcodeValue);
  const primarySealedCandidate = sealedCandidates[0]?.product ?? null;
  const setMatchByText = findSetFromScan(snapshot, ocr.text);
  const resolvedSet =
    (setMatchByText
      ? snapshot.sets.find((entry) => entry.id === setMatchByText.id)
      : undefined) ??
    (primarySealedCandidate
      ? snapshot.sets.find((entry) => entry.id === primarySealedCandidate.setId)
      : undefined) ??
    (sealed?.setCode ? snapshot.sets.find((entry) => entry.code === sealed.setCode) : undefined);
  const setMatch = setMatchByText
    ? setMatchByText
    : primarySealedCandidate && resolvedSet
      ? {
          id: resolvedSet.id,
          code: resolvedSet.code,
          name: resolvedSet.name,
          confidence: sealedCandidates[0]?.confidence ?? 0.8,
          reason: sealedCandidates[0]?.reason ?? "Matched sealed product catalog",
        }
    : resolvedSet
      ? {
          id: resolvedSet.id,
          code: resolvedSet.code,
          name: resolvedSet.name,
          confidence: sealed?.confidence ?? 0.7,
          reason: sealed?.barcode ? `Matched via barcode ${sealed.barcode}` : "Matched via sealed label template",
        }
      : null;

  const isGradedHint = Boolean(slab.grader || slab.grade || slab.templateId);
  const itemKind: ScanItemKind = primarySealedCandidate || sealed
    ? "SEALED_PRODUCT"
    : cardMatch && isGradedHint
      ? "GRADED_SLAB"
      : cardMatch
        ? "RAW_CARD"
        : "UNKNOWN";

  await withDbMutation((db) => {
    db.scanEvents.push({
      id: nextId("scan"),
      userId: user.id,
      cardId: cardMatch?.card.id,
      destination,
      scannedText: ocr.text,
      createdAt: new Date().toISOString(),
    });

    if (previewOnly || destination === "PRICE_CHECK") {
      return;
    }

    if ((itemKind === "RAW_CARD" || itemKind === "GRADED_SLAB") && cardMatch) {
      if (destination === "COLLECTION") {
        const ownershipType = itemKind === "GRADED_SLAB" ? "GRADED" : "RAW";
        const rawCondition = ownershipType === "RAW" ? normalizeRawCondition() : undefined;
        const grader = ownershipType === "GRADED" ? slab.grader : undefined;
        const grade = ownershipType === "GRADED" ? slab.grade : undefined;
        const existing = db.collectionItems.find(
          (item) =>
            item.userId === user.id &&
            item.cardId === cardMatch.card.id &&
            item.ownershipType === ownershipType &&
            (ownershipType === "RAW"
              ? normalizeRawCondition(item.rawCondition) === rawCondition
              : true) &&
            (item.grader ?? null) === (grader ?? null) &&
            (item.grade ?? null) === (grade ?? null),
        );

        if (existing) {
          existing.quantity += quantity;
          if (ownershipType === "RAW") {
            existing.rawCondition = rawCondition;
          }
        } else {
          db.collectionItems.push({
            id: nextId("collection"),
            userId: user.id,
            cardId: cardMatch.card.id,
            ownershipType,
            rawCondition,
            grader,
            grade,
            quantity,
            acquiredAt: new Date().toISOString(),
            notes: "Added by image scanner",
          });
        }
      } else if (destination === "WISHLIST") {
        const existing = db.wishlistItems.find(
          (item) => item.userId === user.id && item.cardId === cardMatch.card.id,
        );
        if (existing) {
          existing.targetPriceUsd = targetPriceUsd ?? existing.targetPriceUsd;
          existing.priority = Math.min(5, Math.max(1, existing.priority - 1));
        } else {
          db.wishlistItems.push({
            id: nextId("wishlist"),
            userId: user.id,
            cardId: cardMatch.card.id,
            targetPriceUsd,
            priority: 2,
            createdAt: new Date().toISOString(),
          });
        }
      }
      return;
    }

    if (itemKind === "SEALED_PRODUCT") {
      const product =
        (primarySealedCandidate
          ? matchSealedProduct(db, { productId: primarySealedCandidate.id })
          : null) ??
        (resolvedSet && sealed
          ? matchSealedProduct(db, {
              upc: barcodeValue,
              setId: resolvedSet.id,
              productName: sealed.productName,
              productType: sealed.productType,
            })
          : null) ??
        (resolvedSet && sealed
          ? ensureSealedProductRecord(db, {
              setId: resolvedSet.id,
              productName: sealed.productName,
              productType: sealed.productType,
              upc: barcodeValue,
              source: "SCANNER",
            })
          : null);

      if (!product) {
        return;
      }

      if (destination === "COLLECTION") {
        const existing = db.sealedInventoryItems.find(
          (item) => item.userId === user.id && item.productId === product.id,
        );

        if (existing) {
          existing.quantity += quantity;
        } else {
          db.sealedInventoryItems.push({
            id: nextId("sealed"),
            userId: user.id,
            productId: product.id,
            setId: product.setId,
            productName: product.productName,
            productType: product.productType,
            quantity,
            acquiredAt: new Date().toISOString(),
            notes: "Added by image scanner",
          });
        }
      } else if (destination === "WISHLIST") {
        const existing = db.sealedWishlistItems.find(
          (item) => item.userId === user.id && item.productId === product.id,
        );
        if (existing) {
          existing.targetPriceUsd = targetPriceUsd ?? existing.targetPriceUsd;
          existing.priority = Math.min(5, Math.max(1, existing.priority - 1));
        } else {
          db.sealedWishlistItems.push({
            id: nextId("sealed_wishlist"),
            userId: user.id,
            productId: product.id,
            setId: product.setId,
            productName: product.productName,
            productType: product.productType,
            targetPriceUsd,
            priority: 2,
            createdAt: new Date().toISOString(),
            notes: "Added by image scanner",
          });
        }
      }
    }
  });

  const db = await readDb(true);
  const cardMetric = cardMatch
    ? cardMetrics(db).find((entry) => entry.cardId === cardMatch.card.id)
    : undefined;
  const setMetric = resolvedSet
    ? setMetrics(db).find((entry) => entry.setId === resolvedSet.id)
    : undefined;
  const resolvedSealedProduct =
    primarySealedCandidate
      ? matchSealedProduct(db, { productId: primarySealedCandidate.id })
      : resolvedSet && sealed
        ? matchSealedProduct(db, {
            upc: barcodeValue,
            setId: resolvedSet.id,
            productName: sealed.productName,
            productType: sealed.productType,
          })
        : null;
  const estimatedSealedPrice =
    itemKind === "SEALED_PRODUCT"
      ? (() => {
          const matchedProduct =
            resolvedSealedProduct ??
            (resolvedSet && sealed
              ? matchSealedProduct(db, {
                  upc: barcodeValue,
                  setId: resolvedSet.id,
                  productName: sealed.productName,
                  productType: sealed.productType,
                })
              : null);
          if (typeof matchedProduct?.marketValueUsd === "number" && matchedProduct.marketValueUsd > 0) {
            return matchedProduct.marketValueUsd;
          }

          return db.sealedInventoryItems
            .filter(
              (entry) =>
                entry.productId === matchedProduct?.id &&
                typeof entry.estimatedValueUsd === "number",
            )
            .map((entry) => entry.estimatedValueUsd as number)
            .reduce((sum, value, _, all) => sum + value / all.length, 0);
        })()
      : 0;

  return NextResponse.json({
    destination,
    actionPreview: previewOnly,
    itemKind,
    ocr,
    barcode: barcodeValue
      ? {
          value: barcodeValue,
          format: barcodes[0]?.format ?? "OCR_DIGITS",
          detectedCount: barcodes.length,
        }
      : null,
    barcodeCandidates: barcodes,
    slab,
    sealedCandidates: sealedCandidates.map((entry) => {
      const set = db.sets.find((item) => item.id === entry.product.setId);
      return {
        id: entry.product.id,
        productId: entry.product.id,
        productName: entry.product.productName,
        productType: entry.product.productType,
        imageUrl: entry.product.imageUrl,
        releaseDate: entry.product.releaseDate,
        upc: entry.product.upc,
        marketValueUsd: entry.product.marketValueUsd,
        setId: entry.product.setId,
        setCode: set?.code,
        setName: set?.name,
        confidence: entry.confidence,
        reason: entry.reason,
        viaBarcode: entry.viaBarcode,
      };
    }),
    sealed: sealed
      ? {
          ...sealed,
          productId: resolvedSealedProduct?.id,
          setId: resolvedSealedProduct?.setId ?? resolvedSet?.id,
          setName: resolvedSet?.name,
          setCode: resolvedSet?.code ?? sealed.setCode,
          imageUrl: resolvedSealedProduct?.imageUrl,
          releaseDate: resolvedSealedProduct?.releaseDate,
          upc: resolvedSealedProduct?.upc,
          marketValueUsd: resolvedSealedProduct?.marketValueUsd,
        }
      : resolvedSealedProduct
        ? {
            productName: resolvedSealedProduct.productName,
            productType: resolvedSealedProduct.productType,
            confidence: sealedCandidates[0]?.confidence,
            templateId: "catalog-match",
            barcode: barcodeValue,
            productId: resolvedSealedProduct.id,
            setId: resolvedSealedProduct.setId,
            setName: resolvedSet?.name,
            setCode: resolvedSet?.code,
            imageUrl: resolvedSealedProduct.imageUrl,
            releaseDate: resolvedSealedProduct.releaseDate,
            upc: resolvedSealedProduct.upc,
            marketValueUsd: resolvedSealedProduct.marketValueUsd,
          }
      : null,
    match: cardMatch
      ? {
          ...cardMatch,
          card: cardWithSet(db, cardMatch.card.id),
        }
      : null,
    setMatch: setMatch
      ? {
          id: setMatch.id,
          code: setMatch.code,
          name: setMatch.name,
          confidence: setMatch.confidence,
          reason: setMatch.reason,
        }
      : null,
    priceCheck: {
      card: cardMetric
        ? {
            raw: latestConditionPrice(db, cardMetric.cardId, "RAW"),
            psa10: latestConditionPrice(db, cardMetric.cardId, "PSA10"),
            tag10: latestConditionPrice(db, cardMetric.cardId, "TAG10"),
            gemRateBlended: cardMetric.gemRateBlended,
          }
        : null,
      set: setMetric
        ? {
            setId: setMetric.setId,
            name: setMetric.name,
            totalSetValue: setMetric.totalSetValue,
          }
        : null,
      sealedEstimateUsd: estimatedSealedPrice > 0 ? estimatedSealedPrice : null,
    },
    collection: destination === "COLLECTION" ? enrichCollection(db, user.id) : undefined,
    wishlist: destination === "WISHLIST" ? enrichWishlist(db, user.id) : undefined,
    sealedCollection: destination === "COLLECTION" ? enrichSealed(db, user.id) : undefined,
    sealedWishlist: destination === "WISHLIST" ? enrichSealedWishlist(db, user.id) : undefined,
  });
}
