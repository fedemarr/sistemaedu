import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
const cli = process.env.APPDATA + "/npm/node_modules/vercel/dist/index.js";
if (!existsSync(cli)) throw new Error("No se encontró Vercel CLI.");
for (const key of [
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
]) {
  const value =
    key === "NEXT_PUBLIC_SITE_URL"
      ? "https://sistemaedu-ten.vercel.app"
      : process.env[key];
  if (!value) throw new Error("Falta " + key);
  const args = [
    cli,
    "env",
    "add",
    key,
    "production",
    "--scope",
    "fmcodes-projects",
    "--yes",
    "--force",
    key === "DATABASE_URL" ? "--sensitive" : "--no-sensitive",
  ];
  const r = spawnSync(process.execPath, args, {
    input: value,
    encoding: "utf8",
    windowsHide: true,
  });
  if (r.status !== 0) {
    console.error(
      "No se pudo configurar " + key,
      String(r.stderr).replaceAll(value, "[REDACTED]"),
    );
    process.exit(1);
  }
  console.info("Configurada:", key);
}
