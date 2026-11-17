-- Jornada numbers belong to each vehicle, not to a shared employee time slot.
create or replace function public.protect_attendance() returns trigger language plpgsql set search_path='' as $$
declare d public.work_days; employee uuid;
begin
 employee:=case when tg_op='DELETE' then old.employee_id else new.employee_id end;
 perform 1 from public.employees where id=employee for update;
 select * into d from public.work_days where id=case when tg_op='DELETE' then old.work_day_id else new.work_day_id end;
 if exists(select 1 from public.payroll_periods where employee_id=employee and voided_at is null and d.work_date between start_date and end_date) then
 raise exception 'La asistencia pertenece a una liquidación cerrada.' using errcode='23514'; end if;
 if tg_op<>'DELETE' then
  if not d.worked then raise exception 'Una jornada sin actividad no puede tener asistencia.' using errcode='23514'; end if;
 end if;
 return coalesce(new,old);
end $$;
