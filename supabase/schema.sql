create table companies (
  id uuid primary key default gen_random_uuid(),
  github_id text unique not null,
  github_login text not null,
  github_token text not null,
  created_at timestamptz default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  name text not null,
  repo_url text not null,
  repo_full_name text not null,       -- e.g. "acme/frontend"
  default_branch text not null default 'main',
  install_command text not null default 'npm install',
  dev_command text not null default 'npm run dev',
  dev_port integer not null default 3000,
  script_tag_id text unique not null default gen_random_uuid()::text,
  env_file_path text not null default '.env',
  widget_launch_type text not null default 'button',
  widget_button_color text not null default '#18181b',
  widget_button_text text not null default '✦ Tweak this',
  widget_icon_only boolean not null default false,
  widget_logo_url text,
  widget_welcome_message text,
  created_at timestamptz default now(),
  constraint widget_launch_type_check check (widget_launch_type in ('button', 'text-link')),
  constraint widget_welcome_message_length check (char_length(widget_welcome_message) <= 150)
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  user_prompt text not null,
  user_email text not null,
  bounty_amount integer not null,
  pr_url text,
  pr_number integer,
  status text not null default 'pending',   -- pending | merged | rejected
  created_at timestamptz default now()
);

create table project_env_vars (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  key text not null,
  value text not null,
  created_at timestamptz default now(),
  unique(project_id, key)
);

alter table companies enable row level security;
alter table projects enable row level security;
alter table submissions enable row level security;
alter table project_env_vars enable row level security;
