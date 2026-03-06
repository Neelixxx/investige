import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { cardMetrics, setMetrics } from "@/lib/analytics";
import { requireUser } from "@/lib/auth";
import { nextId, readDb, withDbMutation } from "@/lib/db";
import { featureErrorMessage, hasFeature } from "@/lib/entitlements";
import {
  extractBarcodeLikeTokens,
  findCardFromScan,
  findSealedDetailsFromScan,
  findSealedProductCandidatesFromScan,
  findSetFromScan,
  findSlabDetailsFromScan,
} from "@/lib/scan";
import { ensureSealedProductRecord, matchSealedProduct } from "@/lib/sealed-products";
import { cardWithSet, enrichCollection, enrichSealed, enrichSealedWishlist, enrichWishlist } from "@/lib/selectors";

export const runtime = "nodejs";

const RAW_CONDITIONS = ["NM", "LP", "HP", "DMG"] as const;
type RawCondition = (typeof RAW_CONDITIONS)[number];

function normalizeRawCondition(condition?: RawCondition): RawCondition {
  return condition ?? "NM";
}

const scanSchema = z.object({
  scannedText: z.string().min(2),
  destination: z.enum(["COLLECTION", "WISHLIST", "PRICE_CHECK"]),
  quantity: z.number().int().min(1).default(1),
  ownershipType: z.enum(["RAW", "GRADED"]).default("RAW"),
  rawCondition: z.enum(RAW_CONDITIONS).optional(),
  grader: z.enum(["PSA", "TAG"]).optional(),
  grade: z.number().int().min(1).max(10).optional(),
  targetPriceUsd: z.number().nonnegative().optional(),
});

