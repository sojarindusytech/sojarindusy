-- ==============================================================================
-- Migration: 20261028_audit_logs
--
-- Append-only audit trail of administrative changes and sign-ins. Written by
-- server actions (service role) after each successful change, with the acting
-- user, their IP / browser, what changed and, for edits, the before / after
-- values. Rows can be added and read, never changed or removed: a trigger
-- refuses UPDATE / DELETE / TRUNCATE for every role, so the trail stays
-- trustworthy even if application code goes wrong.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  actor_id    uuid,                       -- no FK: the trail must outlive deleted accounts
  actor_email text,
  actor_role  text,
  action      text        NOT NULL CHECK (char_length(action) BETWEEN 1 AND 80),
  entity_type text        NOT NULL CHECK (char_length(entity_type) BETWEEN 1 AND 60),
  entity_id   text,
  summary     text        NOT NULL CHECK (char_length(summary) <= 500),
  changes     jsonb,                      -- { field: { from, to } } for edits
  metadata    jsonb,
  ip_address  text,
  user_agent  text,
  outcome     text        NOT NULL DEFAULT 'success' CHECK (outcome IN ('success', 'failure'))
);

CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx   ON public.audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx  ON public.audit_logs (entity_type, entity_id);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_logs FROM anon, authenticated;
REVOKE ALL ON public.audit_logs FROM service_role;
GRANT SELECT, INSERT ON public.audit_logs TO service_role;

CREATE OR REPLACE FUNCTION public.audit_logs_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'AUDIT_LOG_IMMUTABLE' USING ERRCODE = 'P0001',
    HINT = 'Audit log entries can be added, never changed or removed.';
END $$;

DROP TRIGGER IF EXISTS audit_logs_no_update ON public.audit_logs;
CREATE TRIGGER audit_logs_no_update BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_logs_append_only();
DROP TRIGGER IF EXISTS audit_logs_no_truncate ON public.audit_logs;
CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON public.audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION public.audit_logs_append_only();

NOTIFY pgrst, 'reload schema';
