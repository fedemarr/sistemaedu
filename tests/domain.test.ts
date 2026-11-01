import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sum,
  report,
  period,
  dates,
  fixedDaily,
  payrollPreview,
  balance,
  today,
  addDays,
} from "../src/lib/domain";
import type { Data } from "../src/lib/types";
function fixture(): Data {
  return {
    vehicles: [],
    employees: [
      {
        id: "edu",
        first_name: "Eduardo",
        last_name: "Martínez",
        role: "chofer",
        is_active: true,
        notes: null,
      },
      {
        id: "fede",
        first_name: "Federico",
        last_name: "Martínez",
        role: "ayudante",
        is_active: true,
        notes: null,
      },
    ],
    assignments: [],
    salaries: [
      {
        id: "salary1",
        employee_id: "edu",
        payment_model: "biweekly",
        payment_frequency: "biweekly",
        amount: "300000.00",
        valid_from: "2026-01-01",
        valid_until: null,
      },
      {
        id: "salary2",
        employee_id: "fede",
        payment_model: "daily",
        payment_frequency: "weekly",
        amount: "30000.00",
        valid_from: "2026-01-01",
        valid_until: null,
      },
    ],
    days: [
      {
        id: "d1",
        vehicle_id: "v1",
        work_date: "2026-10-05",
        worked: true,
        revenue_amount: "200000.00",
        notes: null,
        updated_at: "",
      },
      {
        id: "d2",
        vehicle_id: "v2",
        work_date: "2026-10-05",
        worked: true,
        revenue_amount: "180000.00",
        notes: null,
        updated_at: "",
      },
    ],
    attendance: [
      {
        id: "a1",
        work_day_id: "d1",
        employee_id: "fede",
        role: "ayudante",
        salary_amount: "30000.00",
        salary_model: "daily",
      },
    ],
    categories: [{ id: "fuel", name: "Combustible", is_active: true }],
    expenses: [],
    fuel: [],
    payroll: [],
    payments: [],
    collections: [],
    accruals: [],
    company: { name: "Test" },
    audit: [],
  };
}
test("ambas camionetas suman sus ingresos; solo una trabajando deja la otra en cero", () => {
  const d = fixture();
  assert.equal(report(d, "2026-10-05", "2026-10-05").revenue, "380000.00");
  d.days[1].worked = false;
  d.days[1].revenue_amount = "0";
  assert.equal(report(d, "2026-10-05", "2026-10-05").revenue, "200000.00");
});
test("corregir un importe pasado afecta únicamente esa jornada", () => {
  const d = fixture();
  d.days[0].revenue_amount = "220000.00";
  assert.equal(report(d, "2026-10-05", "2026-10-05").revenue, "400000.00");
  assert.equal(d.days[1].revenue_amount, "180000.00");
});
test("Federico se liquida semanalmente por las jornadas efectivas y la tarifa histórica", () => {
  const d = fixture();
  d.salaries[1].amount = "90000.00";
  const p = payrollPreview(d, "fede", "2026-10-05", "2026-10-11");
  assert.equal(p.gross, "30000.00");
  assert.equal(p.days, 1);
});
test("Eduardo recibe un fijo quincenal sin multiplicarlo por jornadas", () => {
  const d = fixture();
  const p = payrollPreview(d, "edu", "2026-10-01", "2026-10-15");
  assert.equal(p.gross, "300000.00");
});
test("devengamiento fijo respeta el total incluso con períodos de 28,29,30,31 días", () => {
  for (const month of ["2024-02", "2026-02", "2026-04", "2026-10"]) {
    const [s, e] = period(month + "-01", "monthly");
    assert.equal(
      sum(dates(s, e).map((d) => fixedDaily("100000.01", "monthly", d))),
      "100000.01",
    );
  }
});
test("la segunda quincena tiene su propio importe exacto", () => {
  const [s, e] = period("2026-10-20", "biweekly");
  assert.equal(
    sum(dates(s, e).map((d) => fixedDaily("300000", "biweekly", d))),
    "300000.00",
  );
});
test("un pago parcial conserva el saldo y no duplica gasto salarial", () => {
  const d = fixture();
  d.payroll.push({
    id: "p",
    employee_id: "fede",
    start_date: "2026-10-05",
    end_date: "2026-10-11",
    days_worked: 1,
    gross_amount: "30000",
    adjustments: "0",
    total_amount: "30000",
    notes: null,
    voided_at: null,
    closed_at: "",
  });
  d.accruals.push({
    payroll_period_id: "p",
    accrual_date: "2026-10-05",
    vehicle_id: "v1",
    amount: "30000",
  });
  const before = report(d, "2026-10-05", "2026-10-11").salary;
  d.payments.push({
    id: "payment",
    payroll_period_id: "p",
    payment_date: "2026-10-11",
    amount: "10000",
    payment_method: null,
    notes: null,
    voided_at: null,
  });
  assert.equal(balance("30000", d.payments), "20000.00");
  assert.equal(report(d, "2026-10-05", "2026-10-11").salary, before);
  assert.equal(report(d, "2026-10-05", "2026-10-11").outgoing, "10000.00");
});
test("combustible modifica el resultado solo de la camioneta asignada", () => {
  const d = fixture();
  d.expenses.push({
    id: "e",
    vehicle_id: "v1",
    category_id: "fuel",
    expense_date: "2026-10-05",
    description: "Carga",
    amount: "10000",
    payment_date: null,
    payment_method: null,
    notes: null,
    voided_at: null,
    updated_at: "",
  });
  assert.equal(report(d, "2026-10-05", "2026-10-05", "v1").net, "160000.00");
  assert.equal(report(d, "2026-10-05", "2026-10-05", "v2").net, "180000.00");
});
test("resultado mensual coincide y cobros/pagos se cuentan por fecha efectiva", () => {
  const d = fixture();
  d.collections.push({
    id: "c",
    work_day_id: "d1",
    collection_date: "2026-11-01",
    amount: "200000",
    payment_method: null,
    notes: null,
    voided_at: null,
  });
  const r = report(d, "2026-10-01", "2026-10-31");
  assert.equal(r.salary, "630000.00");
  assert.equal(r.net, "-250000.00");
  assert.equal(r.receipts, "0.00");
  assert.equal(report(d, "2026-11-01", "2026-11-01").receipts, "200000.00");
});
test("liquidaciones cerradas conservan su costo después de un cambio salarial", () => {
  const d = fixture();
  d.payroll.push({
    id: "p",
    employee_id: "edu",
    start_date: "2026-10-01",
    end_date: "2026-10-15",
    days_worked: 0,
    gross_amount: "300000",
    adjustments: "0",
    total_amount: "300000",
    notes: null,
    voided_at: null,
    closed_at: "",
  });
  for (const date of dates("2026-10-01", "2026-10-15"))
    d.accruals.push({
      payroll_period_id: "p",
      accrual_date: date,
      vehicle_id: null,
      amount: "20000",
    });
  d.salaries[0].amount = "999999";
  assert.equal(report(d, "2026-10-01", "2026-10-15").salary, "330000.00");
});
test("anular un cobro lo excluye de caja y devuelve su saldo", () => {
  const c = { amount: "100", voided_at: "2026-11-01" };
  assert.equal(balance("200", [c]), "200.00");
});
test("semanas cruzan meses y años sin depender de la zona horaria del servidor", () => {
  assert.deepEqual(period("2026-11-01", "weekly"), [
    "2026-10-26",
    "2026-11-01",
  ]);
  assert.deepEqual(period("2027-01-01", "weekly"), [
    "2026-12-28",
    "2027-01-03",
  ]);
});
test("los salarios fijos no se devengan en fechas futuras", () => {
  const d = fixture();
  const future = addDays(today(), 1);
  assert.equal(report(d, future, addDays(future, 10)).salary, "0.00");
});
test("el reporte advierte salarios pendientes y cuenta cobros de jornadas de otro año", () => {
  const d = fixture();
  d.attendance[0].salary_amount = null;
  assert.equal(report(d, "2026-10-01", "2026-10-31").missingSalaries, 1);
  d.collections.push({
    id: "c",
    work_day_id: "old-day",
    vehicle_id: "v1",
    work_date: "2025-12-30",
    collection_date: "2026-10-01",
    amount: "150000",
    payment_method: null,
    notes: null,
    voided_at: null,
  });
  assert.equal(
    report(d, "2026-10-01", "2026-10-31", "v1").receipts,
    "150000.00",
  );
});
