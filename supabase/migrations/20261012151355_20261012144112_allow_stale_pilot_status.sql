BEGIN;

-- destructive-approved: PILOT-STATUS-STATE
-- Replace only the CHECK constraint; existing resort status rows remain unchanged.
ALTER TABLE public.pilot_resorts
  DROP CONSTRAINT IF EXISTS pilot_resorts_status_state_check;

ALTER TABLE public.pilot_resorts
  ADD CONSTRAINT pilot_resorts_status_state_check
  CHECK (status_state IN ('fresh', 'partial', 'stale', 'scheduled', 'unavailable'));

COMMIT;
