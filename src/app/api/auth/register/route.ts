import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { hashPassword, isPasswordStrong, PASSWORD_REQUIREMENTS_MESSAGE, publicUser } from "@/lib/auth";
import { issueEmailVerification } from "@/lib/account-recovery";
import { nextId, withDbMutation } from "@/lib/db";
import { plusDays } from "@/lib/entitlements";
import { emailProviderConfigured } from "@/lib/notifications";
import { checkRateLimit } from "@/lib/rate-limit";
import type { UserRecord } from "@/lib/types";

export const runtime = "nodejs";

const registerSchema = z.object({
  firstName: z.string().min(1).max(40),
  lastName: z.string().min(1).max(40),
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9._-]+$/, "Username can only include letters, numbers, dot, underscore, and hyphen"),
  email: z.string().email().max(160),
  password: z.string().max(120).refine(isPasswordStrong, PASSWORD_REQUIREMENTS_MESSAGE),
  passwordConfirm: z.string().max(120),
}).refine((value) => value.password === value.passwordConfirm, {
  message: "Passwords do not match.",
  path: ["passwordConfirm"],
});

function requireEmailVerification(): boolean {
  const allowUnverified =
    process.env.AUTH_ALLOW_UNVERIFIED_LOGIN === "1" ||
    process.env.AUTH_ALLOW_UNVERIFIED_LOGIN === "true";
  if (allowUnverified) {
    return false;
  }

  const override = process.env.AUTH_REQUIRE_EMAIL_VERIFICATION;
  if (override === "1" || override === "true") {
    return true;
  }
  if (override === "0" || override === "false") {
    return false;
  }

  if (process.env.NODE_ENV !== "production") {
    return false;
  }

  return emailProviderConfigured();
}

export async function POST(request: NextRequest) {
  const json = await request.json();
  const parse = registerSchema.safeParse(json);

  if (!parse.success) {
    return NextResponse.json(
      { error: parse.error.issues[0]?.message ?? "Could not create account." },
      { status: 400 },
    );
  }

  const payload = parse.data;
  const firstName = payload.firstName.trim();
  const lastName = payload.lastName.trim();
  const fullName = `${firstName} ${lastName}`.trim();
  const username = payload.username.trim().toLowerCase();
  const email = payload.email.trim().toLowerCase();
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit({
    key: `register:${ip}:${email}:${username}`,
    limit: 6,
    windowMs: 60 * 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many registrations. Retry in ${rl.retryAfterSeconds}s.` },
      { status: 429 },
    );
  }

  const passwordHash = await hashPassword(payload.password);
  const verificationRequired = requireEmailVerification();

  let createdUser: UserRecord;

  try {
    createdUser = await withDbMutation((db) => {
      const emailExists = db.users.some((user) => user.email.toLowerCase() === email);
      if (emailExists) {
        throw new Error("EMAIL_EXISTS");
      }
      const usernameExists = db.users.some((user) => user.username.toLowerCase() === username);
      if (usernameExists) {
        throw new Error("USERNAME_EXISTS");
      }

      const role = db.users.length === 0 ? "ADMIN" : "USER";
      const now = new Date().toISOString();
      const nextUser: UserRecord = {
        id: nextId("user"),
        name: fullName,
        username,
        email,
        passwordHash,
        role,
        subscriptionTier: role === "ADMIN" ? "ELITE" : "FREE",
        subscriptionStatus: role === "ADMIN" ? "ACTIVE" : "TRIALING",
        subscriptionCurrentPeriodEnd:
          role === "ADMIN"
            ? plusDays(new Date(now), 365)
            : plusDays(new Date(now), 14),
        trialEndsAt: role === "ADMIN" ? undefined : plusDays(new Date(now), 14),
        emailVerified: role === "ADMIN" || !verificationRequired,
        emailVerifiedAt: role === "ADMIN" || !verificationRequired ? now : undefined,
        createdAt: now,
        updatedAt: now,
      };

      db.users.push(nextUser);
      return nextUser;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_EXISTS") {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "USERNAME_EXISTS") {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }

    return NextResponse.json({ error: "Could not create account." }, { status: 500 });
  }

  let debugVerificationToken: string | undefined;
  if (!createdUser.emailVerified) {
    debugVerificationToken = await issueEmailVerification(createdUser);
  }

  return NextResponse.json(
    {
      user: publicUser(createdUser),
      requiresEmailVerification: !createdUser.emailVerified,
      ...(process.env.NODE_ENV !== "production" ? { debugVerificationToken } : {}),
    },
    { status: 201 },
  );
}
