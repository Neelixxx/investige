import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
const storageMode = (process.env.GEMINDEX_STORAGE_MODE ?? "").toLowerCase();

let prismaSingleton: PrismaClient | null = null;

export function hasPostgresUrl(): boolean {
  if (storageMode === "file") {
    return false;
  }

  if (storageMode === "postgres") {
    return Boolean(connectionString && connectionString.startsWith("postgres"));
  }

  return Boolean(connectionString && connectionString.startsWith("postgres"));
}

export function prismaClient(): PrismaClient {
  if (!hasPostgresUrl()) {
    throw new Error("DATABASE_URL is not configured for postgres.");
  }

  if (!prismaSingleton) {
    const adapter = new PrismaPg({ connectionString: connectionString as string });
    prismaSingleton = new PrismaClient({ adapter, log: ["error", "warn"] });
  }

  return prismaSingleton;
}
