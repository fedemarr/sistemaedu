"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import Decimal from "decimal.js";
import { asAdmin, db, loadData, type Tx } from "@/lib/db";
import { requireAdmin, supabase } from "@/lib/auth";
import { today, payrollPreview, money, period, addDays } from "@/lib/domain";
import {
  uuid,
  date,
  amount,
  signedAmount,
  optionalAmount,
  optionalId,
  name,
  text,
  model,
  frequency,
} from "@/lib/validation";

export interface ActionState {
  ok: boolean;
  message: string;
}
const get = (f: FormData, k: string) => String(f.get(k) ?? "");
const nullable = (s: string) => s.trim() || null;
async function throttle(key: string, maximum = 60) {
  const rows =
    await db`insert into public.rate_limits(key,hits,reset_at) values(${key},1,now()+interval '5 minutes')
 on conflict(key) do update set hits=case when rate_limits.reset_at<now() then 1 else rate_limits.hits+1 end,
 reset_at=case when rate_limits.reset_at<now() then now()+interval '5 minutes' else rate_limits.reset_at end returning hits`;
  if (rows[0].hits > maximum)
    throw new Error(
      "Demasiados intentos. Esperá unos minutos y volvé a probar.",
    );
}
function message(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0].message;
  const code = (error as { code?: string })?.code;
  if (code === "23505") return "Ese registro ya existe. Abrilo para editarlo.";
  if (code === "23503")
    return "El registro relacionado no existe o está siendo utilizado.";
  if (code === "42501") return "No tenés permiso para realizar esta operación.";
  if (error instanceof Error && (!code || code === "23514"))
    return error.message;
  return "No se pudo guardar. Revisá la conexión y volvé a intentar.";
}
export async function login(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const h = await headers();
    await throttle(
      "login:" + (h.get("x-forwarded-for")?.split(",")[0] || "local"),
      15,
    );
    const email = z.email().parse(get(f, "email"));
    const password = z.string().min(1).max(200).parse(get(f, "password"));
    const s = await supabase();
    const { data, error } = await s.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user)
      return { ok: false, message: "Correo o contraseña incorrectos." };
    try {
      await asAdmin(data.user.id, async () => true);
    } catch {
      await s.auth.signOut();
      return { ok: false, message: "Esta cuenta no tiene acceso al sistema." };
    }
  } catch (e) {
    return { ok: false, message: message(e) };
  }
  redirect("/");
}
export async function logout() {
  const s = await supabase();
  await s.auth.signOut();
  redirect("/login");
}
export async function recover(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  try {
    const email = z.email().parse(get(f, "email"));
    await throttle("recover:" + email, 5);
    const s = await supabase();
    await s.auth.resetPasswordForEmail(email, {
      redirectTo:
        process.env.NEXT_PUBLIC_SITE_URL +
        "/auth/callback?next=/configuracion?recovery=1",
    });
    return {
      ok: true,
      message:
        "Si el correo tiene acceso, recibirá las instrucciones de recuperación.",
    };
  } catch (e) {
    return { ok: false, message: message(e) };
  }
}
async function saveDay(tx: Tx, f: FormData) {
  const id = nullable(get(f, "id"));
  if (id) uuid.parse(id);
  const vehicleId = uuid.parse(get(f, "vehicle_id")),
    workDate = date.parse(get(f, "work_date"));
  if (workDate > today())
    throw new Error("No se pueden registrar jornadas futuras.");
  const worked = get(f, "worked") === "true";
  const revenue = worked ? amount.parse(get(f, "revenue_amount")) : "0";
  const vehicles =
    await tx`select id,is_active from public.vehicles where id=${vehicleId} for update`;
  if (!vehicles[0] || (!vehicles[0].is_active && !id))
    throw new Error("La camioneta no está activa.");
  const previousAttendance = id
    ? await tx`select employee_id,role,salary_amount,salary_model from public.work_day_employees where work_day_id=${id}`
    : [];
  const selected = worked
    ? [nullable(get(f, "driver_id")), nullable(get(f, "helper_id"))].filter(
        (v): v is string => !!v,
      )
    : [];
  selected.forEach((v) => uuid.parse(v));
  if (new Set(selected).size !== selected.length)
    throw new Error("El chofer y el ayudante deben ser personas diferentes.");
  // Lock employees as well as vehicles, so concurrent payroll closing cannot race attendance changes.
  const lockIds = [
    ...new Set([
      ...selected,
      ...previousAttendance.map((a) => String(a.employee_id)),
    ]),
  ];
  if (lockIds.length)
    await tx`select id from public.employees where id in ${tx(lockIds)} order by id for update`;
  if (worked && selected.length === 0)
    throw new Error("Indicá al menos una persona que haya trabajado.");
  const staff: {
    employee_id: string;
    role: string;
    salary_amount: string | null;
    salary_model: string | null;
  }[] = [];
  for (const [field, role] of [
    ["driver_id", "chofer"],
    ["helper_id", "ayudante"],
  ]) {
    const employeeId = worked ? nullable(get(f, field)) : null;
    if (!employeeId) continue;
    const e =
      await tx`select id,is_active from public.employees where id=${employeeId}`;
    if (!e[0] || (!e[0].is_active && !id))
      throw new Error("El empleado seleccionado no está activo.");
    const overlap =
      await tx`select id from public.payroll_periods where employee_id=${employeeId} and voided_at is null and ${workDate} between start_date and end_date`;
    if (overlap.length)
      throw new Error(
        "El empleado ya tiene una liquidación cerrada para esa fecha.",
      );
    const other =
      await tx`select d.id from public.work_day_employees a join public.work_days d on d.id=a.work_day_id where a.employee_id=${employeeId} and d.work_date=${workDate} and d.id<>${id || "00000000-0000-4000-8000-000000000000"} and d.worked`;
    if (other.length)
      throw new Error(
        "El empleado ya está registrado en otra camioneta ese día.",
      );
    const salaries =
      await tx`select amount,payment_model from public.salary_settings where employee_id=${employeeId} and valid_from<=${workDate} and (valid_until is null or valid_until>=${workDate}) order by valid_from desc limit 1`;
    const override = get(
      f,
      role === "chofer" ? "driver_salary" : "helper_salary",
    );
    const previous = previousAttendance.find(
      (a) => a.employee_id === employeeId,
    );
    const appliedModel =
      previous?.salary_model ??
      salaries[0]?.payment_model ??
      (override !== "" ? "daily" : null);
    if (override !== "" && appliedModel !== "daily")
      throw new Error(
        "La excepción diaria solo aplica a salarios por jornada. Usá un ajuste en la liquidación para los sueldos fijos.",
      );
    staff.push({
      employee_id: employeeId,
      role,
      salary_amount:
        override !== ""
          ? amount.parse(override)
          : (previous?.salary_amount ?? salaries[0]?.amount ?? null),
      salary_model: appliedModel,
    });
  }
  let dayId = id;
  if (id) {
    const updated =
      await tx`update public.work_days set worked=${worked},revenue_amount=${revenue},notes=${nullable(text.parse(get(f, "notes")))},updated_at=now() where id=${id} and vehicle_id=${vehicleId} and work_date=${workDate} and updated_at=${get(f, "version")}::timestamptz returning id`;
    if (!updated.length)
      throw new Error(
        "La jornada cambió en otra ventana. Actualizá la página antes de editar.",
      );
    await tx`delete from public.work_day_employees where work_day_id=${id}`;
  } else {
    const inserted =
      await tx`insert into public.work_days(vehicle_id,work_date,worked,revenue_amount,notes) values(${vehicleId},${workDate},${worked},${revenue},${nullable(text.parse(get(f, "notes")))}) returning id`;
    dayId = inserted[0].id;
  }
  for (const a of staff)
    await tx`insert into public.work_day_employees(work_day_id,employee_id,role,salary_amount,salary_model) values(${dayId},${a.employee_id},${a.role},${a.salary_amount},${a.salary_model})`;
}
async function saveVehicle(tx: Tx, f: FormData) {
  const id = optionalId.parse(get(f, "id"));
  const values = {
    name: name.parse(get(f, "name")),
    license_plate: nullable(text.parse(get(f, "license_plate"))),
    brand: nullable(text.parse(get(f, "brand"))),
    model: nullable(text.parse(get(f, "model"))),
    year: get(f, "year")
      ? z.coerce.number().int().min(1900).max(2100).parse(get(f, "year"))
      : null,
    default_daily_rate: optionalAmount.parse(get(f, "default_daily_rate")),
    is_active: get(f, "is_active") === "true",
    notes: nullable(text.parse(get(f, "notes"))),
  };
  if (id)
    await tx`update public.vehicles set ${tx(values)},updated_at=now() where id=${id}`;
  else await tx`insert into public.vehicles ${tx(values)}`;
}
async function saveEmployee(tx: Tx, f: FormData) {
  let id = optionalId.parse(get(f, "id"));
  const values = {
    first_name: name.parse(get(f, "first_name")),
    last_name: text.parse(get(f, "last_name")),
    role: z.enum(["chofer", "ayudante"]).parse(get(f, "role")),
    is_active: get(f, "is_active") === "true",
    notes: nullable(text.parse(get(f, "notes"))),
  };
  if (id) {
    await tx`select id from public.employees where id=${id} for update`;
    await tx`update public.employees set ${tx(values)},updated_at=now() where id=${id}`;
  } else {
    const e = await tx`insert into public.employees ${tx(values)} returning id`;
    id = String(e[0].id);
  }
  const vehicleId = values.is_active
    ? optionalId.parse(get(f, "vehicle_id"))
    : null;
  const previous =
    await tx`select id,vehicle_id,role,start_date from public.employee_assignments where employee_id=${id} and end_date is null`;
  if (
    previous[0]?.vehicle_id !== vehicleId ||
    previous[0]?.role !== values.role
  ) {
    if (previous[0])
      await tx`update public.employee_assignments set end_date=greatest(start_date,${today()}::date-1) where id=${previous[0].id}`;
    if (vehicleId) {
      const conflict =
        await tx`select id from public.employee_assignments where vehicle_id=${vehicleId} and role=${values.role} and end_date is null`;
      if (conflict.length)
        throw new Error(
          "Esa camioneta ya tiene ese puesto asignado. Cambiá primero la asignación actual.",
        );
      await tx`insert into public.employee_assignments(employee_id,vehicle_id,role,start_date) values(${id},${vehicleId},${values.role},${today()})`;
    }
  }
  const newModel =
    values.is_active && get(f, "payment_model")
      ? model.parse(get(f, "payment_model"))
      : null;
  const newFrequency =
    values.is_active && get(f, "payment_frequency")
      ? frequency.parse(get(f, "payment_frequency"))
      : null;
  const newAmount = values.is_active
    ? optionalAmount.parse(get(f, "amount"))
    : null;
  const salary =
    await tx`select id,amount,payment_model,payment_frequency,valid_from from public.salary_settings where employee_id=${id} and valid_until is null for update`;
  const current = salary[0];
  const changed =
    !current ||
    current.payment_model !== newModel ||
    current.payment_frequency !== newFrequency ||
    (current.amount === null) !== (newAmount === null) ||
    (current.amount !== null &&
      newAmount !== null &&
      !new Decimal(current.amount).eq(newAmount));
  if (changed) {
    if (current?.valid_from === today())
      await tx`update public.salary_settings set amount=${newAmount},payment_model=${newModel},payment_frequency=${newFrequency} where id=${current.id}`;
    else {
      if (current)
        await tx`update public.salary_settings set valid_until=${today()}::date-1 where id=${current.id}`;
      await tx`insert into public.salary_settings(employee_id,amount,payment_model,payment_frequency,valid_from) values(${id},${newAmount},${newModel},${newFrequency},${today()})`;
    }
  }
}
async function saveExpense(tx: Tx, f: FormData) {
  const id = optionalId.parse(get(f, "id"));
  const categoryId = uuid.parse(get(f, "category_id"));
  const expenseDate = date.parse(get(f, "expense_date"));
  if (expenseDate > today())
    throw new Error("Registrá gastos realizados hasta hoy.");
  const paymentDate = get(f, "payment_date")
    ? date.parse(get(f, "payment_date"))
    : null;
  if (paymentDate && paymentDate > today())
    throw new Error("La fecha de pago no puede ser futura.");
  const values = {
    vehicle_id: optionalId.parse(get(f, "vehicle_id")),
    category_id: categoryId,
    expense_date: expenseDate,
    description: name.parse(get(f, "description")),
    amount: amount.parse(get(f, "amount")),
    payment_date: paymentDate,
    payment_method: nullable(text.parse(get(f, "payment_method"))),
    notes: nullable(text.parse(get(f, "notes"))),
  };
  if (new Decimal(values.amount).lte(0))
    throw new Error("El importe debe ser mayor que cero.");
  let expenseId = id;
  if (id) {
    const rows =
      await tx`update public.expenses set ${tx(values)},updated_at=now() where id=${id} and voided_at is null and updated_at=${get(f, "version")}::timestamptz returning id`;
    if (!rows.length)
      throw new Error(
        "El gasto cambió. Actualizá la página antes de editarlo.",
      );
  } else {
    const rows =
      await tx`insert into public.expenses ${tx(values)} returning id`;
    expenseId = String(rows[0].id);
  }
  const category =
    await tx`select name from public.expense_categories where id=${categoryId}`;
  if (category[0]?.name === "Combustible") {
    const tanks = amount.parse(get(f, "tank_count"));
    if (new Decimal(tanks).lte(0))
      throw new Error("Indicá una cantidad de cargas mayor que cero.");
    const liters = optionalAmount.parse(get(f, "liters"));
    if (liters !== null && new Decimal(liters).lte(0))
      throw new Error("Los litros deben ser mayores que cero.");
    await tx`insert into public.fuel_records(expense_id,tank_count,liters) values(${expenseId},${tanks},${liters}) on conflict(expense_id) do update set tank_count=excluded.tank_count,liters=excluded.liters`;
  }
}
async function closePayroll(tx: Tx, f: FormData) {
  const employeeId = uuid.parse(get(f, "employee_id")),
    start = date.parse(get(f, "start_date")),
    end = date.parse(get(f, "end_date"));
  if (end > today())
    throw new Error("Cerrá el período cuando haya finalizado.");
  if (
    start > end ||
    Number(new Date(end).getTime() - new Date(start).getTime()) > 32 * 86400000
  )
    throw new Error("Elegí un período válido de hasta un mes.");
  await tx`select id from public.employees where id=${employeeId} for update`;
  const data = await loadData(tx, start, end);
  const preview = payrollPreview(data, employeeId, start, end);
  if (
    !new Decimal(preview.gross).eq(amount.parse(get(f, "expected_gross"))) ||
    preview.days !== Number(get(f, "expected_days"))
  )
    throw new Error(
      "El cálculo cambió desde la revisión. Cerrá esta ventana y volvé a calcular el período.",
    );
  const adjustment = signedAmount.parse(get(f, "adjustments") || "0");
  const total = money(new Decimal(preview.gross).plus(adjustment));
  if (new Decimal(total).lt(0))
    throw new Error("El total de la liquidación no puede ser negativo.");
  const p =
    await tx`insert into public.payroll_periods(employee_id,start_date,end_date,days_worked,gross_amount,adjustments,total_amount,notes) values(${employeeId},${start},${end},${preview.days},${preview.gross},${adjustment},${total},${nullable(text.parse(get(f, "notes")))}) returning id`;
  for (const line of preview.lines)
    await tx`insert into public.payroll_accruals(payroll_period_id,accrual_date,vehicle_id,amount) values(${p[0].id},${line.accrual_date},${line.vehicle_id},${line.amount})`;
  if (new Decimal(adjustment).abs().gt(0))
    await tx`insert into public.payroll_accruals(payroll_period_id,accrual_date,vehicle_id,amount) values(${p[0].id},${end},null,${adjustment})`;
}
export async function previewPayroll(employeeId: string, chosenDate: string) {
  const user = await requireAdmin();
  try {
    uuid.parse(employeeId);
    date.parse(chosenDate);
    return await asAdmin(user.id, async (tx) => {
      const data = await loadData(
        tx,
        addDays(chosenDate, -31),
        addDays(chosenDate, 31),
      );
      const salary =
        data.salaries.find(
          (s) =>
            s.employee_id === employeeId &&
            s.valid_from <= chosenDate &&
            (!s.valid_until || s.valid_until >= chosenDate) &&
            s.payment_frequency,
        ) ??
        data.salaries.find(
          (s) => s.employee_id === employeeId && !s.valid_until,
        );
      if (!salary?.payment_frequency)
        throw new Error("Configurá la frecuencia de liquidación del empleado.");
      const [start, end] = period(chosenDate, salary.payment_frequency);
      const preview = payrollPreview(data, employeeId, start, end);
      return {
        ok: true as const,
        start,
        end,
        gross: preview.gross,
        days: preview.days,
        error: "",
      };
    });
  } catch (e) {
    return {
      ok: false as const,
      start: "",
      end: "",
      gross: "0",
      days: 0,
      error: message(e),
    };
  }
}
export async function mutate(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  const user = await requireAdmin();
  try {
    await throttle("admin:" + user.id, 150);
    const operation = get(f, "operation");
    await asAdmin(user.id, async (tx) => {
      switch (operation) {
        case "day":
          await saveDay(tx, f);
          break;
        case "vehicle":
          await saveVehicle(tx, f);
          break;
        case "employee":
          await saveEmployee(tx, f);
          break;
        case "expense":
          await saveExpense(tx, f);
          break;
        case "payroll":
          await closePayroll(tx, f);
          break;
        case "payment": {
          const id = uuid.parse(get(f, "payroll_period_id"));
          const value = amount.parse(get(f, "amount"));
          const d = date.parse(get(f, "payment_date"));
          if (d > today())
            throw new Error("La fecha de pago no puede ser futura.");
          await tx`insert into public.payroll_payments(payroll_period_id,payment_date,amount,payment_method,notes,idempotency_key) values(${id},${d},${value},${nullable(text.parse(get(f, "payment_method")))},${nullable(text.parse(get(f, "notes")))},${uuid.parse(get(f, "idempotency_key"))}) on conflict(idempotency_key) do nothing`;
          break;
        }
        case "collection": {
          const id = uuid.parse(get(f, "work_day_id"));
          const value = amount.parse(get(f, "amount"));
          const d = date.parse(get(f, "collection_date"));
          if (d > today())
            throw new Error("La fecha del cobro no puede ser futura.");
          await tx`insert into public.collections(work_day_id,collection_date,amount,payment_method,notes,idempotency_key) values(${id},${d},${value},${nullable(text.parse(get(f, "payment_method")))},${nullable(text.parse(get(f, "notes")))},${uuid.parse(get(f, "idempotency_key"))}) on conflict(idempotency_key) do nothing`;
          break;
        }
        case "void": {
          const entity = z
            .enum([
              "expenses",
              "payroll_periods",
              "payroll_payments",
              "collections",
            ])
            .parse(get(f, "entity"));
          const id = uuid.parse(get(f, "id"));
          const reason = z
            .string()
            .trim()
            .min(5, "Explicá el motivo de la anulación.")
            .max(1000)
            .parse(get(f, "reason"));
          await tx`update public.${tx(entity)} set voided_at=now(),void_reason=${reason} where id=${id} and voided_at is null`;
          break;
        }
        case "category":
          await tx`insert into public.expense_categories(name) values(${name.parse(get(f, "name"))})`;
          break;
        case "company":
          await tx`update public.company_settings set name=${name.parse(get(f, "name"))} where id=true`;
          break;
        case "profile":
          await tx`update public.profiles set full_name=${name.parse(get(f, "full_name"))} where id=${user.id}`;
          break;
        case "password": {
          const password = z
            .string()
            .min(8, "La nueva contraseña debe tener al menos 8 caracteres.")
            .max(100)
            .parse(get(f, "password"));
          if (password !== get(f, "confirm_password"))
            throw new Error("Las contraseñas no coinciden.");
          const s = await supabase();
          const { error } = await s.auth.updateUser({ password });
          if (error) throw new Error(error.message);
          break;
        }
        default:
          throw new Error("Operación no válida.");
      }
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Guardado correctamente." };
  } catch (e) {
    return { ok: false, message: message(e) };
  }
}
