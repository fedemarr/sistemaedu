import { test, expect } from "@playwright/test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
const pricing = {
  fija: "200000.00",
  ambulancia_100: "200000.00",
  ambulancia_50: "100000.00",
  ambulancia_chica: "80000.00",
};
let fixture: { vehicle: string; employee: string } | null = null;
test.afterEach(() => {
  if (fixture) {
    execFileSync(
      process.execPath,
      [
        "--env-file=.env.local",
        "scripts/cleanup-fixture.mjs",
        fixture.vehicle,
        fixture.employee,
      ],
      { timeout: 40000, windowsHide: true },
    );
    fixture = null;
  }
});
test("camioneta 1: fija y ambulancia 100%, 50% y chica con guardado real", async ({
  page,
  baseURL,
}) => {
  if (!baseURL?.startsWith("http://localhost:"))
    throw new Error("Solo localhost.");
  const sql = postgres(process.env.DATABASE_URL!, {
    ssl: "require",
    max: 1,
    prepare: false,
  });
  const vehicle = randomUUID(),
    employee = randomUUID(),
    tag = "QA-" + vehicle.slice(0, 8);
  fixture = { vehicle, employee };
  try {
    await sql.begin(async (tx) => {
      await tx`insert into public.vehicles(id,name,default_daily_rate,service_pricing) values(${vehicle},${tag},200000,${tx.json(pricing)})`;
      await tx`insert into public.employees(id,first_name,role) values(${employee},${tag},'chofer')`;
      await tx`insert into public.employee_assignments(employee_id,vehicle_id,role,start_date) values(${employee},${vehicle},'chofer','2026-01-01')`;
    });
    await assert.rejects(
      sql.begin(async (tx) => {
        await tx`insert into public.work_days(vehicle_id,work_date,worked,revenue_amount,work_type,pricing_snapshot) values(${vehicle},'2026-10-23',true,1,'ambulancia_chica',${tx.json(pricing)})`;
      }),
      { code: "23514" },
    );
    await page.goto("/login");
    await page
      .getByLabel("Correo electrónico", { exact: true })
      .fill(process.env.ADMIN_EMAIL!);
    await page
      .getByLabel("Contraseña", { exact: true })
      .fill(process.env.ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "Ingresar al sistema" }).click();
    await expect(page).toHaveURL(baseURL + "/");
    await page.goto("/registro?date=2026-10-23");
    await page
      .locator(".daily-unit")
      .filter({ hasText: tag })
      .getByRole("button", { name: "Registrar jornada" })
      .click();
    let dialog = page.getByRole("dialog");
    const type = dialog.getByRole("combobox", {
      name: "¿Qué trabajo realizó?",
      exact: true,
    });
    await expect(type).toHaveValue("fija");
    await expect(dialog.getByLabel("Facturación del día (ARS)")).toHaveValue(
      "200000.00",
    );
    await expect(type.locator('option[value="colecta"]')).toHaveCount(0);
    for (const [value, total] of [
      ["ambulancia_100", "200000.00"],
      ["ambulancia_50", "100000.00"],
      ["ambulancia_chica", "80000.00"],
    ]) {
      await type.selectOption(value);
      await expect(dialog.getByLabel("Facturación del día (ARS)")).toHaveValue(
        total,
      );
    }
    await expect(dialog.getByLabel("Kilómetros recorridos")).toHaveCount(0);
    await dialog
      .getByRole("button", { name: "Registrar jornada", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    let rows =
      await sql`select work_type,revenue_amount::text as amount,distance_km from public.work_days where vehicle_id=${vehicle}`;
    expect(rows[0].work_type).toBe("ambulancia_chica");
    expect(rows[0].amount).toBe("80000.00");
    expect(rows[0].distance_km).toBeNull();
    await expect(page.locator("tr").filter({ hasText: tag })).toContainText(
      "Ambulancia chica",
    );
    await sql`update public.vehicles set service_pricing=${sql.json({ ...pricing, ambulancia_chica: "90000.00" })} where id=${vehicle}`;
    await page.goto("/registro?date=2026-10-23");
    await page
      .locator(".daily-unit")
      .filter({ hasText: tag })
      .getByRole("button", { name: "Editar registro" })
      .click();
    dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Facturación del día (ARS)")).toHaveValue(
      "80000.00",
    );
    await dialog
      .getByLabel("Observaciones")
      .fill("Mantener tarifa original de ambulancia chica.");
    await dialog.getByRole("button", { name: "Actualizar jornada" }).click();
    await expect(dialog).not.toBeVisible();
    rows =
      await sql`select revenue_amount::text as amount from public.work_days where vehicle_id=${vehicle}`;
    expect(rows[0].amount).toBe("80000.00");
    await page.goto("/camionetas");
    await page
      .locator(".vehicle-card")
      .filter({ hasText: tag })
      .getByRole("button", { name: "Editar camioneta" })
      .click();
    dialog = page.getByRole("dialog");
    await expect(
      dialog.getByLabel("Ambulancia chica (ARS)", { exact: true }),
    ).toHaveValue("90000.00");
    await expect(
      dialog.getByLabel("Colecta (ARS)", { exact: true }),
    ).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      )
      .toBe(false);
  } finally {
    await sql.end();
  }
});
