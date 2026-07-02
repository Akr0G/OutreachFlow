create extension if not exists pgcrypto;

create type lead_status as enum (
  'Ready',
  'Draft Created',
  'Sent',
  'Replied',
  'Interested',
  'Not Interested',
  'Unsubscribed',
  'Do Not Contact'
);

create type email_draft_type as enum ('initial', 'follow_up');
create type email_draft_state as enum ('awaiting_review', 'approved', 'sent', 'deleted');
create type generated_by as enum ('ai', 'manual');
create type reply_classification as enum (
  'Interested',
  'Not Interested',
  'Question',
  'Wrong Contact',
  'Unsubscribe',
  'Other'
);
create type activity_type as enum (
  'Lead created',
  'Lead updated',
  'Draft created',
  'Draft edited',
  'Draft approved',
  'Draft deleted',
  'Email sent',
  'Reply received',
  'Reply classified',
  'Status changed',
  'Follow-up created',
  'Follow-up canceled',
  'Lead marked Do Not Contact'
);
create type template_type as enum ('initial', 'follow_up', 'signature', 'cta');

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table leads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  business_name text not null check (length(trim(business_name)) > 0),
  contact_name text,
  email text not null check (position('@' in email) > 1),
  website_url text,
  industry text,
  location text,
  observed_website_issues text[] not null default '{}',
  issue_details text,
  notes text,
  status lead_status not null default 'Ready',
  date_contacted date,
  follow_up_count integer not null default 0 check (follow_up_count >= 0 and follow_up_count <= 1),
  initial_sent_at timestamptz,
  last_activity_at timestamptz not null default now(),
  gmail_thread_id text,
  stop_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observed_website_issues_allowed check (
    observed_website_issues <@ array[
      'Poor mobile responsiveness',
      'Outdated design',
      'Unclear contact options',
      'Missing calls to action',
      'Slow-loading pages',
      'No website',
      'Other observed issue'
    ]::text[]
  )
);

create table email_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  draft_type email_draft_type not null,
  subject text not null check (length(trim(subject)) > 0),
  body text not null check (length(trim(body)) > 0),
  state email_draft_state not null default 'awaiting_review',
  gmail_draft_id text,
  gmail_message_id text,
  generated_by generated_by not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

create table replies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  gmail_message_id text not null,
  gmail_thread_id text not null,
  sender_email text not null,
  received_at timestamptz not null,
  body text not null,
  classification reply_classification not null,
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  explanation text not null,
  manually_overridden boolean not null default false,
  created_at timestamptz not null default now()
);

create table activities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  activity_type activity_type not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  template_type template_type not null,
  content text not null,
  updated_at timestamptz not null default now(),
  unique(owner_id, template_type)
);

create table settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade unique,
  sender_name text not null,
  sender_email text not null,
  agency_name text not null,
  agency_website text,
  portfolio_link text,
  calendly_link text,
  daily_send_limit integer not null default 20 check (daily_send_limit >= 1 and daily_send_limit <= 20),
  follow_up_delay_days integer not null default 5 check (follow_up_delay_days >= 1 and follow_up_delay_days <= 30),
  encrypted_openai_key_reference text,
  encrypted_gmail_refresh_token text,
  gmail_connection_metadata jsonb not null default '{"connected": false}'::jsonb,
  updated_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  lead_id uuid references leads(id) on delete cascade,
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index leads_owner_lower_email_idx on leads(owner_id, lower(email));
create index leads_owner_status_idx on leads(owner_id, status);
create index leads_owner_last_activity_idx on leads(owner_id, last_activity_at desc);
create index drafts_owner_lead_idx on email_drafts(owner_id, lead_id);
create unique index one_active_followup_draft_per_lead_idx
  on email_drafts(owner_id, lead_id)
  where draft_type = 'follow_up' and state <> 'deleted';
create index replies_owner_thread_idx on replies(owner_id, gmail_thread_id);
create index activities_owner_lead_created_idx on activities(owner_id, lead_id, created_at desc);
create index notifications_owner_unread_idx on notifications(owner_id, created_at desc) where read_at is null;

create trigger leads_updated_at before update on leads for each row execute function set_updated_at();
create trigger email_drafts_updated_at before update on email_drafts for each row execute function set_updated_at();
create trigger settings_updated_at before update on settings for each row execute function set_updated_at();
create trigger templates_updated_at before update on templates for each row execute function set_updated_at();

alter table leads enable row level security;
alter table email_drafts enable row level security;
alter table replies enable row level security;
alter table activities enable row level security;
alter table templates enable row level security;
alter table settings enable row level security;
alter table notifications enable row level security;

create policy "owner can manage own leads" on leads for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owner can manage own drafts" on email_drafts for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owner can manage own replies" on replies for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owner can manage own activities" on activities for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owner can manage own templates" on templates for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owner can manage own settings" on settings for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owner can manage own notifications" on notifications for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
