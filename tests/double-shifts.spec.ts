import { test, expect } from "@playwright/test";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import ExcelJS from "exceljs";
import { today, currency } from "../src/lib/domain";
let fixture: {
  vehicle: string;
  driver: string;
  helpers: string[];
  tag: string;
} | null = null;
test.afterEach(async () => {
  if (!fixture) return;
  const f = fixture,
    sql = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 1 });
  try {
    await sql.begin(async (tx) => {
      const employees =
        await tx`select first_name from public.employees where id in ${tx(f.helpers)}`;
      if (employees.some((e) => !e.first_name.startsWith(f.tag + " ayudante")))
        throw new Error("Fixture inesperado.");
      const ids =
        await tx`select id::text from public.work_day_employees where employee_id in ${tx(f.helpers)} union all select id::text from public.salary_settings where employee_id in ${tx(f.helpers)} union all select id::text from public.employee_assignments where employee_id in ${tx(f.helpers)}`;
      await tx`delete from public.work_day_employees where employee_id in ${tx(f.helpers)}`;
      await tx`delete from public.salary_settings where employee_id in ${tx(f.helpers)}`;
      await tx`delete from public.employee_assignments where employee_id in ${tx(f.helpers)}`;
      await tx`delete from public.employees where id in ${tx(f.helpers)}`;
      await tx`delete from public.audit_logs where entity_id in ${tx([...f.helpers, ...ids.map((r) => r.id)])}`;
    });
  } finally {
    await sql.end();
  }
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
  fixture = null;
});
for (const mode of ["fija", "reparto"] as const)
  test(`doble jornada en ${mode}: trabajo, equipo, facturación, jornales e historial independientes`, async ({
    page,
    baseURL,
  }) => {
    if (!baseURL?.startsWith("http://localhost:"))
      throw new Error("Solo localhost.");
    const sql = postgres(process.env.DATABASE_URL!, {
        ssl: "require",
        max: 1,
        prepare: false,
      }),
      vehicle = randomUUID(),
      driver = randomUUID(),
      helpers = [randomUUID(), randomUUID()],
      tag = "QA-" + vehicle.slice(0, 8),
      date = today();
    fixture = { vehicle, driver, helpers, tag };
    const pricing =
      mode === "fija"
        ? {
            fija: "200000.00",
            ambulancia_100: "200000.00",
            ambulancia_50: "100000.00",
            ambulancia_chica: "80000.00",
          }
        : {
            colecta: "180000.00",
            ultima_milla: "200000.00",
            voluminoso_50: "174000.00",
            voluminoso_80: "197000.00",
            voluminoso_110: "227000.00",
            voluminoso_140: "243000.00",
            voluminoso_180: "259000.00",
          };
    const total = mode === "fija" ? "400000.00" : "407000.00";
    try {
      await sql.begin(async (tx) => {
        await tx`insert into public.vehicles(id,name,service_pricing) values(${vehicle},${tag},${tx.json(pricing)})`;
        await tx`insert into public.employees(id,first_name,role) values(${driver},${tag},'chofer'),(${helpers[0]},${tag + " ayudante1"},'ayudante'),(${helpers[1]},${tag + " ayudante2"},'ayudante')`;
        for (const [employee, amount] of [
          [driver, "20000"],
          [helpers[0], "10000"],
          [helpers[1], "12000"],
        ])
          await tx`insert into public.salary_settings(employee_id,payment_model,payment_frequency,amount,valid_from) values(${employee},'daily','weekly',${amount},'2026-01-01')`;
        await tx`insert into public.employee_assignments(employee_id,vehicle_id,role,start_date) values(${driver},${vehicle},'chofer','2026-01-01'),(${helpers[0]},${vehicle},'ayudante','2026-01-01')`;
      });
      await page.goto("/login");
      await page
        .getByLabel("Correo electrónico", { exact: true })
        .fill(process.env.ADMIN_EMAIL!);
      await page
        .getByLabel("Contraseña", { exact: true })
        .fill(process.env.ADMIN_PASSWORD!);
      await page.getByRole("button", { name: "Ingresar al sistema" }).click();
      await expect(page).toHaveURL(baseURL + "/");
      await page.goto("/registro?date=" + date);
      const card = page.locator(".daily-unit").filter({ hasText: tag });
      await card
        .getByRole("button", { name: "Registrar jornada", exact: true })
        .click();
      let dialog = page.getByRole("dialog");
      if (mode === "reparto")
        await dialog
          .getByRole("combobox", { name: "¿Qué trabajo realizó?", exact: true })
          .selectOption("colecta");
      await expect(
        dialog.getByRole("combobox", {
          name: "Ayudante que trabajó",
          exact: true,
        }),
      ).toHaveValue(helpers[0]);
      await dialog
        .getByRole("button", { name: "Registrar jornada", exact: true })
        .click();
      await expect(dialog).not.toBeVisible();
      await card
        .getByRole("button", { name: "Agregar segunda jornada" })
        .click();
      dialog = page.getByRole("dialog");
      await expect(dialog.locator('input[name="shift_number"]')).toHaveValue(
        "2",
      );
      const work = dialog.getByRole("combobox", {
        name: "¿Qué trabajo realizó?",
        exact: true,
      });
      if (mode === "fija") {
        await work.selectOption("ambulancia_50");
        await expect(
          dialog.getByLabel("Facturación del día (ARS)"),
        ).toHaveValue("100000.00");
        await work.selectOption("fija");
      } else {
        await work.selectOption("voluminoso");
        await dialog.getByLabel("Kilómetros recorridos").fill("95");
      }
      await dialog
        .getByRole("combobox", { name: "Ayudante que trabajó", exact: true })
        .selectOption(helpers[1]);
      await dialog
        .getByRole("button", { name: "Registrar jornada", exact: true })
        .click();
      await expect(dialog).not.toBeVisible();
      await expect(
        card.getByRole("region", { name: "Jornada 1", exact: true }),
      ).toContainText(tag + " ayudante1");
      await expect(
        card.getByRole("region", { name: "Jornada 2", exact: true }),
      ).toContainText(tag + " ayudante2");
      await expect(card.locator(".day-total")).toContainText(currency(total));
      await expect(
        card.getByRole("button", { name: "Agregar segunda jornada" }),
      ).toHaveCount(0);
      const journals =
        await sql`select shift_number,revenue_amount::text as revenue from public.work_days where vehicle_id=${vehicle} order by shift_number`;
      expect(journals).toHaveLength(2);
      expect(journals.map((d) => d.shift_number)).toEqual([1, 2]);
      const wages =
        await sql`select sum(a.salary_amount)::text as total,count(*)::int as attendance from public.work_day_employees a join public.work_days d on d.id=a.work_day_id where d.vehicle_id=${vehicle}`;
      expect(wages[0].total).toBe("62000.00");
      expect(wages[0].attendance).toBe(4);
      await card
        .getByRole("region", { name: "Jornada 2", exact: true })
        .getByRole("button", { name: "Editar registro" })
        .click();
      dialog = page.getByRole("dialog");
      await expect(
        dialog.getByRole("combobox", {
          name: "Ayudante que trabajó",
          exact: true,
        }),
      ).toHaveValue(helpers[1]);
      await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
      await page.goto("/");
      const dashboard = page.locator(".vehicle-card").filter({ hasText: tag });
      await expect(dashboard).toContainText("Doble jornada");
      await expect(dashboard.locator(".vehicle-numbers")).toContainText(
        currency(total),
      );
      const response = await page.request.get(
        `/api/export?from=${date}&to=${date}&vehicle=${vehicle}&format=xlsx`,
      );
      expect(response.ok()).toBeTruthy();
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(
        (await response.body()) as unknown as ExcelJS.Buffer,
      );
      expect(book.getWorksheet("Resumen")!.getCell("B5").value).toBe(
        Number(total),
      );
      expect(book.getWorksheet("Resumen")!.getCell("B7").value).toBe(62000);
      expect(book.getWorksheet("Jornadas")!.getCell("I5").value).toBe(1);
      expect(book.getWorksheet("Jornadas")!.getCell("I6").value).toBe(2);
      await page.goto("/sueldos");
      await page.getByRole("button", { name: "Liquidar período" }).click();
      dialog = page.getByRole("dialog");
      await dialog
        .getByRole("combobox", { name: "Empleado", exact: true })
        .selectOption(driver);
      await expect(dialog.locator(".payroll-preview")).toContainText("40.000");
      await expect(dialog.locator(".payroll-preview")).toContainText(
        "Jornadas efectivamente trabajadas",
      );
      await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/registro?date=" + date);
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
        )
        .toBe(false);
      await expect(
        page
          .locator(".daily-unit")
          .filter({ hasText: tag })
          .getByRole("region", { name: "Jornada 2", exact: true }),
      ).toBeVisible();
    } finally {
      await sql.end();
    }
  });
