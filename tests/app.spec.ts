import { test, expect } from "@playwright/test";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
test("flujo real: jornada, corrección, combustible, liquidación, pago parcial, cobro y exportaciones", async ({
  page,
  baseURL,
}) => {
  if (!baseURL?.startsWith("http://localhost:"))
    throw new Error(
      "Las pruebas con fixtures solo pueden ejecutarse en localhost.",
    );
  const sql = postgres(process.env.DATABASE_URL!, {
    ssl: "require",
    max: 1,
    prepare: false,
  });
  const vehicle = randomUUID(),
    employee = randomUUID();
  const tag = "QA-" + vehicle.slice(0, 8);
  try {
    await sql.begin(async (tx) => {
      await tx`insert into public.vehicles(id,name,default_daily_rate) values(${vehicle},${tag},200000)`;
      await tx`insert into public.employees(id,first_name,role) values(${employee},${tag},'chofer')`;
      await tx`insert into public.salary_settings(employee_id,payment_model,payment_frequency,amount,valid_from) values(${employee},'daily','weekly',20000,'2026-01-01')`;
      await tx`insert into public.employee_assignments(employee_id,vehicle_id,role,start_date) values(${employee},${vehicle},'chofer','2026-01-01')`;
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
    await page.goto("/registro?date=2026-10-19");
    await page
      .locator(".daily-unit")
      .filter({ hasText: tag })
      .getByRole("button", { name: "Registrar jornada" })
      .click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Facturación del día (ARS)").fill("200000");
    await dialog
      .getByRole("button", { name: "Registrar jornada", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    await page
      .locator(".daily-unit")
      .filter({ hasText: tag })
      .getByRole("button", { name: "Editar registro" })
      .click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Facturación del día (ARS)").fill("220000");
    await dialog.getByRole("button", { name: "Actualizar jornada" }).click();
    await expect(dialog).not.toBeVisible();
    expect(
      (
        await sql`select revenue_amount::text as amount from public.work_days where vehicle_id=${vehicle}`
      )[0].amount,
    ).toBe("220000.00");
    expect(
      (
        await sql`select count(*)::int as count from public.work_days where vehicle_id=${vehicle}`
      )[0].count,
    ).toBe(1);
    await sql`update public.vehicles set default_daily_rate=300000 where id=${vehicle}`;
    expect(
      (
        await sql`select revenue_amount::text as amount from public.work_days where vehicle_id=${vehicle}`
      )[0].amount,
    ).toBe("220000.00");
    await page.goto("/gastos");
    await page
      .getByRole("button", { name: "Nuevo gasto", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Fecha del gasto").fill("2026-10-19");
    await dialog
      .getByRole("combobox", { name: "Camioneta", exact: true })
      .selectOption(vehicle);
    await dialog.getByLabel("Importe (ARS)", { exact: true }).fill("10000");
    await dialog
      .getByLabel("Descripción", { exact: true })
      .fill(tag + " combustible");
    await dialog.getByLabel("Cantidad de tanques / cargas").fill("2");
    await dialog
      .getByRole("button", { name: "Registrar gasto", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    await page.goto("/sueldos");
    await page.getByRole("button", { name: "Liquidar período" }).click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByRole("combobox", { name: "Empleado", exact: true })
      .selectOption(employee);
    await dialog
      .getByLabel("Elegí una fecha dentro del período")
      .fill("2026-10-19");
    await expect(dialog.locator(".payroll-preview")).toContainText("20.000");
    await dialog.getByRole("button", { name: "Cerrar liquidación" }).click();
    await expect(dialog).not.toBeVisible();
    await page
      .locator("tr")
      .filter({ hasText: tag })
      .getByRole("button", { name: "Pagar", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Importe (ARS)", { exact: true }).fill("10000");
    await dialog
      .getByRole("button", { name: "Registrar pago", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page
        .locator("tr")
        .filter({ hasText: tag })
        .filter({ hasText: "Parcial" }),
    ).toContainText("10.000");
    await page
      .locator("tr")
      .filter({ hasText: tag })
      .getByRole("button", { name: "Pagar", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Importe (ARS)", { exact: true }).fill("15000");
    await dialog
      .getByRole("button", { name: "Registrar pago", exact: true })
      .click();
    await expect(dialog.getByRole("status")).toContainText("supera el saldo");
    await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
    await page.goto("/registro?date=2026-10-19");
    await page
      .locator("tr")
      .filter({ hasText: tag })
      .getByRole("button", { name: "Cobrar", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Importe (ARS)", { exact: true }).fill("25000");
    await dialog.getByRole("button", { name: "Registrar cobro" }).click();
    await expect(dialog).not.toBeVisible();
    const response = await page.request.get(
      `/api/export?from=2026-10-01&to=2026-10-31&vehicle=${vehicle}&format=xlsx`,
    );
    expect(response.ok()).toBeTruthy();
    const book = new ExcelJS.Workbook();
    await book.xlsx.load((await response.body()) as unknown as ExcelJS.Buffer);
    expect(book.getWorksheet("Resumen")!.getCell("B5").value).toBe(220000);
    expect(book.getWorksheet("Resumen")!.getCell("B8").value).toBe(190000);
    const pdf = await page.request.get(
      `/api/export?from=2026-10-01&to=2026-10-31&vehicle=${vehicle}&format=pdf`,
    );
    expect(pdf.ok()).toBeTruthy();
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
    expect((await pdf.body()).toString("latin1")).toContain("220.000");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Abrir menú" }).click();
    await expect(page.locator(".sidebar")).toHaveClass(/is-open/);
    await page
      .locator(".sidebar")
      .getByRole("link", { name: "Registro diario", exact: true })
      .click();
    await expect(page.locator("main h1")).toContainText("Cada jornada");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
  } finally {
    // Only rows created for these random fixture IDs are removed. All real company records remain untouched.
    await sql.begin(async (tx) => {
      const ids = await tx<
        { id: string }[]
      >`select id::text from public.work_days where vehicle_id=${vehicle} union all select id::text from public.expenses where vehicle_id=${vehicle} union all select id::text from public.payroll_periods where employee_id=${employee} union all select id::text from public.payroll_payments where payroll_period_id in (select id from public.payroll_periods where employee_id=${employee}) union all select id::text from public.collections where work_day_id in (select id from public.work_days where vehicle_id=${vehicle}) union all select id::text from public.salary_settings where employee_id=${employee} union all select id::text from public.employee_assignments where employee_id=${employee} union all select id::text from public.work_day_employees where employee_id=${employee} union all select id::text from public.fuel_records where expense_id in (select id from public.expenses where vehicle_id=${vehicle})`;
      await tx`delete from public.payroll_payments where payroll_period_id in (select id from public.payroll_periods where employee_id=${employee})`;
      await tx`delete from public.payroll_accruals where payroll_period_id in (select id from public.payroll_periods where employee_id=${employee})`;
      await tx`delete from public.payroll_allocations where payroll_period_id in (select id from public.payroll_periods where employee_id=${employee})`;
      await tx`delete from public.payroll_periods where employee_id=${employee}`;
      await tx`delete from public.collections where work_day_id in (select id from public.work_days where vehicle_id=${vehicle})`;
      await tx`delete from public.work_day_employees where employee_id=${employee}`;
      await tx`delete from public.work_days where vehicle_id=${vehicle}`;
      await tx`delete from public.fuel_records where expense_id in (select id from public.expenses where vehicle_id=${vehicle})`;
      await tx`delete from public.expenses where vehicle_id=${vehicle}`;
      await tx`delete from public.employee_assignments where employee_id=${employee}`;
      await tx`delete from public.salary_settings where employee_id=${employee}`;
      await tx`delete from public.employees where id=${employee}`;
      await tx`delete from public.vehicles where id=${vehicle}`;
      await tx`delete from public.audit_logs where entity_id in ${tx([vehicle, employee, ...ids.map((r) => r.id)])}`;
    });
    await sql.end();
  }
});
test("sin sesión, las rutas y exportaciones están protegidas", async ({
  page,
  request,
}) => {
  for (const path of [
    "/",
    "/registro",
    "/camionetas",
    "/empleados",
    "/sueldos",
    "/gastos",
    "/reportes",
    "/configuracion",
    "/api/export?format=xlsx",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
  const r = await request.get(
    process.env.NEXT_PUBLIC_SUPABASE_URL + "/rest/v1/vehicles?select=id",
    {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        Authorization:
          "Bearer " + process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      },
    },
  );
  expect([401, 403]).toContain(r.status());
});
