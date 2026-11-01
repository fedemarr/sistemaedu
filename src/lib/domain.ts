import Decimal from "decimal.js";
import type { Accrual, Data, Frequency, Model } from "./types";
export const money = (n: Decimal.Value) =>
  new Decimal(n).toDecimalPlaces(2).toFixed(2);
export const sum = (values: Decimal.Value[]) =>
  money(values.reduce<Decimal>((a, b) => a.plus(b), new Decimal(0)));
export const currency = (n: Decimal.Value) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: new Decimal(n).isInteger() ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Number(n));
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const dateLabel = (s: string) =>
  new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(s.slice(0, 10) + "T12:00:00Z"));
export function addDays(s: string, n: number) {
  const d = new Date(s + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function dates(start: string, end: string) {
  const a: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) a.push(d);
  return a;
}
export function period(date: string, frequency: Frequency): [string, string] {
  const d = new Date(date + "T12:00:00Z");
  const month = date.slice(0, 7);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);
  if (frequency === "monthly") return [month + "-01", last];
  if (frequency === "biweekly")
    return d.getUTCDate() <= 15
      ? [month + "-01", month + "-15"]
      : [month + "-16", last];
  const start = addDays(date, -((d.getUTCDay() + 6) % 7));
  return [start, addDays(start, 6)];
}
export function fixedDaily(
  amount: string,
  model: Exclude<Model, "daily">,
  date: string,
) {
  const [s, e] = period(date, model);
  const count = dates(s, e).length;
  // Cumulative rounding keeps each complete period exactly equal to its configured amount.
  const index = dates(s, date).length;
  return money(
    new Decimal(amount)
      .mul(index)
      .div(count)
      .toDecimalPlaces(2)
      .minus(
        new Decimal(amount)
          .mul(index - 1)
          .div(count)
          .toDecimalPlaces(2),
      ),
  );
}
export function openAccruals(
  data: Data,
  start: string,
  end: string,
  employeeId?: string,
): Accrual[] {
  const result: Accrual[] = [];
  for (const employee of data.employees.filter(
    (e) => !employeeId || e.id === employeeId,
  )) {
    for (const date of dates(start, end < today() ? end : today())) {
      if (
        data.payroll.some(
          (p) =>
            !p.voided_at &&
            p.employee_id === employee.id &&
            p.start_date <= date &&
            p.end_date >= date,
        )
      )
        continue;
      const salary = data.salaries.find(
        (s) =>
          s.employee_id === employee.id &&
          s.valid_from <= date &&
          (!s.valid_until || s.valid_until >= date),
      );
      if (
        salary?.payment_model &&
        salary.amount !== null &&
        salary.payment_model !== "daily"
      ) {
        result.push({
          employee_id: employee.id,
          accrual_date: date,
          vehicle_id: null,
          amount: fixedDaily(salary.amount, salary.payment_model, date),
        });
      }
      for (const day of data.days.filter(
        (d) => d.worked && d.work_date === date,
      )) {
        const a = data.attendance.find(
          (a) => a.work_day_id === day.id && a.employee_id === employee.id,
        );
        if (a?.salary_model === "daily" && a.salary_amount !== null)
          result.push({
            employee_id: employee.id,
            accrual_date: date,
            vehicle_id: day.vehicle_id,
            amount: a.salary_amount,
          });
      }
    }
  }
  return result;
}
export function payrollPreview(
  data: Data,
  employeeId: string,
  start: string,
  end: string,
) {
  const salary =
    data.salaries.find(
      (s) =>
        s.employee_id === employeeId &&
        s.valid_from <= end &&
        (!s.valid_until || s.valid_until >= start) &&
        s.payment_model &&
        s.payment_frequency &&
        s.amount !== null,
    ) ??
    data.salaries.find(
      (s) =>
        s.employee_id === employeeId &&
        !s.valid_until &&
        s.payment_model === "daily",
    );
  if (
    !salary?.payment_model ||
    !salary.payment_frequency ||
    salary.amount === null
  )
    throw new Error(
      "Configurá primero la modalidad, frecuencia y el importe salarial.",
    );
  const expected = period(start, salary.payment_frequency);
  if (expected[0] !== start || expected[1] !== end)
    throw new Error(
      "Elegí un período completo según la frecuencia configurada.",
    );
  if (
    data.payroll.some(
      (p) =>
        !p.voided_at &&
        p.employee_id === employeeId &&
        p.start_date <= end &&
        p.end_date >= start,
    )
  )
    throw new Error("Ese período ya tiene una liquidación cerrada.");
  const lines = openAccruals(data, start, end, employeeId);
  const worked = data.attendance.filter(
    (a) =>
      a.employee_id === employeeId &&
      data.days.some(
        (d) =>
          d.id === a.work_day_id &&
          d.worked &&
          d.work_date >= start &&
          d.work_date <= end,
      ),
  );
  if (worked.some((a) => a.salary_model === null || a.salary_amount === null))
    throw new Error(
      "Hay jornadas sin salario configurado. Corregí sus importes antes de liquidar.",
    );
  return { lines, gross: sum(lines.map((l) => l.amount)), days: worked.length };
}
export function balance(
  total: string,
  payments: { amount: string; voided_at: string | null }[],
) {
  return money(
    new Decimal(total).minus(
      sum(payments.filter((p) => !p.voided_at).map((p) => p.amount)),
    ),
  );
}
export function report(data: Data, start: string, end: string, vehicleId = "") {
  const inRange = (date: string) => date >= start && date <= end;
  const days = data.days.filter(
    (d) => inRange(d.work_date) && (!vehicleId || d.vehicle_id === vehicleId),
  );
  const expenses = data.expenses.filter(
    (e) =>
      !e.voided_at &&
      inRange(e.expense_date) &&
      (!vehicleId || e.vehicle_id === vehicleId),
  );
  const accrued = [
    ...openAccruals(data, start, end),
    ...data.accruals.filter(
      (a) =>
        inRange(a.accrual_date) &&
        data.payroll.some((p) => p.id === a.payroll_period_id && !p.voided_at),
    ),
  ].filter((a) => !vehicleId || a.vehicle_id === vehicleId);
  const revenue = sum(days.map((d) => d.revenue_amount)),
    cost = sum(expenses.map((e) => e.amount)),
    salary = sum(accrued.map((a) => a.amount));
  const missingSalaries = data.attendance.filter(
    (a) =>
      (a.salary_model === null || a.salary_amount === null) &&
      days.some((d) => d.worked && d.id === a.work_day_id),
  ).length;
  const collections = data.collections.filter(
    (c) =>
      !c.voided_at &&
      inRange(c.collection_date) &&
      (!vehicleId ||
        c.vehicle_id === vehicleId ||
        data.days.some(
          (d) => d.id === c.work_day_id && d.vehicle_id === vehicleId,
        )),
  );
  const paidExpenses = data.expenses.filter(
    (e) =>
      !e.voided_at &&
      e.payment_date &&
      inRange(e.payment_date) &&
      (!vehicleId || e.vehicle_id === vehicleId),
  );
  const paidSalaries = vehicleId
    ? []
    : data.payments.filter((p) => !p.voided_at && inRange(p.payment_date));
  const receipts = sum(collections.map((c) => c.amount)),
    outgoing = sum([
      ...paidExpenses.map((e) => e.amount),
      ...paidSalaries.map((p) => p.amount),
    ]);
  return {
    days,
    expenses,
    accrued,
    revenue,
    cost,
    salary,
    missingSalaries,
    net: money(new Decimal(revenue).minus(cost).minus(salary)),
    receipts,
    outgoing,
    cash: money(new Decimal(receipts).minus(outgoing)),
    worked: days.filter((d) => d.worked).length,
  };
}
