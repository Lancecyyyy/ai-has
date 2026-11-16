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
`;
