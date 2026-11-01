create or replace function public.protect_payroll() returns trigger language plpgsql set search_path = '' as $$
begin
 perform 1 from public.employees where id=new.employee_id for update;
 if exists(select 1 from public.payroll_periods where employee_id=new.employee_id and id<>new.id and voided_at is null
 and new.start_date<=end_date and new.end_date>=start_date) and new.voided_at is null then
 raise exception 'El período ya está liquidado o se superpone con otro.' using errcode='23514'; end if;
 if tg_op='UPDATE' and ((to_jsonb(new)-'voided_at'-'void_reason')<>(to_jsonb(old)-'voided_at'-'void_reason') or old.voided_at is not null or new.voided_at is null) then
 raise exception 'Una liquidación cerrada es inmutable. Anulela para corregirla.' using errcode='23514'; end if;
 if new.voided_at is not null and exists(select 1 from public.payroll_payments where payroll_period_id=new.id and voided_at is null) then
 raise exception 'Anule primero los pagos asociados.' using errcode='23514'; end if;
 return new;
end $$;
alter table public.work_day_employees add constraint valid_salary_model check(salary_model in ('daily','weekly','biweekly','monthly'));
create trigger audit after update on public.company_settings for each row execute function public.audit_change();
create trigger audit after insert or update on public.expense_categories for each row execute function public.audit_change();
