import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { fetchPokemonProductGallerySnapshot } from "@/lib/providers/pokemon-product-gallery";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshot = await fetchPokemonProductGallerySnapshot();
  return NextResponse.json(snapshot);
}
