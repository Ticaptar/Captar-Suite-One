import { Pool } from "pg";

declare global {
  var __captarSuitePgPool: Pool | undefined;
}

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL nao configurada.");
  }
  return url;
}

export function getPgPool(): Pool {
  if (!global.__captarSuitePgPool) {
    global.__captarSuitePgPool = new Pool({
      connectionString: getDatabaseUrl(),
    });
  }
  return global.__captarSuitePgPool;
}
