import postgres from "postgres";
import { readFileSync, readdirSync } from "node:fs";
const sql = postgres(process.env.DATABASE_URL, {
  ssl: "require",
  max: 1,
  prepare: false,
});
try {
  await sql`create table if not exists public.app_migrations(name text primary key, applied_at timestamptz default now())`;
  await sql`alter table public.app_migrations enable row level security`;
  for (const name of readdirSync("supabase/migrations")
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    if (
      (await sql`select name from public.app_migrations where name=${name}`)
        .length
    )
      continue;
    await sql.begin(async (tx) => {
      await tx.unsafe(readFileSync("supabase/migrations/" + name, "utf8"));
      await tx`insert into public.app_migrations(name) values(${name})`;
    });
    console.info("Migración aplicada:", name);
  }
} finally {
  await sql.end();
}
