import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file:./data/emaus.db";

const globalForDb = globalThis as unknown as {
  libsql?: ReturnType<typeof createClient>;
};

const client = globalForDb.libsql ?? createClient({ url });
if (process.env.NODE_ENV !== "production") globalForDb.libsql = client;

if (url.startsWith("file:")) {
  // WAL melhora leitura concorrente; FK precisa ser ligada por conexão no SQLite.
  void client.executeMultiple(
    "PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;",
  );
}

export const db = drizzle(client, { schema });
export type DB = typeof db;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export { schema };
