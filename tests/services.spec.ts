import { test, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import postgres from "postgres";
import ExcelJS from "exceljs";
const pricing = {
  colecta: "180000.00",
  ultima_milla: "200000.00",
  voluminoso_50: "174000.00",
  voluminoso_80: "197000.00",
  voluminoso_110: "227000.00",
  voluminoso_140: "243000.00",
  voluminoso_180: "259000.00",
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
test("tipos de trabajo, tramos, validación SQL, historial de tarifas y exportación", async ({
  page,
  baseURL,
}) => {
  if (!baseURL?.startsWith("http://localhost:"))
    throw new Error("Solo localhost para fixtures.");
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
      await tx`insert into public.vehicles(id,name,service_pricing) values(${vehicle},${tag},${tx.json(pricing)})`;
      await tx`insert into public.employees(id,first_name,role) values(${employee},${tag},'chofer')`;
      await tx`insert into public.employee_assignments(employee_id,vehicle_id,role,start_date) values(${employee},${vehicle},'chofer','2026-01-01')`;
    });
    await assert.rejects(
      sql.begin(async (tx) => {
        await tx`insert into public.work_days(vehicle_id,work_date,worked,revenue_amount,work_type,distance_km,pricing_snapshot) values(${vehicle},'2026-10-20',true,1,'voluminoso',95,${tx.json(pricing)})`;
      }),
      { code: "23514" },
    );
    await assert.rejects(
      sql.begin(async (tx) => {
        await tx`insert into public.work_days(vehicle_id,work_date,worked,revenue_amount,work_type,distance_km,pricing_snapshot) values(${vehicle},'2026-10-20',true,259000,'voluminoso',181,${tx.json(pricing)})`;
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
    async function open(date: string, edit = false) {
      await page.goto("/registro?date=" + date);
      await page
        .locator(".daily-unit")
        .filter({ hasText: tag })
        .getByRole("button", {
          name: edit ? "Editar registro" : "Registrar jornada",
        })
        .click();
      return page.getByRole("dialog");
    }
    let dialog = await open("2026-10-20");
    const type = dialog.getByRole("combobox", {
      name: "¿Qué trabajo realizó?",
      exact: true,
    });
    await expect(
      dialog.getByRole("button", { name: "Registrar jornada", exact: true }),
    ).toBeDisabled();
    await type.selectOption("colecta");
    await expect(dialog.getByLabel("Facturación del día (ARS)")).toHaveValue(
      "180000.00",
    );
    await type.selectOption("ultima_milla");
    await expect(dialog.getByLabel("Facturación del día (ARS)")).toHaveValue(
      "200000.00",
    );
    await type.selectOption("voluminoso");
    await dialog.getByLabel("Kilómetros recorridos").fill("181");
    await expect(
      dialog.getByRole("button", { name: "Registrar jornada", exact: true }),
    ).toBeDisabled();
    await expect(dialog).toContainText("más de 180 km");
    await dialog.getByLabel("Kilómetros recorridos").fill("50");
    await expect(dialog.getByLabel("Facturación del día (ARS)")).toHaveValue(
      "174000.00",
    );
    await dialog.getByLabel("Kilómetros recorridos").fill("50.01");
    await expect(dialog.getByLabel("Facturación del día (ARS)")).toHaveValue(
      "197000.00",
    );
    await dialog.getByLabel("Kilómetros recorridos").fill("95");
    await expect(dialog.getByLabel("Facturación del día (ARS)")).toHaveValue(
      "227000.00",
    );
    await dialog
      .getByRole("button", { name: "Registrar jornada", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    let rows =
      await sql`select revenue_amount::text as amount,distance_km::text as km,work_type,pricing_snapshot from public.work_days where vehicle_id=${vehicle}`;
    expect(rows[0].amount).toBe("227000.00");
    expect(rows[0].km).toBe("95.00");
    expect(rows[0].work_type).toBe("voluminoso");
    await sql`update public.vehicles set service_pricing=${sql.json({ ...pricing, voluminoso_110: "300000.00" })} where id=${vehicle}`;
    dialog = await open("2026-10-20", true);
    await expect(dialog.getByLabel("Facturación del día (ARS)")).toHaveValue(
      "227000.00",
    );
    await dialog
      .getByLabel("Observaciones")
      .fill("Corrección de notas sin cambiar el tarifario.");
    await dialog.getByRole("button", { name: "Actualizar jornada" }).click();
    await expect(dialog).not.toBeVisible();
    rows =
      await sql`select revenue_amount::text as amount from public.work_days where vehicle_id=${vehicle}`;
    expect(rows[0].amount).toBe("227000.00");
    dialog = await open("2026-10-21");
    await dialog
      .getByRole("combobox", { name: "¿Qué trabajo realizó?", exact: true })
      .selectOption("voluminoso");
    await dialog.getByLabel("Kilómetros recorridos").fill("95");
    await expect(dialog.getByLabel("Facturación del día (ARS)")).toHaveValue(
      "300000.00",
    );
    await dialog
      .getByRole("button", { name: "Registrar jornada", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.locator("tr").filter({ hasText: tag }).first(),
    ).toContainText("Voluminoso · 95.00 km");
    const response = await page.request.get(
      `/api/export?from=2026-10-01&to=2026-10-31&vehicle=${vehicle}&format=xlsx`,
    );
    expect(response.ok()).toBeTruthy();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      (await response.body()) as unknown as ExcelJS.Buffer,
    );
    expect(workbook.getWorksheet("Jornadas")!.getCell("G5").value).toBe(
      "Voluminoso",
    );
    expect(workbook.getWorksheet("Jornadas")!.getCell("H5").value).toBe(
      "95.00",
    );
    expect(workbook.getWorksheet("Resumen")!.getCell("B5").value).toBe(527000);
    await page.setViewportSize({ width: 390, height: 844 });
    dialog = await open("2026-10-21", true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await expect(dialog.getByLabel("Kilómetros recorridos")).toBeVisible();
    await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
    dialog = await open("2026-10-22");
    await dialog
      .getByRole("combobox", { name: "Estado de la jornada", exact: true })
      .selectOption("false");
    await dialog
      .getByRole("button", { name: "Registrar jornada", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    dialog = await open("2026-10-22", true);
    await dialog
      .getByRole("combobox", { name: "Estado de la jornada", exact: true })
      .selectOption("true");
    await expect(
      dialog.getByRole("button", { name: "Actualizar jornada", exact: true }),
    ).toBeDisabled();
  } finally {
    await sql.end();
  }
});
