import { NextResponse } from "next/server";

import { sealedSetMarketSeries, setMetrics } from "@/lib/analytics";
import { assessDataQuality } from "@/lib/data-quality";
import { readDb } from "@/lib/db";
import { getBulbapediaSetImageMap, normalizeBulbapediaSetName } from "@/lib/providers/bulbapedia-sets";

export const runtime = "nodejs";

export async function GET() {
  const db = await readDb();
  const dataQuality = assessDataQuality(db);
  const investmentMetricsReady = dataQuality.investmentMetricsReady;
  let bulbapediaImages = new Map<string, string>();
  try {
    bulbapediaImages = await getBulbapediaSetImageMap();
  } catch {
    bulbapediaImages = new Map<string, string>();
  }

  const items = setMetrics(db).map((item) =>
    investmentMetricsReady
      ? item
      : {
          ...item,
          totalSetValue: 0,
          roi12m: 0,
          volatility: 0,
        },
  ).map((item) => {
    const setRecord = db.sets.find((set) => set.id === item.setId);
    return {
      ...item,
      imageUrl:
        bulbapediaImages.get(normalizeBulbapediaSetName(item.name)) ??
        setRecord?.logoUrl ??
        setRecord?.symbolUrl,
    };
  });

  return NextResponse.json({
    items,
    catalog: db.sets,
    dataQuality,
    sealedSetHistory: db.sets
      .map((set) => ({
        setId: set.id,
        setCode: set.code,
        setName: set.name,
        series: sealedSetMarketSeries(db, set.id),
      }))
      .filter((set) => set.series.length > 0),
  });
}
