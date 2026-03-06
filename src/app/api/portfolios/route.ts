import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { nextId, readDb, withDbMutation } from "@/lib/db";
import { featureErrorMessage, hasFeature } from "@/lib/entitlements";
import { listPortfolios } from "@/lib/selectors";

export const runtime = "nodejs";

const createPortfolioSchema = z.object({
  name: z.string().trim().min(2).max(60),
});

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireUser(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasFeature(user, "PORTFOLIO_TRACKING")) {
    return NextResponse.json(
      { error: featureErrorMessage(user, "PORTFOLIO_TRACKING") },
      { status: 402 },
    );
  }

  const db = await readDb();
  return NextResponse.json({ items: listPortfolios(db, user.id) });
}

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => ({}));
  const parse = createPortfolioSchema.safeParse(json);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  let user;
  try {
    user = await requireUser(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasFeature(user, "PORTFOLIO_TRACKING")) {
    return NextResponse.json(
      { error: featureErrorMessage(user, "PORTFOLIO_TRACKING") },
      { status: 402 },
    );
  }

  const normalizedName = parse.data.name.trim();
  try {
    await withDbMutation((db) => {
      const exists = db.portfolios.find(
        (portfolio) =>
          portfolio.userId === user.id &&
          portfolio.name.toLowerCase() === normalizedName.toLowerCase(),
      );
      if (exists) {
        throw new Error("A portfolio with that name already exists.");
      }

      const now = new Date().toISOString();
      db.portfolios.push({
        id: nextId("portfolio"),
        userId: user.id,
        name: normalizedName,
        createdAt: now,
        updatedAt: now,
      });
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create portfolio." },
      { status: 400 },
    );
  }

  const db = await readDb(true);
  return NextResponse.json({ items: listPortfolios(db, user.id) }, { status: 201 });
}
