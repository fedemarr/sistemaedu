alter table public.expenses add column void_reason text;
alter table public.payroll_periods add column void_reason text;
alter table public.payroll_payments add column void_reason text;
alter table public.collections add column void_reason text;
create or replace function public.protect_money() returns trigger language plpgsql set search_path = '' as $$
declare maximum numeric; already numeric;
begin
 if tg_op='UPDATE' and ((to_jsonb(new)-'voided_at'-'void_reason')<>(to_jsonb(old)-'voided_at'-'void_reason') or old.voided_at is not null or new.voided_at is null) then
 raise exception 'Anule el movimiento y registre uno nuevo para corregirlo.' using errcode='23514'; end if;
 if tg_table_name = 'payroll_payments' then
  select total_amount into maximum from public.payroll_periods where id=new.payroll_period_id and voided_at is null for update;
  select coalesce(sum(amount),0) into already from public.payroll_payments where payroll_period_id=new.payroll_period_id and voided_at is null and id<>new.id;
 else
  select revenue_amount into maximum from public.work_days where id=new.work_day_id for update;
  select coalesce(sum(amount),0) into already from public.collections where work_day_id=new.work_day_id and voided_at is null and id<>new.id;
 end if;
 if maximum is null or (new.voided_at is null and already+new.amount > maximum) then
  raise exception 'El importe supera el saldo pendiente.' using errcode='23514'; end if;
 return new;
end $$;
