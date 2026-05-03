-- Workspace lifecycle states for safe onboarding cleanup.
-- Draft/incomplete workspaces are retained, expired, archived, or purged by policy;
-- they are never deleted by navigation such as /setup/cancel.

alter table public.workspaces
  add column if not exists status text not null default 'draft';

alter table public.workspaces
  drop constraint if exists workspaces_status_check;

alter table public.workspaces
  add constraint workspaces_status_check
  check (status in ('draft', 'active', 'archived', 'expired', 'pending_deletion', 'deleted'));

alter table public.workspaces
  add column if not exists setup_started_at timestamptz,
  add column if not exists setup_last_seen_at timestamptz,
  add column if not exists setup_completed_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists pending_deletion_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists delete_after timestamptz;

update public.workspaces
set
  status = case
    when deleted_at is not null then 'deleted'
    when archived_at is not null then 'archived'
    when onboarding_completed is true then 'active'
    else 'draft'
  end,
  setup_started_at = coalesce(setup_started_at, created_at, now()),
  setup_last_seen_at = coalesce(setup_last_seen_at, updated_at, created_at, now()),
  setup_completed_at = case
    when onboarding_completed is true then coalesce(setup_completed_at, updated_at, created_at, now())
    else setup_completed_at
  end
where status is distinct from case
    when deleted_at is not null then 'deleted'
    when archived_at is not null then 'archived'
    when onboarding_completed is true then 'active'
    else 'draft'
  end
  or setup_started_at is null
  or setup_last_seen_at is null
  or (onboarding_completed is true and setup_completed_at is null);

create index if not exists idx_workspaces_owner_lifecycle
  on public.workspaces(owner_id, status, onboarding_completed);

create index if not exists idx_workspaces_setup_cleanup
  on public.workspaces(status, setup_last_seen_at, delete_after)
  where onboarding_completed is false;
