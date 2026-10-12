BEGIN;
REVOKE SELECT ON TABLE public.pilot_resorts FROM anon, authenticated;
COMMIT;
