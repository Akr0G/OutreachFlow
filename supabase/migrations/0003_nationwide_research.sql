alter table leads
  add column if not exists source_place_id text;

create unique index if not exists leads_owner_source_place_idx
  on leads(owner_id, source_place_id)
  where source_place_id is not null;
