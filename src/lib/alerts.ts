import { cardMetrics, marketSeries, sealedMarketSeries, sealedProductMetrics, setMetrics } from "./analytics";
import { nextId } from "./db";
import type {
  AlertConditionType,
  AlertEntityType,
  AlertEventRecord,
  AlertRuleRecord,
  GemIndexDatabase,
} from "./types";

function shiftMonth(dateIso: string, deltaMonths: number): string {
  const source = new Date(dateIso);
  return new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + deltaMonths, 1)).toISOString();
}

function latestWithBaseline(
  points: Array<{ date: string; value: number }>,
  lookbackMonths: number,
): { currentValue: number; baselineValue?: number } | null {
  if (!points.length) {
    return null;
  }

  const sorted = points.slice().sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const target = shiftMonth(latest.date, -Math.max(1, lookbackMonths));
  const baseline =
    [...sorted].reverse().find((point) => point.date <= target) ??
    sorted[0];

  return {
    currentValue: latest.value,
    baselineValue: baseline?.value,
  };
}

function setValueSeries(db: GemIndexDatabase, setId: string): Array<{ date: string; value: number }> {
  const setCards = db.cards.filter((card) => card.setId === setId);
  if (!setCards.length) {
    return [];
  }

  const map = new Map<string, number>();
  setCards.forEach((card) => {
    marketSeries(db, card.id).forEach((point) => {
      if (typeof point.raw !== "number") {
        return;
      }
      const month = point.date.slice(0, 7);
      map.set(month, (map.get(month) ?? 0) + point.raw);
    });
  });

  return [...map.entries()]
    .map(([month, value]) => ({ date: `${month}-01T00:00:00.000Z`, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

type EvaluatedRule = {
  currentValue: number;
  baselineValue?: number;
  percentChange?: number;
};

function formatPercent(value: number, digits = 2): string {
  const rounded = Number(value.toFixed(digits));
  if (rounded === 100) {
    return "100%";
  }
  return `${rounded.toFixed(digits)}%`;
}

function evaluateRuleValue(db: GemIndexDatabase, rule: AlertRuleRecord): EvaluatedRule | null {
  const lookbackMonths = rule.lookbackMonths ?? 3;

  if (rule.entityType === "CARD") {
    const metric = cardMetrics(db).find((item) => item.cardId === rule.entityId);
    if (!metric) {
      return null;
    }
    const currentValue = metric.rawPrice;
    const baseline = latestWithBaseline(
      marketSeries(db, rule.entityId)
        .filter((point): point is { date: string; raw: number } => typeof point.raw === "number")
        .map((point) => ({ date: point.date, value: point.raw })),
      lookbackMonths,
    );
    const baselineValue = baseline?.baselineValue;
    const percentChange =
      typeof baselineValue === "number" && baselineValue > 0
        ? ((currentValue - baselineValue) / baselineValue) * 100
        : undefined;
    return { currentValue, baselineValue, percentChange };
  }

  if (rule.entityType === "SEALED_PRODUCT") {
    const product = db.sealedProducts.find((item) => item.id === rule.entityId);
    if (!product) {
      return null;
    }
    const productMetrics = sealedProductMetrics(db, rule.entityId, rule.userId);
    const currentValue = productMetrics.latestMarketPrice || product.marketValueUsd || 0;
    const baseline = latestWithBaseline(
      sealedMarketSeries(db, rule.entityId, rule.userId)
        .filter((point): point is { date: string; market: number } => typeof point.market === "number")
        .map((point) => ({ date: point.date, value: point.market })),
      lookbackMonths,
    );
    const baselineValue = baseline?.baselineValue;
    const percentChange =
      typeof baselineValue === "number" && baselineValue > 0
        ? ((currentValue - baselineValue) / baselineValue) * 100
        : undefined;
    return { currentValue, baselineValue, percentChange };
  }

  const metric = setMetrics(db).find((item) => item.setId === rule.entityId);
  if (!metric) {
    return null;
  }
  const currentValue = metric.totalSetValue;
  const baseline = latestWithBaseline(setValueSeries(db, rule.entityId), lookbackMonths);
  const baselineValue = baseline?.baselineValue;
  const percentChange =
    typeof baselineValue === "number" && baselineValue > 0
      ? ((currentValue - baselineValue) / baselineValue) * 100
      : undefined;
  return { currentValue, baselineValue, percentChange };
}

function isTriggered(
  condition: AlertConditionType,
  thresholdValue: number,
  currentValue: number,
  percentChange?: number,
): boolean {
  if (condition === "PRICE_BELOW") {
    return currentValue <= thresholdValue;
  }
  if (condition === "PRICE_ABOVE") {
    return currentValue >= thresholdValue;
  }
  if (condition === "PCT_CHANGE_UP") {
    return typeof percentChange === "number" && percentChange >= thresholdValue;
  }
  return typeof percentChange === "number" && percentChange <= -Math.abs(thresholdValue);
}

function describeCondition(condition: AlertConditionType, thresholdValue: number): string {
  switch (condition) {
    case "PRICE_BELOW":
      return `below $${thresholdValue.toFixed(2)}`;
    case "PRICE_ABOVE":
      return `above $${thresholdValue.toFixed(2)}`;
    case "PCT_CHANGE_UP":
      return `up ${formatPercent(thresholdValue)}`;
    case "PCT_CHANGE_DOWN":
      return `down ${formatPercent(Math.abs(thresholdValue))}`;
    default:
      return "threshold reached";
  }
}

function createEvent(
  rule: AlertRuleRecord,
  evaluated: EvaluatedRule,
): AlertEventRecord {
  const message = `${rule.entityLabel} moved ${describeCondition(rule.condition, rule.thresholdValue)}.`;
  return {
    id: nextId("alert_event"),
    userId: rule.userId,
    ruleId: rule.id,
    entityType: rule.entityType,
    entityId: rule.entityId,
    entityLabel: rule.entityLabel,
    condition: rule.condition,
    thresholdValue: rule.thresholdValue,
    currentValue: evaluated.currentValue,
    baselineValue: evaluated.baselineValue,
    percentChange: evaluated.percentChange,
    message,
    triggeredAt: new Date().toISOString(),
  };
}

export function evaluateAlertsForUser(db: GemIndexDatabase, userId: string): {
  rules: AlertRuleRecord[];
  events: AlertEventRecord[];
  unreadCount: number;
  newlyTriggered: number;
} {
  const rules = db.alertRules
    .filter((rule) => rule.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const events = db.alertEvents
    .filter((event) => event.userId === userId)
    .sort((a, b) => b.triggeredAt.localeCompare(a.triggeredAt));

  let newlyTriggered = 0;

  rules.forEach((rule) => {
    if (!rule.enabled) {
      rule.lastConditionMet = false;
      rule.updatedAt = new Date().toISOString();
      return;
    }

    const evaluated = evaluateRuleValue(db, rule);
    if (!evaluated) {
      return;
    }

    const conditionMet = isTriggered(
      rule.condition,
      rule.thresholdValue,
      evaluated.currentValue,
      evaluated.percentChange,
    );
    const shouldTrigger = conditionMet && !rule.lastConditionMet;

    rule.lastEvaluatedValue = evaluated.currentValue;
    rule.lastConditionMet = conditionMet;
    rule.updatedAt = new Date().toISOString();

    if (!shouldTrigger) {
      return;
    }

    const event = createEvent(rule, evaluated);
    db.alertEvents.push(event);
    rule.lastTriggeredAt = event.triggeredAt;
    newlyTriggered += 1;
  });

  const updatedEvents = db.alertEvents
    .filter((event) => event.userId === userId)
    .sort((a, b) => b.triggeredAt.localeCompare(a.triggeredAt));

  return {
    rules: db.alertRules
      .filter((rule) => rule.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    events: updatedEvents,
    unreadCount: updatedEvents.filter((event) => !event.readAt).length,
    newlyTriggered,
  };
}

export function defaultLookbackForCondition(condition: AlertConditionType): number | undefined {
  if (condition === "PCT_CHANGE_UP" || condition === "PCT_CHANGE_DOWN") {
    return 3;
  }
  return undefined;
}

export function isPercentCondition(condition: AlertConditionType): boolean {
  return condition === "PCT_CHANGE_UP" || condition === "PCT_CHANGE_DOWN";
}

export function validAlertEntity(entityType: AlertEntityType, entityId: string, db: GemIndexDatabase): boolean {
  if (entityType === "CARD") {
    return db.cards.some((item) => item.id === entityId);
  }
  if (entityType === "SEALED_PRODUCT") {
    return db.sealedProducts.some((item) => item.id === entityId);
  }
  return db.sets.some((item) => item.id === entityId);
}
