import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { readDb, withDbMutation } from "@/lib/db";

export const runtime = "nodejs";

const markEventsSchema = z.object({
  eventId: z.string().min(1).optional(),
  markAll: z.boolean().optional(),
});

export async function PATCH(request: NextRequest) {
  const json = await request.json();
  const parse = markEventsSchema.safeParse(json);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  let user;
  try {
    user = await requireUser(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = parse.data;
  if (!payload.markAll && !payload.eventId) {
    return NextResponse.json({ error: "eventId or markAll is required" }, { status: 400 });
  }

  await withDbMutation((db) => {
    const now = new Date().toISOString();
    if (payload.markAll) {
      db.alertEvents.forEach((event) => {
        if (event.userId === user.id && !event.readAt) {
          event.readAt = now;
        }
      });
      return;
    }

    const event = db.alertEvents.find((item) => item.id === payload.eventId && item.userId === user.id);
    if (event && !event.readAt) {
      event.readAt = now;
    }
  });

  const db = await readDb(true);
  const events = db.alertEvents
    .filter((event) => event.userId === user.id)
    .sort((a, b) => b.triggeredAt.localeCompare(a.triggeredAt));

  return NextResponse.json({
    events,
    unreadCount: events.filter((event) => !event.readAt).length,
  });
}
