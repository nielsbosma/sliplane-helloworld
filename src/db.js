import { readdir, readFile } from "node:fs/promises";
import pg from "pg";

const MIGRATIONS = new URL("../migrations/", import.meta.url);

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function waitForDatabase() {
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (error) {
      if (attempt >= 30) throw error;
      console.log(`Waiting for the database (${error.message})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

export async function migrate() {
  await waitForDatabase();
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(727274)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS hello_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const { rows } = await client.query("SELECT name FROM hello_migrations");
    const applied = new Set(rows.map((r) => r.name));
    const files = (await readdir(MIGRATIONS)).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(new URL(file, MIGRATIONS), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO hello_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`Applied migration ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${error.message}`);
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(727274)").catch(() => {});
    client.release();
  }
}

export const items = {
  list: async () => (await pool.query("SELECT * FROM items ORDER BY id")).rows,
  get: async (id) => (await pool.query("SELECT * FROM items WHERE id = $1", [id])).rows[0],
  create: async (title) => (await pool.query("INSERT INTO items (title) VALUES ($1) RETURNING *", [title])).rows[0],
  update: async (id, { title, done }) =>
    (
      await pool.query(
        "UPDATE items SET title = COALESCE($2, title), done = COALESCE($3, done) WHERE id = $1 RETURNING *",
        [id, title ?? null, done ?? null],
      )
    ).rows[0],
  remove: async (id) => (await pool.query("DELETE FROM items WHERE id = $1", [id])).rowCount > 0,
};

export const uploads = {
  list: async () => (await pool.query("SELECT * FROM uploads ORDER BY id DESC")).rows,
  get: async (id) => (await pool.query("SELECT * FROM uploads WHERE id = $1", [id])).rows[0],
  create: async ({ key, filename, contentType, size }) =>
    (
      await pool.query(
        "INSERT INTO uploads (key, filename, content_type, size) VALUES ($1, $2, $3, $4) RETURNING *",
        [key, filename, contentType, size],
      )
    ).rows[0],
  remove: async (id) => (await pool.query("DELETE FROM uploads WHERE id = $1 RETURNING *", [id])).rows[0],
};