export async function POST(request: NextRequest) {
  const json = await request.json();
  const parse = scanSchema.safeParse(json);

  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  const payload = parse.data;
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
  if (payload.destination !== "PRICE_CHECK" && !hasFeature(user, "PORTFOLIO_TRACKING")) {
    return NextResponse.json(
      { error: featureErrorMessage(user, "PORTFOLIO_TRACKING") },
      { status: 402 },
    );
  }
  const snapshot = await readDb();
  const match = findCardFromScan(snapshot, payload.scannedText);
  const barcodeValue = extractBarcodeLikeTokens(payload.scannedText)[0];
  const setMatchByText = findSetFromScan(snapshot, payload.scannedText);
  const slab = findSlabDetailsFromScan(payload.scannedText);
  const sealed = findSealedDetailsFromScan(payload.scannedText, barcodeValue);
  const sealedCandidates = findSealedProductCandidatesFromScan(
    snapshot,
    payload.scannedText,
    barcodeValue,
  );
  const primarySealedCandidate = sealedCandidates[0]?.product ?? null;
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
  const isSealed = Boolean(primarySealedCandidate || (sealed && setMatch));
  const isGraded = Boolean(slab.grader || slab.grade || payload.ownershipType === "GRADED");
  const rawCondition = isGraded ? undefined : normalizeRawCondition(payload.rawCondition);

  await withDbMutation((db) => {
    db.scanEvents.push({
      id: nextId("scan"),
      userId: user.id,
      cardId: match?.card.id,
      destination: payload.destination,
      scannedText: payload.scannedText,
      createdAt: new Date().toISOString(),
    });

    if (payload.destination === "PRICE_CHECK") {
      return;
    }

    if (isSealed && payload.destination === "COLLECTION" && resolvedSet) {
      const product =
        (primarySealedCandidate
          ? matchSealedProduct(db, { productId: primarySealedCandidate.id })
          : null) ??
        (sealed
          ? matchSealedProduct(db, {
              upc: barcodeValue,
              setId: resolvedSet.id,
              productName: sealed.productName,
              productType: sealed.productType,
            })
          : null) ??
        (sealed
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
      const existing = db.sealedInventoryItems.find(
        (item) => item.userId === user.id && item.productId === product.id,
      );
      if (existing) {
        existing.quantity += payload.quantity;
      } else {
        db.sealedInventoryItems.push({
          id: nextId("sealed"),
          userId: user.id,
          productId: product.id,
          setId: product.setId,
          productName: product.productName,
          productType: product.productType,
          quantity: payload.quantity,
          acquiredAt: new Date().toISOString(),
          notes: "Added by scanner",
        });
      }
      return;
    }

    if (isSealed && payload.destination === "WISHLIST" && resolvedSet) {
      const product =
        (primarySealedCandidate
          ? matchSealedProduct(db, { productId: primarySealedCandidate.id })
          : null) ??
        (sealed
          ? matchSealedProduct(db, {
              upc: barcodeValue,
              setId: resolvedSet.id,
              productName: sealed.productName,
              productType: sealed.productType,
            })
          : null) ??
        (sealed
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
      const existing = db.sealedWishlistItems.find(
        (item) => item.userId === user.id && item.productId === product.id,
      );
      if (existing) {
        existing.targetPriceUsd = payload.targetPriceUsd ?? existing.targetPriceUsd;
        existing.priority = Math.min(5, Math.max(1, existing.priority - 1));
      } else {
        db.sealedWishlistItems.push({
          id: nextId("sealed_wishlist"),
          userId: user.id,
          productId: product.id,
          setId: product.setId,
          productName: product.productName,
          productType: product.productType,
          targetPriceUsd: payload.targetPriceUsd,
          priority: 2,
          createdAt: new Date().toISOString(),
          notes: "Added by scanner",
        });
      }
      return;
    }

    if (!match) {
      return;
    }

    if (payload.destination === "COLLECTION") {
      const ownershipType = isGraded ? "GRADED" : "RAW";
      const grader = ownershipType === "GRADED" ? (payload.grader ?? slab.grader) : undefined;
      const grade = ownershipType === "GRADED" ? (payload.grade ?? slab.grade) : undefined;
      const existing = db.collectionItems.find(
        (item) =>
          item.userId === user.id &&
          item.cardId === match.card.id &&
          item.ownershipType === ownershipType &&
          (ownershipType === "RAW"
            ? normalizeRawCondition(item.rawCondition) === rawCondition
            : true) &&
          (item.grader ?? null) === (grader ?? null) &&
          (item.grade ?? null) === (grade ?? null),
      );

      if (existing) {
        existing.quantity += payload.quantity;
        if (ownershipType === "RAW") {
          existing.rawCondition = rawCondition;
        }
      } else {
        db.collectionItems.push({
          id: nextId("collection"),
          userId: user.id,
          cardId: match.card.id,
          ownershipType,
          rawCondition,
          grader,
          grade,
          quantity: payload.quantity,
          acquiredAt: new Date().toISOString(),
          notes: "Added by scanner",
        });
      }
      return;
    }

    const wishlist = db.wishlistItems.find(
      (item) => item.userId === user.id && item.cardId === match.card.id,
    );

    if (wishlist) {
      wishlist.targetPriceUsd = payload.targetPriceUsd ?? wishlist.targetPriceUsd;
      wishlist.priority = Math.min(5, Math.max(1, wishlist.priority - 1));
    } else {
      db.wishlistItems.push({
        id: nextId("wishlist"),
        userId: user.id,
        cardId: match.card.id,
        targetPriceUsd: payload.targetPriceUsd,
        priority: 2,
        createdAt: new Date().toISOString(),
      });
    }
  });

  const db = await readDb(true);
  const cardMetric = match ? cardMetrics(db).find((entry) => entry.cardId === match.card.id) : undefined;
  const setMetric = resolvedSet ? setMetrics(db).find((entry) => entry.setId === resolvedSet.id) : undefined;
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

  return NextResponse.json({
    actionPreview: false,
    itemKind: isSealed ? "SEALED_PRODUCT" : isGraded && match ? "GRADED_SLAB" : match ? "RAW_CARD" : "UNKNOWN",
    barcode: barcodeValue ?? null,
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
    match: match
      ? {
          ...match,
          card: cardWithSet(db, match.card.id),
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
            raw: cardMetric.rawPrice,
            psa10: cardMetric.psa10Price,
            tag10: cardMetric.tag10Price,
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
    },
    collection: payload.destination === "COLLECTION" ? enrichCollection(db, user.id) : undefined,
    wishlist: payload.destination === "WISHLIST" ? enrichWishlist(db, user.id) : undefined,
    sealedCollection: payload.destination === "COLLECTION" ? enrichSealed(db, user.id) : undefined,
    sealedWishlist: payload.destination === "WISHLIST" ? enrichSealedWishlist(db, user.id) : undefined,
  });
}
