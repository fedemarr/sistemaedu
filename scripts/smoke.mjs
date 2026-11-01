import { chromium } from "@playwright/test";
import fs from "node:fs";
fs.mkdirSync("test-results", { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
page.on("pageerror", (e) => console.info("PAGE ERROR:", e.message));
await page.goto("http://localhost:3000");
await page.screenshot({ path: "test-results/login.png", fullPage: true });
await page
  .getByLabel("Correo electrónico", { exact: true })
  .fill(process.env.ADMIN_EMAIL);
await page
  .getByLabel("Contraseña", { exact: true })
  .fill(process.env.ADMIN_PASSWORD);
await page.getByRole("button", { name: "Ingresar al sistema" }).click();
await page.waitForURL("http://localhost:3000/", { timeout: 60000 });
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
  await page.goto("http://localhost:3000/" + path);
  await page.locator("main h1").waitFor();
  console.info(path, await page.locator("main h1").innerText());
}
await page.goto("http://localhost:3000/");
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
console.info(
  "mobile overflow",
  await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  ),
);
await browser.close();
