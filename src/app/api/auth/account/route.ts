import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  createSessionToken,
  hashPassword,
  isPasswordStrong,
  PASSWORD_REQUIREMENTS_MESSAGE,
  publicUser,
  requireUser,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { readDb, writeDb } from "@/lib/db";

export const runtime = "nodejs";

const accountUpdateSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required.").max(80, "First name is too long."),
    lastName: z.string().trim().min(1, "Last name is required.").max(80, "Last name is too long."),
    email: z.string().trim().email("Enter a valid email address.").max(160, "Email is too long."),
    currentPassword: z.string().optional().default(""),
    newPassword: z.string().optional().default(""),
  })
  .superRefine((value, ctx) => {
    const wantsPasswordChange = value.newPassword.trim().length > 0;
    if (!wantsPasswordChange) {
      return;
    }

    if (!value.currentPassword.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Current password is required to set a new password.",
        path: ["currentPassword"],
      });
    }

    if (!isPasswordStrong(value.newPassword.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: PASSWORD_REQUIREMENTS_MESSAGE,
        path: ["newPassword"],
      });
    }
  });

export async function PATCH(request: NextRequest) {
  let sessionUser;
  try {
    sessionUser = await requireUser(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parse = accountUpdateSchema.safeParse(json);
  if (!parse.success) {
    const firstIssue = parse.error.issues[0];
    return NextResponse.json(
      { error: firstIssue?.message ?? "Could not update account settings." },
      { status: 400 },
    );
  }

  const db = await readDb();
  const user = db.users.find((entry) => entry.id === sessionUser.id);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const normalizedEmail = parse.data.email.trim().toLowerCase();
  const emailInUse = db.users.some(
    (entry) => entry.id !== user.id && entry.email.toLowerCase() === normalizedEmail,
  );
  if (emailInUse) {
    return NextResponse.json({ error: "That email address is already in use." }, { status: 409 });
  }

  const wantsPasswordChange = parse.data.newPassword.trim().length > 0;
  if (wantsPasswordChange) {
    const isValid = await verifyPassword(parse.data.currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });
    }
    user.passwordHash = await hashPassword(parse.data.newPassword.trim());
  }

  const firstName = parse.data.firstName.trim();
  const lastName = parse.data.lastName.trim();
  user.name = `${firstName} ${lastName}`.replace(/\s+/g, " ").trim();
  user.email = normalizedEmail;
  user.updatedAt = new Date().toISOString();

  await writeDb(db);

  const token = await createSessionToken(user);
  const response = NextResponse.json({ user: publicUser(user) });
  setSessionCookie(response, token);
  return response;
}
