import { cardIndexSeries, cardMetrics } from "@/lib/analytics";
import { assessDataQuality } from "@/lib/data-quality";
import { readDb } from "@/lib/db";
import { requireServerFeature } from "@/lib/server-auth";
import { AnalyticsNav } from "@/components/analytics-nav";

export const dynamic = "force-dynamic";

const RAW_CARD_CONDITION_MULTIPLIERS: Record<"NM" | "LP" | "HP" | "DMG", number> = {
  NM: 1,
  LP: 0.85,
  HP: 0.7,
  DMG: 0.5,
};

function usd(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(value: number, digits = 2): string {
  const rounded = Number(value.toFixed(digits));
  if (rounded === 100) {
    return "100%";
  }
  return `${rounded.toFixed(digits)}%`;
}

export default async function PortfolioPerformancePage() {
  const user = await requireServerFeature("PORTFOLIO_TRACKING");
  const db = await readDb();
  const dataQuality = assessDataQuality(db);
  const investmentMetricsReady = dataQuality.investmentMetricsReady;
  const metrics = cardMetrics(db);
  const metricByCard = new Map(metrics.map((entry) => [entry.cardId, entry]));

  // accumulate separate totals for raw and graded card values so we can display them individually
  let rawPortfolioValue = 0;
  let gradedPortfolioValue = 0;

  const rows = db.collectionItems
    .filter((item) => item.userId === user?.id)
    .map((item) => {
      const metric = metricByCard.get(item.cardId);
      const rawCondition = item.rawCondition ?? "NM";
      const marketEach =
        item.ownershipType === "GRADED" && item.grader === "PSA"
          ? (metric?.psa10Price ?? 0)
          : item.ownershipType === "GRADED" && item.grader === "TAG"
            ? (metric?.tag10Price ?? 0)
            : (metric?.rawPrice ?? 0) * RAW_CARD_CONDITION_MULTIPLIERS[rawCondition];

      const marketValue = marketEach * item.quantity;
      const costBasis = (item.acquisitionPriceUsd ?? 0) * item.quantity;
      const pnl = marketValue - costBasis;

      // increment breakdown totals
      if (item.ownershipType === "GRADED") {
        gradedPortfolioValue += marketValue;
      } else {
        rawPortfolioValue += marketValue;
      }

      const card = db.cards.find((entry) => entry.id === item.cardId);
      const set = card ? db.sets.find((entry) => entry.id === card.setId) : null;

      return {
        id: item.id,
        label: `${card?.name ?? "Unknown"} ${card?.cardNumber ?? ""} (${set?.code?.toUpperCase() ?? "N/A"})`,
        quantity: item.quantity,
        marketEach,
        marketValue,
        costBasis,
        pnl,
      };
    });

  // combined value is still useful for ROI calculations, but we no longer surface it directly
  const portfolioValue = rawPortfolioValue + gradedPortfolioValue;
  const costBasis = rows.reduce((sum, row) => sum + row.costBasis, 0);
  const pnl = portfolioValue - costBasis;

  const sealedValue = db.sealedInventoryItems
    .filter((item) => item.userId === user?.id)
    .reduce((sum, item) => sum + (item.estimatedValueUsd ?? 0) * item.quantity, 0);

  const index = investmentMetricsReady ? cardIndexSeries(db) : [];
  const indexStart = index[0]?.value ?? 100;
  const indexEnd = index[index.length - 1]?.value ?? 100;
  const benchmarkRoi = ((indexEnd - indexStart) / indexStart) * 100;
  const portfolioRoi = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4 sm:p-8">
      <AnalyticsNav />
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h1 className="text-2xl font-semibold">Portfolio Performance</h1>
        <p className="text-sm text-slate-600">Cost basis, mark-to-market P/L, and benchmark versus Card Index.</p>
        {!investmentMetricsReady ? <p className="mt-2 text-sm text-amber-700">{dataQuality.blockingReason}</p> : null}
      </section>

      <section className="grid gap-3 md:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">Raw Collection MV: {investmentMetricsReady ? usd(rawPortfolioValue) : "Pending"}</div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">Graded Collection MV: {investmentMetricsReady ? usd(gradedPortfolioValue) : "Pending"}</div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">Sealed MV: {investmentMetricsReady ? usd(sealedValue) : "Pending"}</div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">Cost Basis: {usd(costBasis)}</div>
        <div className={`rounded-xl border border-slate-200 bg-white p-3 text-sm ${pnl >= 0 ? "text-emerald-700" : "text-rose-700"}`}>P/L: {investmentMetricsReady ? usd(pnl) : "Pending"}</div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
          {investmentMetricsReady ? `Portfolio ROI ${formatPercent(portfolioRoi)} | Index ROI ${formatPercent(benchmarkRoi)}` : "ROI metrics pending live data readiness."}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 font-semibold">Position Detail</h2>
        <div className="max-h-[70vh] overflow-auto text-sm">
          {rows.map((row) => (
            <div key={row.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] border-b py-1">
              <span>{row.label}</span>
              <span>x{row.quantity}</span>
              <span>{investmentMetricsReady ? usd(row.marketValue) : "Pending"}</span>
              <span>{usd(row.costBasis)}</span>
              <span className={row.pnl >= 0 ? "text-emerald-700" : "text-rose-700"}>{investmentMetricsReady ? usd(row.pnl) : "Pending"}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
