import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { createClient } from "@libsql/client";
import { desc, eq, sql } from "drizzle-orm";
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

export type RemoveShareInput = {
  slug: string;
  config?: SharesConfig;
};

export type RemoveShareResult =
  | { ok: true; slug: string }
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

function isEphemeralShareUrl(url: string | undefined | null): boolean {
  if (!url?.trim()) return true;
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
    if (host === "share.zrok.io" || host.endsWith(".share.zrok.io")) return true;
    if (host === "trycloudflare.com" || host.endsWith(".trycloudflare.com")) return true;
    return false;
  } catch {
    return true;
  }
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

function catalogUrlOnConflict(existing: string | null | undefined, next: string | undefined): string | undefined {
  if (existing && isEphemeralShareUrl(next) && !isEphemeralShareUrl(existing)) return existing;
  return next;
}

/** Пишет шару в libsql. Ошибка каталога не должна ронять share. */
export async function recordShare(input: RecordShareInput): Promise<RecordShareResult> {
  const config = input.config ?? sharesConfigFromEnv();
  const createdAt = (input.createdAt ?? new Date()).toISOString();
  const share = toRow(input, createdAt);
  try {
    const { client, db } = await openDb(config);
    try {
      const existing = await db.select().from(shares).where(eq(shares.slug, share.slug)).limit(1);
      const url = catalogUrlOnConflict(existing[0]?.url, share.url);
      const stored: ShareRow = {
        slug: share.slug,
        title: share.title,
        origin: share.origin,
        createdAt: share.createdAt,
      };
      if (url) stored.url = url;
      await db
        .insert(shares)
        .values({
          slug: stored.slug,
          title: stored.title,
          origin: stored.origin,
          url: stored.url ?? null,
          createdAt: stored.createdAt,
        })
        .onConflictDoUpdate({
          target: shares.slug,
          set: {
            title: stored.title,
            origin: stored.origin,
            url: stored.url ?? null,
            createdAt: stored.createdAt,
          },
        });
      return { ok: true, share: stored };
    } finally {
      client.close();
    }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

/** Удаляет шару из libsql. Нет записи / ошибка — ok:false, без throw. */
export async function removeShare(input: RemoveShareInput): Promise<RemoveShareResult> {
  const slug = input.slug.trim();
  if (!slug) return { ok: false, detail: "нужен slug" };
  const config = input.config ?? sharesConfigFromEnv();
  try {
    const { client, db } = await openDb(config);
    try {
      const existing = await db.select().from(shares).where(eq(shares.slug, slug)).limit(1);
      if (existing.length === 0) {
        return { ok: false, detail: `шара «${slug}» не найдена` };
      }
      await db.delete(shares).where(eq(shares.slug, slug));
      return { ok: true, slug };
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
