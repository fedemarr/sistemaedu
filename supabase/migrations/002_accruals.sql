create table public.payroll_accruals (
 id uuid primary key default gen_random_uuid(), payroll_period_id uuid not null references public.payroll_periods,
 accrual_date date not null, vehicle_id uuid references public.vehicles, amount numeric(14,2) not null
);
alter table public.payroll_accruals enable row level security;
revoke all on public.payroll_accruals from anon,authenticated;
grant select,insert on public.payroll_accruals to authenticated;
create policy admin_read on public.payroll_accruals for select to authenticated using(public.is_admin());
create policy admin_insert on public.payroll_accruals for insert to authenticated with check(public.is_admin());
create index accrual_date on public.payroll_accruals(accrual_date);
create index accrual_parent on public.payroll_accruals(payroll_period_id);
create or replace function public.protect_money() returns trigger language plpgsql set search_path = '' as $$
declare maximum numeric; already numeric;
begin
 if tg_op='UPDATE' and (new.amount<>old.amount or new.payment_method is distinct from old.payment_method or
 (to_jsonb(new)-'voided_at')<>(to_jsonb(old)-'voided_at')) then
 raise exception 'Anule el movimiento y registre uno nuevo para corregirlo.' using errcode='23514'; end if;
 if tg_table_name = 'payroll_payments' then
  select total_amount into maximum from public.payroll_periods where id=new.payroll_period_id and voided_at is null for update;
  select coalesce(sum(amount),0) into already from public.payroll_payments where payroll_period_id=new.payroll_period_id and voided_at is null and id<>new.id;
 else
  select revenue_amount into maximum from public.work_days where id=new.work_day_id for update;
  select coalesce(sum(amount),0) into already from public.collections where work_day_id=new.work_day_id and voided_at is null and id<>new.id;
 end if;
 if maximum is null or (new.voided_at is null and already+new.amount > maximum) then
  raise exception 'El importe supera el saldo pendiente.' using errcode='23514';
 end if;
 return new;
end $$;
