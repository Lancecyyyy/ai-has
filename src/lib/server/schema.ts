export const SCHEMA = /* sql */ `
create table if not exists users (
  id serial primary key,
  name text not null,
  email text not null unique,
  password_hash text,
  role text not null default 'employee',
  department text not null default 'Operations',
  created_at timestamptz not null default now()
);

create table if not exists conversations (
  id text primary key,
  user_id int not null references users(id) on delete cascade,
  title text not null default 'New conversation',
  status text not null default 'open',
  intent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists conversations_user_idx on conversations(user_id, updated_at desc);
create index if not exists conversations_created_idx on conversations(created_at);

create table if not exists messages (
  id serial primary key,
  conversation_id text not null references conversations(id) on delete cascade,
  role text not null,
  content text not null,
  meta jsonb not null default '{}'::jsonb,
  latency_ms int,
  feedback smallint,
  created_at timestamptz not null default now()
);
create index if not exists messages_conv_idx on messages(conversation_id, id);
create index if not exists messages_created_idx on messages(created_at);

create table if not exists kb_documents (
  id serial primary key,
  title text not null,
  category text not null default 'General',
  source text not null default 'seed',
  content text not null,
  created_by int references users(id) on delete set null,
  citations int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists kb_chunks (
  id serial primary key,
  document_id int not null references kb_documents(id) on delete cascade,
  ord int not null,
  heading text not null,
  content text not null
);
create index if not exists kb_chunks_doc_idx on kb_chunks(document_id, ord);

create table if not exists tickets (
  id serial primary key,
  key text not null unique,
  conversation_id text references conversations(id) on delete set null,
  requester_id int not null references users(id) on delete cascade,
  assignee_id int references users(id) on delete set null,
  title text not null,
  description text not null,
  ai_summary text not null default '',
  category text not null default 'General',
  priority text not null default 'P3',
  status text not null default 'open',
  sla_due timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists tickets_status_idx on tickets(status, priority);

create table if not exists ticket_comments (
  id serial primary key,
  ticket_id int not null references tickets(id) on delete cascade,
  author_id int references users(id) on delete set null,
  body text not null,
  internal boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists automations (
  id text primary key,
  name text not null,
  description text not null,
  enabled boolean not null default true,
  minutes_saved int not null default 10
);

create table if not exists automation_runs (
  id serial primary key,
  workflow_id text not null references automations(id) on delete cascade,
  user_id int references users(id) on delete set null,
  conversation_id text references conversations(id) on delete set null,
  status text not null,
  summary text not null default '',
  steps jsonb not null default '[]'::jsonb,
  duration_ms int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists automation_runs_created_idx on automation_runs(created_at);

create table if not exists security_events (
  id serial primary key,
  user_id int references users(id) on delete set null,
  type text not null,
  severity text not null default 'low',
  detail text not null,
  sample text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists security_events_created_idx on security_events(created_at);

create table if not exists knowledge_gaps (
  id serial primary key,
  query text not null,
  normalized text not null unique,
  hits int not null default 1,
  status text not null default 'open',
  last_seen timestamptz not null default now()
);

create table if not exists services (
  id text primary key,
  name text not null,
  status text not null default 'operational',
  keywords text not null default '',
  sort int not null default 0
);

create table if not exists incidents (
  id serial primary key,
  service_id text not null references services(id) on delete cascade,
  title text not null,
  body text not null,
  severity text not null default 'degraded',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Account security used by the automations
alter table users add column if not exists failed_logins int not null default 0;
alter table users add column if not exists locked_until timestamptz;
alter table users add column if not exists mfa_secret text;
alter table users add column if not exists mfa_pending_secret text;
alter table users add column if not exists mfa_pending_expires timestamptz;

create table if not exists password_resets (
  token_hash text primary key,
  user_id int not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists email_log (
  id serial primary key,
  to_address text not null default '',
  account_email text not null default '',
  kind text not null default '',
  subject text not null default '',
  status text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists vpn_profiles (
  id serial primary key,
  user_id int not null references users(id) on delete cascade,
  serial text not null,
  public_key text not null,
  private_key text not null,
  address text not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists vpn_profiles_user_idx on vpn_profiles(user_id, issued_at desc);

create table if not exists software_requests (
  id serial primary key,
  user_id int not null references users(id) on delete cascade,
  conversation_id text references conversations(id) on delete set null,
  app text not null,
  pre_approved boolean not null default false,
  status text not null default 'pending',
  approver_id int references users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists software_requests_status_idx on software_requests(status, created_at desc);

create table if not exists printers (
  id text primary key,
  name text not null,
  status text not null default 'ready',
  restarted_at timestamptz
);

create table if not exists print_jobs (
  id serial primary key,
  user_id int not null references users(id) on delete cascade,
  printer_id text not null references printers(id) on delete cascade,
  document text not null,
  pages int not null default 1,
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  cleared_at timestamptz
);
create index if not exists print_jobs_user_idx on print_jobs(user_id, status);

create table if not exists mailbox_folders (
  id serial primary key,
  user_id int not null references users(id) on delete cascade,
  folder text not null,
  month date not null,
  items int not null,
  size_mb numeric(10,1) not null,
  location text not null default 'mailbox'
);
create index if not exists mailbox_folders_user_idx on mailbox_folders(user_id, location);
`;

export const MAILBOX_QUOTA_MB = 51200;
