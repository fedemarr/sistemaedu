-- Existing journals remain the first jornada; their amounts and attendance are untouched.
alter table public.work_days add column shift_number smallint not null default 1 check(shift_number in (1,2));
alter table public.work_days drop constraint work_days_vehicle_id_work_date_key;
alter table public.work_days add constraint work_days_vehicle_date_shift_key unique(vehicle_id,work_date,shift_number);
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
  if exists(select 1 from public.work_day_employees a join public.work_days w on w.id=a.work_day_id where a.employee_id=employee and a.id<>new.id and w.work_date=d.work_date and w.shift_number=d.shift_number and w.worked) then
   raise exception 'El empleado ya está registrado en otra camioneta en esta jornada.' using errcode='23514'; end if;
 end if;
 return coalesce(new,old);
end $$;
create function public.protect_shift() returns trigger language plpgsql set search_path='' as $$
begin
 perform 1 from public.vehicles where id=new.vehicle_id for update;
 if tg_op='UPDATE' and (new.vehicle_id<>old.vehicle_id or new.work_date<>old.work_date or new.shift_number<>old.shift_number) then
   raise exception 'Para corregir una jornada, conserve su camioneta, fecha y número.' using errcode='23514';
 end if;
 if new.shift_number=2 and not exists(select 1 from public.work_days where vehicle_id=new.vehicle_id and work_date=new.work_date and shift_number=1) then
   raise exception 'Registre primero la primera jornada de esa camioneta.' using errcode='23514';
 end if;
 return new;
end $$;
create trigger shift_integrity before insert or update on public.work_days for each row execute function public.protect_shift();
