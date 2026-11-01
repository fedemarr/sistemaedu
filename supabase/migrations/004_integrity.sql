-- Attendance and salary snapshots cannot bypass closed payroll via the REST API.
create function public.protect_attendance() returns trigger language plpgsql set search_path='' as $$
declare d public.work_days; employee uuid;
begin
 employee:=case when tg_op='DELETE' then old.employee_id else new.employee_id end;
 perform 1 from public.employees where id=employee for update;
 select * into d from public.work_days where id=case when tg_op='DELETE' then old.work_day_id else new.work_day_id end;
 if exists(select 1 from public.payroll_periods where employee_id=employee and voided_at is null and d.work_date between start_date and end_date) then
 raise exception 'La asistencia pertenece a una liquidación cerrada.' using errcode='23514'; end if;
 if tg_op<>'DELETE' then
  if not d.worked then raise exception 'Una jornada sin actividad no puede tener asistencia.' using errcode='23514'; end if;
  if exists(select 1 from public.work_day_employees a join public.work_days w on w.id=a.work_day_id where a.employee_id=employee and a.id<>new.id and w.work_date=d.work_date and w.worked) then
   raise exception 'El empleado ya trabajó en otra camioneta esa fecha.' using errcode='23514'; end if;
 end if;
 return coalesce(new,old);
end $$;
create trigger attendance_integrity before insert or update or delete on public.work_day_employees for each row execute function public.protect_attendance();
grant update(full_name) on public.profiles to authenticated;
create policy admin_profile_update on public.profiles for update to authenticated using(id=auth.uid() and public.is_admin()) with check(id=auth.uid() and public.is_admin());
create function public.touch_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end $$;
create trigger touch_vehicle before update on public.vehicles for each row execute function public.touch_updated_at();
create trigger touch_employee before update on public.employees for each row execute function public.touch_updated_at();
-- Salary periods are versioned. A new setting cannot overlap a previous setting.
create function public.protect_salary() returns trigger language plpgsql set search_path='' as $$
begin
 perform 1 from public.employees where id=new.employee_id for update;
 if exists(select 1 from public.salary_settings where employee_id=new.employee_id and id<>new.id and new.valid_from<=coalesce(valid_until,'9999-12-31'::date) and coalesce(new.valid_until,'9999-12-31'::date)>=valid_from) then
 raise exception 'Las configuraciones salariales no pueden superponerse.' using errcode='23514'; end if;
 return new;
end $$;
create trigger salary_integrity before insert or update on public.salary_settings for each row execute function public.protect_salary();
