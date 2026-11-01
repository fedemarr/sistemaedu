// Recovery helper for a browser test interrupted by a worker timeout.
// Requires both exact random IDs and validates the generated QA names before touching any row.
import postgres from "postgres";
const [vehicle, employee] = process.argv.slice(2);
if (![vehicle, employee].every((id) => /^[0-9a-f-]{36}$/.test(id ?? "")))
  throw new Error(
    "Indicá los UUID exactos de la camioneta y el empleado de prueba.",
  );
const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1 });
try {
  await sql.begin(async (tx) => {
    const v = await tx`select name from public.vehicles where id=${vehicle}`;
    const e =
      await tx`select first_name from public.employees where id=${employee}`;
    if (!v.length && !e.length) return;
    if (
      v[0]?.name !== "QA-" + vehicle.slice(0, 8) ||
      e[0]?.first_name !== v[0]?.name
    )
      throw new Error("Los registros no son el fixture esperado.");
    const ids =
      await tx`select id::text from public.work_days where vehicle_id=${vehicle} union all select id::text from public.expenses where vehicle_id=${vehicle} union all select id::text from public.payroll_periods where employee_id=${employee} union all select id::text from public.payroll_payments where payroll_period_id in (select id from public.payroll_periods where employee_id=${employee}) union all select id::text from public.collections where work_day_id in (select id from public.work_days where vehicle_id=${vehicle}) union all select id::text from public.salary_settings where employee_id=${employee} union all select id::text from public.employee_assignments where employee_id=${employee} union all select id::text from public.work_day_employees where employee_id=${employee} union all select id::text from public.fuel_records where expense_id in (select id from public.expenses where vehicle_id=${vehicle})`;
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
  console.info("Fixture retirado.");
} finally {
  await sql.end();
}
