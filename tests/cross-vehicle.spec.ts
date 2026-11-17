import { test, expect } from "@playwright/test";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { today } from "../src/lib/domain";

test("el mismo empleado trabaja en Jornada 1 de dos camionetas y cobra dos jornales", async ({
  page,
  baseURL,
}) => {
  if (!baseURL?.startsWith("http://localhost:"))
    throw new Error("Solo localhost.");
  const sql = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 1 });
  const fixtures = [0, 1].map(() => {
    const vehicle = randomUUID();
    return { vehicle, driver: randomUUID(), tag: "QA-" + vehicle.slice(0, 8) };
  });
  try {
    await sql.begin(async (tx) => {
      for (const f of fixtures) {
        await tx`insert into public.vehicles(id,name,default_daily_rate) values(${f.vehicle},${f.tag},200000)`;
        await tx`insert into public.employees(id,first_name,role) values(${f.driver},${f.tag},'chofer')`;
        await tx`insert into public.salary_settings(employee_id,payment_model,payment_frequency,amount,valid_from) values(${f.driver},'daily','weekly',20000,'2026-01-01')`;
      }
    });
    await page.goto("/login");
    await page.locator('input[name="email"]').fill(process.env.ADMIN_EMAIL!);
    await page
      .locator('input[name="password"]')
      .fill(process.env.ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "Ingresar al sistema" }).click();
    await expect(page).toHaveURL(baseURL + "/");
    await page.goto("/registro?date=" + today());
    for (const f of fixtures) {
      const card = page.locator(".daily-unit").filter({ hasText: f.tag });
      await card
        .getByRole("button", { name: "Registrar jornada", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.locator('input[name="shift_number"]')).toHaveValue(
        "1",
      );
      await dialog
        .locator('select[name="driver_id"]')
        .selectOption(fixtures[0].driver);
      await dialog.locator('input[name="revenue_amount"]').fill("200000");
      await dialog
        .getByRole("button", { name: "Registrar jornada", exact: true })
        .click();
      await expect(dialog).not.toBeVisible();
      await expect(card).toContainText(fixtures[0].tag);
    }
    const [result] =
      await sql`select count(*)::int as jornadas,sum(salary_amount)::text as wages from public.work_day_employees where employee_id=${fixtures[0].driver}`;
    expect(result.jornadas).toBe(2);
    expect(result.wages).toBe("40000.00");
    await page.goto("/sueldos");
    await page.getByRole("button", { name: /Liquidar per/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("combobox", { name: "Empleado", exact: true })
      .selectOption(fixtures[0].driver);
    await expect(dialog.locator(".payroll-preview")).toContainText("40.000");
  } finally {
    // Remove only attendance linking these exact random QA fixtures before their standard cleanup.
    await sql`delete from public.work_day_employees where employee_id=${fixtures[0].driver} and work_day_id in (select id from public.work_days where vehicle_id=${fixtures[1].vehicle})`;
    await sql.end();
    for (const f of fixtures)
      execFileSync(
        process.execPath,
        [
          "--env-file=.env.local",
          "scripts/cleanup-fixture.mjs",
          f.vehicle,
          f.driver,
        ],
        { timeout: 40000, windowsHide: true },
      );
  }
});
