-- Enable after the app supports the new service types; previous journals retain their amounts.
update public.vehicles set default_daily_rate=200000,
 service_pricing='{"fija":"200000.00","ambulancia_100":"200000.00","ambulancia_50":"100000.00","ambulancia_chica":"80000.00"}'::jsonb
where id='10000000-0000-4000-8000-000000000001';
