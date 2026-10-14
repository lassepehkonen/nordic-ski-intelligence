BEGIN;
REVOKE ALL ON TABLE public.pilot_resorts FROM anon, authenticated;
GRANT SELECT ON TABLE public.pilot_resorts TO anon, authenticated;
REVOKE ALL ON TABLE public.pilot_collection_runs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.pilot_resorts TO service_role;
GRANT SELECT, INSERT ON TABLE public.pilot_collection_runs TO service_role;
COMMIT;
