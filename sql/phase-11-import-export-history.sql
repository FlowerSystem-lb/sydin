-- Track import and export operations for audit trail and history display

create table public.import_export_history (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_type text not null check (operation_type = any (array['import'::text, 'export'::text])),
  file_name text not null,
  item_count integer default 0,
  status text not null default 'processing'::text check (status = any (array['processing'::text, 'success'::text, 'error'::text])),
  error_message text,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Indexes for efficient queries
create index idx_import_export_history_user_id on public.import_export_history(user_id);
create index idx_import_export_history_created_at on public.import_export_history(created_at desc);
create index idx_import_export_history_operation_type on public.import_export_history(operation_type);

-- RLS policy: users can only see their own history
alter table public.import_export_history enable row level security;

create policy "Users can view their own import export history"
  on public.import_export_history for select
  using (auth.uid() = user_id);

create policy "Users can insert their own import export history"
  on public.import_export_history for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own import export history"
  on public.import_export_history for update
  using (auth.uid() = user_id);

comment on table public.import_export_history is 'Audit trail for inventory import and export operations';
comment on column public.import_export_history.operation_type is 'Either import or export';
comment on column public.import_export_history.status is 'processing, success, or error';
comment on column public.import_export_history.item_count is 'Number of items processed in this operation';
