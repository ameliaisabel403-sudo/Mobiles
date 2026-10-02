-- COMPANY PHONE TRACKING SYSTEM
-- Run this whole script in Supabase SQL Editor for a fresh database.

create extension if not exists pgcrypto;

drop table if exists transactions cascade;
drop table if exists phones cascade;
drop table if exists employees cascade;

create table employees (
  employee_number varchar(50) primary key,
  full_name varchar(120) not null,
  department varchar(120) default 'Operations',
  phone_number varchar(30),
  created_at timestamptz default now()
);

create table phones (
  id varchar(50) primary key,
  status varchar(20) not null default 'AVAILABLE' check(status in ('AVAILABLE','ISSUED')),
  current_employee_id varchar(50) references employees(employee_number) on delete set null,
  current_employee_name varchar(120),
  last_issue_time timestamptz,
  last_return_time timestamptz,
  condition varchar(20) not null default 'Good' check(condition in ('Good','Damaged')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  timestamp timestamptz not null default now(),
  action varchar(20) not null check(action in ('ISSUE','RETURN')),
  phone_id varchar(50) not null references phones(id) on delete cascade,
  employee_number varchar(50) not null,
  employee_name varchar(120) not null,
  condition varchar(20) check(condition in ('Good','Damaged')),
  notes text,
  staff_email varchar(150) not null default 'staff@company.com'
);

insert into phones(id) select 'PHONE-'||lpad(n::text,3,'0') from generate_series(1,20) n
on conflict(id) do nothing;

-- RLS: this project is designed for a controlled company/kiosk environment.
alter table employees enable row level security;
alter table phones enable row level security;
alter table transactions enable row level security;

create policy "employees public read" on employees for select to anon, authenticated using(true);
create policy "employees public insert" on employees for insert to anon, authenticated with check(true);
create policy "employees public update" on employees for update to anon, authenticated using(true) with check(true);
create policy "employees public delete" on employees for delete to anon, authenticated using(true);

create policy "phones public read" on phones for select to anon, authenticated using(true);
create policy "phones public update" on phones for update to anon, authenticated using(true) with check(true);

create policy "transactions public read" on transactions for select to anon, authenticated using(true);
create policy "transactions public insert" on transactions for insert to anon, authenticated with check(true);
