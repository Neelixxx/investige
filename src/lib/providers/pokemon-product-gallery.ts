import {
  classifyPokemonGalleryProduct,
  DEFAULT_GALLERY_TYPE_OPTIONS,
  type PokemonGalleryTypeOption,
} from "../pokemon-product-gallery-shared";

const PRODUCT_GALLERY_BASE_URL = "https://www.pokemon.com/us/pokemon-tcg/product-gallery/";
const PRODUCT_GALLERY_START_YEAR = 2013;
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;
const FETCH_TIMEOUT_MS = 10_000;

type PokemonGalleryProduct = {
  name: string;
  url: string;
  imageUrl?: string;
  year: number;
  type: PokemonGalleryTypeOption;
};

export type PokemonGalleryTypeSummary = PokemonGalleryTypeOption & {
  count: number;
};

export type PokemonProductGallerySnapshot = {
  source: "POKEMON_DOT_COM" | "CACHE" | "FALLBACK";
  evaluatedAt: string;
  totalProducts: number;
  types: PokemonGalleryTypeSummary[];
};

let cachedSnapshot: { expiresAt: number; snapshot: PokemonProductGallerySnapshot } | null = null;
let lastSuccessfulSnapshot: PokemonProductGallerySnapshot | null = null;

function galleryYears(): number[] {
  const currentYear = new Date().getUTCFullYear();
  return Array.from({ length: currentYear - PRODUCT_GALLERY_START_YEAR + 1 }, (_, index) => currentYear - index);
}

function galleryYearUrl(year: number): string {
  const currentYear = new Date().getUTCFullYear();
  if (year === currentYear) {
    return PRODUCT_GALLERY_BASE_URL;
  }

  return `${PRODUCT_GALLERY_BASE_URL}${year}`;
}

function htmlDecode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(value: string): string {
  return htmlDecode(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim();
}

function isGalleryProtectionPage(html: string): boolean {
  return /_Incapsula_Resource|Incapsula incident|Request unsuccessful/i.test(html);
}

function normalizeGalleryProductName(value: string): string {
  return value
    .replace(/^Pokémon\s+TCG:\s*/i, "")
    .replace(/^Pokemon\s+TCG:\s*/i, "")
    .trim();
}

function extractProductName(anchorMarkup: string, anchorInner: string): string | null {
  const candidates = [
    ...Array.from(anchorMarkup.matchAll(/\b(?:aria-label|title|data-title|alt)="([^"]+)"/gi)).map((match) => match[1]),
    ...Array.from(anchorInner.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi)).map((match) => stripHtml(match[1])),
    stripHtml(anchorInner),
  ];

  for (const rawCandidate of candidates) {
    const candidate = normalizeGalleryProductName(rawCandidate);
    if (
      !candidate ||
      candidate.length < 4 ||
      /^(Return to Gallery|Buy Now|Back to Top|Read More|Learn More)$/i.test(candidate)
    ) {
      continue;
    }

    return candidate;
  }

  return null;
}

function extractImageUrl(anchorMarkup: string): string | undefined {
  const match = anchorMarkup.match(/\b(?:src|data-src|data-lazy|data-original)="([^"]+)"/i);
  if (!match?.[1]) {
    return undefined;
  }

  try {
    return new URL(match[1], PRODUCT_GALLERY_BASE_URL).toString();
  } catch {
    return undefined;
  }
}

function parseProductsFromHtml(html: string, year: number): PokemonGalleryProduct[] {
  const products: PokemonGalleryProduct[] = [];
  const seenUrls = new Set<string>();
  const anchorRegex =
    /<a\b[^>]*href="(\/us\/pokemon-tcg\/product-gallery\/(?!\d{4}(?:[/?#"]|$))[^"#?]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(anchorRegex)) {
    const href = match[1];
    const anchorMarkup = match[0];
    const anchorInner = match[2] ?? "";
    if (!href) {
      continue;
    }

    const name = extractProductName(anchorMarkup, anchorInner);
    if (!name) {
      continue;
    }

    const url = new URL(href, PRODUCT_GALLERY_BASE_URL).toString();
    if (seenUrls.has(url)) {
      continue;
    }
    seenUrls.add(url);

    products.push({
      name,
      url,
      imageUrl: extractImageUrl(anchorMarkup),
      year,
      type: classifyPokemonGalleryProduct(name),
    });
  }

  return products;
}

async function fetchGalleryYear(year: number): Promise<PokemonGalleryProduct[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(galleryYearUrl(year), {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
        "user-agent": "Mozilla/5.0 (compatible; InvestigeBot/1.0; +https://investige.online)",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Pokemon product gallery request failed for ${year} (${response.status})`);
    }

    const html = await response.text();
    if (isGalleryProtectionPage(html)) {
      throw new Error(`Pokemon product gallery blocked for ${year}`);
    }

    return parseProductsFromHtml(html, year);
  } finally {
    clearTimeout(timeout);
  }
}

function fallbackSnapshot(): PokemonProductGallerySnapshot {
  return {
    source: "FALLBACK",
    evaluatedAt: new Date().toISOString(),
    totalProducts: 0,
    types: DEFAULT_GALLERY_TYPE_OPTIONS.map((option) => ({ ...option, count: 0 })),
  };
}

function buildSnapshot(products: PokemonGalleryProduct[]): PokemonProductGallerySnapshot {
  const counts = new Map<string, PokemonGalleryTypeSummary>();

  for (const product of products) {
    const existing = counts.get(product.type.key);
    if (existing) {
      existing.count += 1;
      continue;
    }

    counts.set(product.type.key, {
      ...product.type,
      count: 1,
    });
  }

  for (const option of DEFAULT_GALLERY_TYPE_OPTIONS) {
    if (!counts.has(option.key)) {
      counts.set(option.key, {
        ...option,
        count: 0,
      });
    }
  }

  return {
    source: "POKEMON_DOT_COM",
    evaluatedAt: new Date().toISOString(),
    totalProducts: products.length,
    types: Array.from(counts.values()).sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.label.localeCompare(right.label);
    }),
  };
}

export async function fetchPokemonProductGallerySnapshot(): Promise<PokemonProductGallerySnapshot> {
  const now = Date.now();
  if (cachedSnapshot && cachedSnapshot.expiresAt > now) {
    return cachedSnapshot.snapshot;
  }

  try {
    const results = await Promise.allSettled(galleryYears().map((year) => fetchGalleryYear(year)));
    const products = results
      .filter((result): result is PromiseFulfilledResult<PokemonGalleryProduct[]> => result.status === "fulfilled")
      .flatMap((result) => result.value);

    if (!products.length) {
      throw new Error("No product gallery items parsed.");
    }

    const snapshot = buildSnapshot(products);
    cachedSnapshot = { expiresAt: now + CACHE_TTL_MS, snapshot };
    lastSuccessfulSnapshot = snapshot;
    return snapshot;
  } catch {
    if (lastSuccessfulSnapshot) {
      const snapshot = {
        ...lastSuccessfulSnapshot,
        source: "CACHE" as const,
        evaluatedAt: new Date().toISOString(),
      };
      cachedSnapshot = { expiresAt: now + CACHE_TTL_MS, snapshot };
      return snapshot;
    }

    const snapshot = fallbackSnapshot();
    cachedSnapshot = { expiresAt: now + Math.min(CACHE_TTL_MS, 1000 * 60 * 30), snapshot };
    return snapshot;
  }
}
