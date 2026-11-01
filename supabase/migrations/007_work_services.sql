create function public.valid_service_pricing(p jsonb) returns boolean language sql immutable set search_path='' as $$
 select p is null or (jsonb_typeof(p)='object' and
   (select count(*)=7 and bool_and(jsonb_typeof(p->k)='string' and (p->>k) ~ '^\d{1,11}(\.\d{1,2})?$')
    from unnest(array['colecta','ultima_milla','voluminoso_50','voluminoso_80','voluminoso_110','voluminoso_140','voluminoso_180']) k
    where p ? k))
$$;
alter table public.vehicles add column service_pricing jsonb check(public.valid_service_pricing(service_pricing));
alter table public.work_days add column work_type text check(work_type in ('colecta','ultima_milla','voluminoso'));
alter table public.work_days add column distance_km numeric(8,2) check(distance_km between 0 and 180);
alter table public.work_days add column pricing_snapshot jsonb check(public.valid_service_pricing(pricing_snapshot));
alter table public.work_days add constraint service_fields_consistent check (
 (work_type is null and distance_km is null and pricing_snapshot is null) or
 (worked and work_type is not null and pricing_snapshot is not null and
   ((work_type='voluminoso' and distance_km is not null) or (work_type<>'voluminoso' and distance_km is null)))
);
create function public.validate_service_quote() returns trigger language plpgsql set search_path='' as $$
declare rate_key text; expected numeric;
begin
 if new.work_type is null then return new; end if;
 rate_key:=case new.work_type when 'colecta' then 'colecta' when 'ultima_milla' then 'ultima_milla' else
   case when new.distance_km<=50 then 'voluminoso_50' when new.distance_km<=80 then 'voluminoso_80'
   when new.distance_km<=110 then 'voluminoso_110' when new.distance_km<=140 then 'voluminoso_140'
   when new.distance_km<=180 then 'voluminoso_180' end end;
 expected:=(new.pricing_snapshot->>rate_key)::numeric;
 if expected is null or expected<>new.revenue_amount then
   raise exception 'La facturación no coincide con la tarifa del trabajo y los kilómetros.' using errcode='23514';
 end if;
 return new;
end $$;
create trigger service_quote before insert or update on public.work_days for each row execute function public.validate_service_quote();
-- Only the requested vehicle receives service pricing. Historical journals are untouched.
update public.vehicles set service_pricing='{"colecta":"180000.00","ultima_milla":"200000.00","voluminoso_50":"174000.00","voluminoso_80":"197000.00","voluminoso_110":"227000.00","voluminoso_140":"243000.00","voluminoso_180":"259000.00"}'::jsonb
where id='10000000-0000-4000-8000-000000000002';
