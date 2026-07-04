-- Keep reply ingestion idempotent when a webhook and scheduled sync overlap.
delete from replies duplicate
using replies canonical
where duplicate.owner_id = canonical.owner_id
  and duplicate.gmail_message_id = canonical.gmail_message_id
  and (
    duplicate.created_at > canonical.created_at
    or (duplicate.created_at = canonical.created_at and duplicate.id > canonical.id)
  );

create unique index replies_owner_message_idx
  on replies(owner_id, gmail_message_id);

-- Support growing workspaces without sequential scans in sync and send paths.
create index leads_owner_gmail_thread_idx
  on leads(owner_id, gmail_thread_id)
  where gmail_thread_id is not null;

create index drafts_owner_state_sent_idx
  on email_drafts(owner_id, state, sent_at desc)
  where state = 'sent';

create index leads_owner_created_idx
  on leads(owner_id, created_at desc, id);

create index drafts_owner_created_idx
  on email_drafts(owner_id, created_at desc, id);

create index replies_owner_received_idx
  on replies(owner_id, received_at desc, id);
