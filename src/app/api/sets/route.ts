import { NextResponse } from "next/server";

import { sealedSetMarketSeries, setMetrics } from "@/lib/analytics";
import { assessDataQuality } from "@/lib/data-quality";
import { readDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const db = await readDb();
  const dataQuality = assessDataQuality(db);
  const investmentMetricsReady = dataQuality.investmentMetricsReady;
  const items = setMetrics(db).map((item) =>
    investmentMetricsReady
      ? item
      : {
          ...item,
          totalSetValue: 0,
          roi12m: 0,
          volatility: 0,
        },
  );

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
