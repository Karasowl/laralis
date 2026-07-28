-- Convex mirror outbox for Supabase -> Convex migration.
-- Safe default: this migration creates the queue and helper functions only.
-- It does not attach triggers until you explicitly run:
--   select public.install_convex_mirror_triggers();
--
-- Rollback for trigger activation:
--   select public.uninstall_convex_mirror_triggers();

create table if not exists public.convex_mirror_events (
  id bigserial primary key,
  table_name text not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  record_id text,
  record jsonb,
  old_record jsonb,
  committed_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer not null default 0,
  last_error text
);

create index if not exists convex_mirror_events_pending_idx
  on public.convex_mirror_events (processed_at, id)
  where processed_at is null;

create index if not exists convex_mirror_events_table_idx
  on public.convex_mirror_events (table_name, committed_at desc);

alter table public.convex_mirror_events enable row level security;

revoke all on table public.convex_mirror_events from anon, authenticated;
revoke all on sequence public.convex_mirror_events_id_seq from anon, authenticated;

create or replace function public.convex_mirror_legacy_id(
  table_name text,
  row_data jsonb
)
returns text
language plpgsql
stable
as $$
begin
  if row_data is null then
    return null;
  end if;

  if row_data ? 'id' and row_data ->> 'id' is not null then
    return row_data ->> 'id';
  end if;

  if table_name = 'user_settings' then
    if row_data ? 'user_id' and row_data ? 'key' then
      return 'user_settings:' || encode(convert_to(row_data ->> 'user_id', 'UTF8'), 'escape') || ':' || encode(convert_to(row_data ->> 'key', 'UTF8'), 'escape');
    end if;
  end if;

  return null;
end;
$$;

create or replace function public.enqueue_convex_mirror_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_row jsonb;
  old_row jsonb;
  mirrored_id text;
begin
  if tg_op = 'DELETE' then
    new_row := null;
    old_row := to_jsonb(old);
    mirrored_id := public.convex_mirror_legacy_id(tg_table_name, old_row);
  elsif tg_op = 'UPDATE' then
    new_row := to_jsonb(new);
    old_row := to_jsonb(old);
    mirrored_id := coalesce(
      public.convex_mirror_legacy_id(tg_table_name, new_row),
      public.convex_mirror_legacy_id(tg_table_name, old_row)
    );
  else
    new_row := to_jsonb(new);
    old_row := null;
    mirrored_id := public.convex_mirror_legacy_id(tg_table_name, new_row);
  end if;

  insert into public.convex_mirror_events (
    table_name,
    operation,
    record_id,
    record,
    old_record
  ) values (
    tg_table_name,
    tg_op,
    mirrored_id,
    new_row,
    old_row
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.convex_mirror_table_names()
returns text[]
language sql
stable
as $$
  select array[
    'workspaces',
    'clinics',
    'workspace_users',
    'workspace_members',
    'clinic_users',
    'invitations',
    'user_settings',
    'verification_codes',
    'category_types',
    'categories',
    'custom_categories',
    'patient_sources',
    'settings_time',
    'clinic_google_calendar',
    'fixed_costs',
    'assets',
    'supplies',
    'services',
    'service_supplies',
    'tariffs',
    'marketing_campaigns',
    'marketing_campaign_status_history',
    'patients',
    'treatments',
    'expenses',
    'ai_chat_sessions',
    'ai_chat_messages',
    'chat_sessions',
    'chat_messages',
    'ai_feedback',
    'workspace_activity',
    'public_bookings',
    'public_booking_services',
    'booking_blocked_slots',
    'medications',
    'prescriptions',
    'prescription_items',
    'quotes',
    'quote_items',
    'email_notifications',
    'scheduled_reminders',
    'sms_notifications',
    'push_subscriptions',
    'push_notifications',
    'clinic_snapshots',
    'custom_role_templates',
    'role_permissions',
    'leads',
    'marketing_campaign_channels',
    'inbox_conversations',
    'inbox_messages',
    'notification_retry_queue',
    'whatsapp_notifications',
    'whatsapp_templates',
    'action_logs',
    'organizations'
  ]::text[];
$$;

create or replace function public.install_convex_mirror_triggers()
returns table(table_name text, installed boolean, note text)
language plpgsql
security definer
set search_path = public
as $$
declare
  table_to_mirror text;
begin
  foreach table_to_mirror in array public.convex_mirror_table_names()
  loop
    table_name := table_to_mirror;

    if to_regclass(format('public.%I', table_to_mirror)) is null then
      installed := false;
      note := 'table does not exist';
      return next;
      continue;
    end if;

    execute format('drop trigger if exists convex_mirror_outbox on public.%I', table_to_mirror);
    execute format(
      'create trigger convex_mirror_outbox after insert or update or delete on public.%I for each row execute function public.enqueue_convex_mirror_event()',
      table_to_mirror
    );

    installed := true;
    note := 'trigger installed';
    return next;
  end loop;
end;
$$;

create or replace function public.uninstall_convex_mirror_triggers()
returns table(table_name text, removed boolean, note text)
language plpgsql
security definer
set search_path = public
as $$
declare
  table_to_mirror text;
begin
  foreach table_to_mirror in array public.convex_mirror_table_names()
  loop
    table_name := table_to_mirror;

    if to_regclass(format('public.%I', table_to_mirror)) is null then
      removed := false;
      note := 'table does not exist';
      return next;
      continue;
    end if;

    execute format('drop trigger if exists convex_mirror_outbox on public.%I', table_to_mirror);

    removed := true;
    note := 'trigger removed';
    return next;
  end loop;
end;
$$;
