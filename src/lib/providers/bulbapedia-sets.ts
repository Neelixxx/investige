const BULBAPEDIA_EXPANSIONS_URL =
  "https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_Trading_Card_Game_expansions";
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;

type CachedImageMap = {
  expiresAt: number;
  imagesByName: Map<string, string>;
};

let cachedImageMap: CachedImageMap | null = null;

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&eacute;/g, "e")
    .replace(/&uuml;/g, "u")
    .replace(/&rsquo;/g, "'")
    .replace(/&mdash;/g, "-")
    .replace(/&ndash;/g, "-")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function normalizeBulbapediaSetName(value: string): string {
  return decodeHtml(value)
    .normalize("NFKD")
    .replace(/[^\w\s&-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function parseBulbapediaSetImages(html: string): Map<string, string> {
  const imagesByName = new Map<string, string>();

  for (const match of html.matchAll(/title="([^"]+?) \(TCG\)">([^<]+)<\/a>/g)) {
    const index = match.index ?? -1;
    if (index < 0) {
      continue;
    }

    const rowStart = html.lastIndexOf("<tr", index);
    const previousRowEnd = html.lastIndexOf("</tr>", index);
    const rowEnd = html.indexOf("</tr>", index);
    if (rowStart < 0 || rowEnd < 0 || rowStart < previousRowEnd) {
      continue;
    }

    const row = html.slice(rowStart, rowEnd);
    if (!row.includes("<td") || !row.includes('<img src="')) {
      continue;
    }

    const imageCandidates = [...row.matchAll(/<img src="([^"]+)"/g)].map((image) => image[1]);
    const imageUrl = imageCandidates.at(-1);
    if (!imageUrl) {
      continue;
    }

    for (const candidate of [match[1], match[2]]) {
      const normalized = normalizeBulbapediaSetName(candidate);
      if (normalized && !imagesByName.has(normalized)) {
        imagesByName.set(normalized, imageUrl);
      }
    }
  }

  return imagesByName;
}

export async function getBulbapediaSetImageMap(): Promise<Map<string, string>> {
  if (cachedImageMap && cachedImageMap.expiresAt > Date.now()) {
    return cachedImageMap.imagesByName;
  }

  const response = await fetch(BULBAPEDIA_EXPANSIONS_URL, {
    headers: {
      "user-agent": "Investige/1.0 (+https://investige.online)",
    },
    next: { revalidate: 60 * 60 * 12 },
  });

  if (!response.ok) {
    throw new Error(`Bulbapedia set image request failed with ${response.status}`);
  }

  const html = await response.text();
  const imagesByName = parseBulbapediaSetImages(html);

  cachedImageMap = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    imagesByName,
  };

  return imagesByName;
}
