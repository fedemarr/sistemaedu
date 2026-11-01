create or replace function public.valid_service_pricing(p jsonb) returns boolean language sql immutable set search_path='' as $$
 select case when p is null then true when jsonb_typeof(p)<>'object' then false else
  (((p ?& array['colecta','ultima_milla','voluminoso_50','voluminoso_80','voluminoso_110','voluminoso_140','voluminoso_180']) and (select count(*)=7 from jsonb_object_keys(p))) or
   ((p ?& array['fija','ambulancia_100','ambulancia_50','ambulancia_chica']) and (select count(*)=4 from jsonb_object_keys(p)))) and
   (select bool_and(jsonb_typeof(value)='string' and (p->>key) ~ '^\d{1,11}(\.\d{1,2})?$') from jsonb_each(p))
 end
$$;
alter table public.work_days drop constraint work_days_work_type_check;
alter table public.work_days add constraint work_days_work_type_check check(work_type in ('colecta','ultima_milla','voluminoso','fija','ambulancia_100','ambulancia_50','ambulancia_chica'));
create or replace function public.validate_service_quote() returns trigger language plpgsql set search_path='' as $$
declare rate_key text; expected numeric;
begin
 if new.work_type is null then return new; end if;
 rate_key:=case when new.work_type='voluminoso' then
   case when new.distance_km<=50 then 'voluminoso_50' when new.distance_km<=80 then 'voluminoso_80'
   when new.distance_km<=110 then 'voluminoso_110' when new.distance_km<=140 then 'voluminoso_140'
   when new.distance_km<=180 then 'voluminoso_180' end
 else new.work_type end;
 expected:=(new.pricing_snapshot->>rate_key)::numeric;
 if expected is null or expected<>new.revenue_amount then
   raise exception 'La facturación no coincide con la tarifa del trabajo y los kilómetros.' using errcode='23514';
 end if;
 return new;
end $$;
