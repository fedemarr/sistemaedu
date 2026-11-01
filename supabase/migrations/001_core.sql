-- Gestión Transporte Eduardo. No financial data is seeded.
create table public.profiles (
 id uuid primary key references auth.users(id), full_name text not null,
 role text not null default 'admin' check(role = 'admin'), created_at timestamptz not null default now()
);
create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;
create table public.company_settings (
 id boolean primary key default true check(id), name text not null default 'Transporte Eduardo',
 currency text not null default 'ARS' check(currency = 'ARS'), timezone text not null default 'America/Argentina/Buenos_Aires'
);
insert into public.company_settings(id) values(true);
create table public.vehicles (
 id uuid primary key default gen_random_uuid(), name text not null, license_plate text, brand text, model text,
 year integer check(year between 1900 and 2100), default_daily_rate numeric(14,2) check(default_daily_rate >= 0),
 is_active boolean not null default true, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.employees (
 id uuid primary key default gen_random_uuid(), first_name text not null, last_name text not null default '',
 role text not null check(role in ('chofer','ayudante')), is_active boolean not null default true, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.employee_assignments (
 id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.employees,
 vehicle_id uuid not null references public.vehicles, role text not null check(role in ('chofer','ayudante')),
 start_date date not null, end_date date, check(end_date is null or end_date >= start_date)
);
create unique index assignment_current_employee on public.employee_assignments(employee_id) where end_date is null;
create unique index assignment_current_vehicle_role on public.employee_assignments(vehicle_id,role) where end_date is null;
create table public.salary_settings (
 id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.employees,
 payment_model text check(payment_model in ('daily','weekly','biweekly','monthly')),
 payment_frequency text check(payment_frequency in ('weekly','biweekly','monthly')), amount numeric(14,2) check(amount >= 0),
 valid_from date not null, valid_until date, check(valid_until is null or valid_until >= valid_from)
);
create unique index salary_current on public.salary_settings(employee_id) where valid_until is null;
create table public.work_days (
 id uuid primary key default gen_random_uuid(), vehicle_id uuid not null references public.vehicles, work_date date not null,
 worked boolean not null, revenue_amount numeric(14,2) not null check(revenue_amount >= 0),
 notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(vehicle_id,work_date), check(worked or revenue_amount = 0)
);
create table public.work_day_employees (
 id uuid primary key default gen_random_uuid(), work_day_id uuid not null references public.work_days,
 employee_id uuid not null references public.employees, role text not null check(role in ('chofer','ayudante')),
 salary_amount numeric(14,2) check(salary_amount >= 0), salary_model text,
 unique(work_day_id,employee_id), unique(work_day_id,role)
);
create table public.expense_categories (
 id uuid primary key default gen_random_uuid(), name text not null unique, is_active boolean not null default true
);
create table public.expenses (
 id uuid primary key default gen_random_uuid(), vehicle_id uuid references public.vehicles,
 category_id uuid not null references public.expense_categories, expense_date date not null,
 description text not null, amount numeric(14,2) not null check(amount > 0),
 payment_date date, payment_method text, notes text, voided_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.fuel_records (
 id uuid primary key default gen_random_uuid(), expense_id uuid not null unique references public.expenses,
 tank_count numeric(10,2) not null check(tank_count > 0), liters numeric(10,2) check(liters > 0), notes text
);
create table public.payroll_periods (
 id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.employees,
 start_date date not null, end_date date not null, days_worked integer not null check(days_worked >= 0),
 gross_amount numeric(14,2) not null check(gross_amount >= 0), adjustments numeric(14,2) not null default 0,
 total_amount numeric(14,2) not null check(total_amount >= 0), notes text,
 created_at timestamptz not null default now(), closed_at timestamptz not null default now(), voided_at timestamptz,
 check(end_date >= start_date), check(total_amount = gross_amount + adjustments)
);
create table public.payroll_allocations (
 id uuid primary key default gen_random_uuid(), payroll_period_id uuid not null references public.payroll_periods,
 vehicle_id uuid references public.vehicles, amount numeric(14,2) not null check(amount >= 0)
);
create table public.payroll_payments (
 id uuid primary key default gen_random_uuid(), payroll_period_id uuid not null references public.payroll_periods,
 payment_date date not null, amount numeric(14,2) not null check(amount > 0), payment_method text, notes text,
 idempotency_key uuid not null unique, voided_at timestamptz, created_at timestamptz not null default now()
);
create table public.collections (
 id uuid primary key default gen_random_uuid(), work_day_id uuid not null references public.work_days,
 collection_date date not null, amount numeric(14,2) not null check(amount > 0), payment_method text, notes text,
 idempotency_key uuid not null unique, voided_at timestamptz, created_at timestamptz not null default now()
);
create table public.audit_logs (
 id bigint generated always as identity primary key, actor_id uuid references auth.users,
 entity_type text not null, entity_id text not null, action text not null,
 previous_data jsonb, new_data jsonb, created_at timestamptz not null default now()
);
create table public.rate_limits (key text primary key, hits integer not null, reset_at timestamptz not null);

create function public.audit_change() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.audit_logs(actor_id,entity_type,entity_id,action,previous_data,new_data)
 values(auth.uid(),tg_table_name,coalesce(new.id::text,old.id::text),tg_op,
 case when tg_op <> 'INSERT' then to_jsonb(old) end,case when tg_op <> 'DELETE' then to_jsonb(new) end);
 return coalesce(new,old);
end $$;
create function public.protect_money() returns trigger language plpgsql set search_path = '' as $$
declare maximum numeric; already numeric;
begin
 if tg_table_name = 'payroll_payments' then
  select total_amount into maximum from public.payroll_periods where id=new.payroll_period_id and voided_at is null for update;
  select coalesce(sum(amount),0) into already from public.payroll_payments where payroll_period_id=new.payroll_period_id and voided_at is null and id<>new.id;
 else
  select revenue_amount into maximum from public.work_days where id=new.work_day_id for update;
  select coalesce(sum(amount),0) into already from public.collections where work_day_id=new.work_day_id and voided_at is null and id<>new.id;
 end if;
 if maximum is null or (new.voided_at is null and already+new.amount > maximum) then
  raise exception 'Le montant dépasse le solde' using errcode='23514';
 end if;
 return new;
end $$;
create trigger payment_balance before insert or update on public.payroll_payments for each row execute function public.protect_money();
create trigger collection_balance before insert or update on public.collections for each row execute function public.protect_money();
create function public.protect_day() returns trigger language plpgsql set search_path = '' as $$
begin
 if exists(select 1 from public.work_day_employees we join public.payroll_periods p on p.employee_id=we.employee_id
 where we.work_day_id=old.id and p.voided_at is null and old.work_date between p.start_date and p.end_date) then
 raise exception 'La jornada pertenece a una liquidación cerrada. Anule la liquidación antes de corregirla.' using errcode='23514'; end if;
 if new.revenue_amount < (select coalesce(sum(amount),0) from public.collections where work_day_id=old.id and voided_at is null) then
 raise exception 'Anule los cobros antes de reducir la facturación.' using errcode='23514'; end if;
 return new;
end $$;
create trigger protect_day before update on public.work_days for each row execute function public.protect_day();
create function public.protect_payroll() returns trigger language plpgsql set search_path = '' as $$
begin
 perform 1 from public.employees where id=new.employee_id for update;
 if exists(select 1 from public.payroll_periods where employee_id=new.employee_id and id<>new.id and voided_at is null
 and new.start_date<=end_date and new.end_date>=start_date) and new.voided_at is null then
 raise exception 'El período ya está liquidado o se superpone con otro.' using errcode='23514'; end if;
 if tg_op='UPDATE' and (new.gross_amount<>old.gross_amount or new.adjustments<>old.adjustments or new.start_date<>old.start_date or new.end_date<>old.end_date or new.employee_id<>old.employee_id) then
 raise exception 'Una liquidación cerrada es inmutable.' using errcode='23514'; end if;
 if new.voided_at is not null and exists(select 1 from public.payroll_payments where payroll_period_id=new.id and voided_at is null) then
 raise exception 'Anule primero los pagos asociados.' using errcode='23514'; end if;
 return new;
end $$;
create trigger payroll_integrity before insert or update on public.payroll_periods for each row execute function public.protect_payroll();

do $$ declare t text; begin
 foreach t in array array['profiles','company_settings','vehicles','employees','employee_assignments','salary_settings','work_days','work_day_employees','expense_categories','expenses','fuel_records','payroll_periods','payroll_allocations','payroll_payments','collections','audit_logs','rate_limits'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 if t <> 'rate_limits' then
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy admin_read on public.%I for select to authenticated using (public.is_admin())',t);
 end if;
 if t not in ('profiles','audit_logs','rate_limits') then
 execute format('grant insert, update on public.%I to authenticated',t);
 execute format('create policy admin_insert on public.%I for insert to authenticated with check (public.is_admin())',t);
 execute format('create policy admin_update on public.%I for update to authenticated using (public.is_admin()) with check(public.is_admin())',t);
 end if;
 if t in ('vehicles','employees','employee_assignments','salary_settings','work_days','work_day_employees','expenses','fuel_records','payroll_periods','payroll_payments','collections') then
 execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.audit_change()',t);
 end if;
 end loop;
end $$;
-- Only attendance children can be replaced, inside the server transaction.
grant delete on public.work_day_employees to authenticated;
create policy admin_delete_attendance on public.work_day_employees for delete to authenticated using(public.is_admin());
create index work_days_date on public.work_days(work_date);
create index work_day_employee on public.work_day_employees(employee_id);
create index work_day_parent on public.work_day_employees(work_day_id);
create index expenses_date on public.expenses(expense_date,vehicle_id);
create index expenses_category on public.expenses(category_id);
create index payroll_employee on public.payroll_periods(employee_id,start_date,end_date);
create index payment_parent on public.payroll_payments(payroll_period_id);
create index collection_parent on public.collections(work_day_id);
create index assignments_vehicle on public.employee_assignments(vehicle_id);
create index salary_employee on public.salary_settings(employee_id,valid_from);
create index payroll_allocation_parent on public.payroll_allocations(payroll_period_id);
create index audit_date on public.audit_logs(created_at desc);
insert into public.expense_categories(name) values ('Combustible'),('Seguro'),('Reparaciones'),('Mantenimiento'),('VTV'),('Peajes'),('Otros');
insert into public.vehicles(id,name) values ('10000000-0000-4000-8000-000000000001','Camioneta 1'),('10000000-0000-4000-8000-000000000002','Camioneta 2');
insert into public.employees(id,first_name,last_name,role) values
 ('20000000-0000-4000-8000-000000000001','Eduardo','Martínez','chofer'),
 ('20000000-0000-4000-8000-000000000002','Federico','Martínez','ayudante'),
 ('20000000-0000-4000-8000-000000000003','Sebastián','Robledo','chofer'),
 ('20000000-0000-4000-8000-000000000004','Ramiro','','ayudante');
insert into public.employee_assignments(employee_id,vehicle_id,role,start_date)
 select id,case when first_name in ('Eduardo','Federico') then '10000000-0000-4000-8000-000000000001'::uuid else '10000000-0000-4000-8000-000000000002'::uuid end,role,'2026-01-01' from public.employees;
insert into public.salary_settings(employee_id,payment_frequency,valid_from)
 select id,case first_name when 'Federico' then 'weekly' when 'Eduardo' then 'biweekly' end,'2026-01-01' from public.employees;
