import "server-only";
import postgres from "postgres";
import type { Data } from "./types";
const globalDb = globalThis as unknown as { db?: ReturnType<typeof postgres> };
export const db =
  globalDb.db ??
  postgres(process.env.DATABASE_URL!, {
    ssl: "require",
    max: 5,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 15,
    types: {
      date: {
        to: 1082,
        from: [1082],
        serialize: (v: string) => v,
        parse: (v: string) => v,
      },
    },
  });
if (process.env.NODE_ENV !== "production") globalDb.db = db;
export type Tx = postgres.TransactionSql;
export async function asAdmin<T>(
  userId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return (await db.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims',${JSON.stringify({ sub: userId, role: "authenticated" })},true),set_config('role','authenticated',true)`;
    const ok = await tx`select public.is_admin() as ok`;
    if (!ok[0].ok) throw new Error("Acceso restringido al administrador.");
    return fn(tx);
  })) as T;
}
export async function loadData(
  tx: Tx,
  start: string,
  end: string,
): Promise<Data> {
  // One statement gives a consistent snapshot without one network round trip per table.
  const rows = await tx<{ data: Data }[]>`select jsonb_build_object(
 'vehicles',(select coalesce(jsonb_agg(v),'[]') from (select id,name,license_plate,brand,model,year,default_daily_rate::text,is_active,notes from public.vehicles order by name) v),
 'employees',(select coalesce(jsonb_agg(e),'[]') from (select id,first_name,last_name,role,is_active,notes from public.employees order by first_name) e),
 'assignments',(select coalesce(jsonb_agg(a),'[]') from (select id,employee_id,vehicle_id,role,start_date,end_date from public.employee_assignments order by start_date desc) a),
 'salaries',(select coalesce(jsonb_agg(s),'[]') from (select id,employee_id,payment_model,payment_frequency,amount::text,valid_from,valid_until from public.salary_settings order by valid_from desc) s),
 'days',(select coalesce(jsonb_agg(d),'[]') from (select id,vehicle_id,work_date,worked,revenue_amount::text,notes,updated_at::text from public.work_days where work_date between ${start} and ${end} or id in (select distinct on (vehicle_id) id from public.work_days where worked and work_date<=(now() at time zone 'America/Argentina/Buenos_Aires')::date order by vehicle_id,work_date desc) order by work_date desc) d),
 'attendance',(select coalesce(jsonb_agg(a),'[]') from (select we.id,we.work_day_id,we.employee_id,we.role,we.salary_amount::text,we.salary_model from public.work_day_employees we join public.work_days d on d.id=we.work_day_id where d.work_date between ${start} and ${end}) a),
 'categories',(select coalesce(jsonb_agg(c),'[]') from (select id,name,is_active from public.expense_categories order by name) c),
 'expenses',(select coalesce(jsonb_agg(e),'[]') from (select id,vehicle_id,category_id,expense_date,description,amount::text,payment_date,payment_method,notes,voided_at::text,updated_at::text from public.expenses where expense_date between ${start} and ${end} or payment_date between ${start} and ${end} order by expense_date desc) e),
 'fuel',(select coalesce(jsonb_agg(f),'[]') from (select f.id,f.expense_id,f.tank_count::text,f.liters::text from public.fuel_records f join public.expenses e on e.id=f.expense_id where e.expense_date between ${start} and ${end}) f),
 'payroll',(select coalesce(jsonb_agg(p),'[]') from (select id,employee_id,start_date,end_date,days_worked,gross_amount::text,adjustments::text,total_amount::text,notes,voided_at::text,closed_at::text from public.payroll_periods order by start_date desc) p),
 'payments',(select coalesce(jsonb_agg(p),'[]') from (select id,payroll_period_id,payment_date,amount::text,payment_method,notes,voided_at::text from public.payroll_payments order by payment_date desc) p),
 'collections',(select coalesce(jsonb_agg(c),'[]') from (select c.id,c.work_day_id,c.collection_date,c.amount::text,c.payment_method,c.notes,c.voided_at::text,w.vehicle_id,w.work_date from public.collections c join public.work_days w on w.id=c.work_day_id order by c.collection_date desc) c),
 'accruals',(select coalesce(jsonb_agg(a),'[]') from (select payroll_period_id,accrual_date,vehicle_id,amount::text from public.payroll_accruals where accrual_date between ${start} and ${end}) a),
 'company',(select jsonb_build_object('name',name) from public.company_settings where id=true),
 'audit',(select coalesce(jsonb_agg(a),'[]') from (select id::text,actor_id,entity_type,entity_id,action,created_at::text,previous_data,new_data from public.audit_logs order by id desc limit 100) a)
 ) as data`;
  return rows[0].data;
}
