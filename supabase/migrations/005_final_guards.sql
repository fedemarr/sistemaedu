create or replace function public.protect_money() returns trigger language plpgsql set search_path = '' as $$
declare maximum numeric; already numeric;
begin
 if tg_op='UPDATE' and ((to_jsonb(new)-'voided_at'-'void_reason')<>(to_jsonb(old)-'voided_at'-'void_reason') or old.voided_at is not null or new.voided_at is null) then
 raise exception 'Anule el movimiento y registre uno nuevo para corregirlo.' using errcode='23514'; end if;
 if tg_table_name = 'payroll_payments' then
  select total_amount into maximum from public.payroll_periods where id=new.payroll_period_id and voided_at is null for update;
  if tg_op='INSERT' and exists(select 1 from public.payroll_payments where idempotency_key=new.idempotency_key) then return null; end if;
  select coalesce(sum(amount),0) into already from public.payroll_payments where payroll_period_id=new.payroll_period_id and voided_at is null and id<>new.id;
 else
  select revenue_amount into maximum from public.work_days where id=new.work_day_id for update;
  if tg_op='INSERT' and exists(select 1 from public.collections where idempotency_key=new.idempotency_key) then return null; end if;
  select coalesce(sum(amount),0) into already from public.collections where work_day_id=new.work_day_id and voided_at is null and id<>new.id;
 end if;
 if maximum is null or (new.voided_at is null and already+new.amount > maximum) then
  raise exception 'El importe supera el saldo pendiente.' using errcode='23514'; end if;
 return new;
end $$;
create trigger audit after update on public.profiles for each row execute function public.audit_change();
-- Initial assignments start when the system is installed; no prior employment dates are inferred.
update public.employee_assignments set start_date=(now() at time zone 'America/Argentina/Buenos_Aires')::date
where start_date='2026-01-01' and employee_id in ('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000004')
and not exists(select 1 from public.work_day_employees we where we.employee_id=employee_assignments.employee_id);
