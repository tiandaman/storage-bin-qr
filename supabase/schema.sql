-- Storage Bin QR: database setup
-- Paste into Supabase > SQL Editor > New query, then Run.

create table boxes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,            -- short label, e.g. B-01 (used in the QR link)
  name text not null,
  location text,
  notes text,
  created_at timestamptz default now()
);

create table items (
  id uuid primary key default gen_random_uuid(),
  box_id uuid not null references boxes(id) on delete cascade,
  name text not null,
  quantity int not null default 1,
  notes text,
  created_at timestamptz default now()
);

create index items_box_id_idx on items(box_id);

-- Only signed-in users can read or change anything.
alter table boxes enable row level security;
alter table items enable row level security;

create policy "signed-in full access" on boxes
  for all to authenticated using (true) with check (true);
create policy "signed-in full access" on items
  for all to authenticated using (true) with check (true);
