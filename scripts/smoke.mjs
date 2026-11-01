import { chromium } from "@playwright/test";
import fs from "node:fs";
fs.mkdirSync("test-results", { recursive: true });
const baseURL = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
page.on("pageerror", (e) => console.info("PAGE ERROR:", e.message));
await page.goto(baseURL);
await page.screenshot({ path: "test-results/login.png", fullPage: true });
await page
  .getByLabel("Correo electrónico", { exact: true })
  .fill(process.env.ADMIN_EMAIL);
await page
  .getByLabel("Contraseña", { exact: true })
  .fill(process.env.ADMIN_PASSWORD);
await page.getByRole("button", { name: "Ingresar al sistema" }).click();
await page.waitForURL(baseURL + "/", { timeout: 60000 });
await page
  .getByRole("heading", { name: "Tu gestión, al día." })
  .waitFor({ timeout: 60000 });
console.info("LOGIN OK");
await page.screenshot({ path: "test-results/dashboard.png", fullPage: true });
for (const path of [
  "registro",
  "camionetas",
  "empleados",
  "sueldos",
  "gastos",
  "reportes",
  "configuracion",
]) {
  await page.goto(baseURL + "/" + path);
  await page.locator("main h1").waitFor();
  console.info(path, await page.locator("main h1").innerText());
}
for (const format of ["xlsx", "pdf"]) {
  const response = await page.request.get(
    baseURL + "/api/export?format=" + format,
  );
  if (!response.ok()) throw new Error("Falló la exportación " + format);
  console.info("EXPORT OK:", format, response.headers()["content-type"]);
}
await page.goto(baseURL + "/");
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
console.info(
  "mobile overflow",
  await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  ),
);
await page.setViewportSize({ width: 1440, height: 1050 });
await page
  .locator(".sidebar")
  .getByRole("button", { name: "Cerrar sesión" })
  .click();
await page.waitForURL(baseURL + "/login");
await page.goto(baseURL + "/reportes");
if (!page.url().endsWith("/login"))
  throw new Error("La ruta privada no se protegió después de salir.");
console.info("LOGOUT AND ROUTE PROTECTION OK");
await browser.close();
