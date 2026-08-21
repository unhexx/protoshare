import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { createClient } from "@libsql/client";
import { desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const DEFAULT_SHARES_URL = "file:.protoshare/shares.db";

export type SharesConfig = {
  url: string;
  authToken?: string;
};

export type ShareRow = {
  slug: string;
  title: string;
  origin: string;
  url?: string;
  createdAt: string;
};

export type RecordShareInput = {
  slug: string;
  title: string;
  origin: string;
  url?: string;
  createdAt?: Date;
  config?: SharesConfig;
};

export type RecordShareResult =
  | { ok: true; share: ShareRow }
  | { ok: false; detail: string };

const shares = sqliteTable("shares", {
  slug: text("slug").primaryKey(),
  title: text("title").notNull(),
  origin: text("origin").notNull(),
  url: text("url"),
  createdAt: text("created_at").notNull(),
});

export function sharesConfigFromEnv(
  env: NodeJS.Dict<string> = process.env,
): SharesConfig {
  const url = (env.PROTOSHARE_LIBSQL_URL || env.TURSO_DATABASE_URL || DEFAULT_SHARES_URL).trim();
  const authToken = env.PROTOSHARE_LIBSQL_AUTH_TOKEN || env.TURSO_AUTH_TOKEN;
  return authToken ? { url, authToken } : { url };
}

function sqliteFilePath(url: string): string | null {
  if (!url.startsWith("file:")) return null;
  const rest = url.slice("file:".length);
  if (rest.startsWith(":memory")) return null;
  if (rest.startsWith("///")) return rest.slice(2);
  return rest;
}

async function ensureDbDir(url: string): Promise<void> {
  const file = sqliteFilePath(url);
  if (!file) return;
  const dir = dirname(file);
  if (!dir || dir === ".") return;
  await mkdir(dir, { recursive: true });
}

async function openDb(config: SharesConfig) {
  await ensureDbDir(config.url);
  const client = createClient({
    url: config.url,
    authToken: config.authToken,
  });
  const db = drizzle(client);
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS shares (
      slug TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      origin TEXT NOT NULL,
      url TEXT,
      created_at TEXT NOT NULL
    )
  `);
  return { client, db };
}

function toRow(input: RecordShareInput, createdAt: string): ShareRow {
  const row: ShareRow = {
    slug: input.slug,
    title: input.title,
    origin: input.origin,
    createdAt,
  };
  if (input.url?.trim()) row.url = input.url.trim();
  return row;
}

/** Пишет шару в libsql. Ошибка каталога не должна ронять share. */
export async function recordShare(input: RecordShareInput): Promise<RecordShareResult> {
  const config = input.config ?? sharesConfigFromEnv();
  const createdAt = (input.createdAt ?? new Date()).toISOString();
  const share = toRow(input, createdAt);
  try {
    const { client, db } = await openDb(config);
    try {
      await db
        .insert(shares)
        .values({
          slug: share.slug,
          title: share.title,
          origin: share.origin,
          url: share.url ?? null,
          createdAt: share.createdAt,
        })
        .onConflictDoUpdate({
          target: shares.slug,
          set: {
            title: share.title,
            origin: share.origin,
            url: share.url ?? null,
            createdAt: share.createdAt,
          },
        });
      return { ok: true, share };
    } finally {
      client.close();
    }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

export async function listShares(opts: {
  limit?: number;
  config?: SharesConfig;
} = {}): Promise<ShareRow[]> {
  const config = opts.config ?? sharesConfigFromEnv();
  const limit = opts.limit ?? 50;
  const { client, db } = await openDb(config);
  try {
    const rows = await db.select().from(shares).orderBy(desc(shares.createdAt)).limit(limit);
    return rows.map((row) => {
      const out: ShareRow = {
        slug: row.slug,
        title: row.title,
        origin: row.origin,
        createdAt: row.createdAt,
      };
      if (row.url) out.url = row.url;
      return out;
    });
  } finally {
    client.close();
  }
}
