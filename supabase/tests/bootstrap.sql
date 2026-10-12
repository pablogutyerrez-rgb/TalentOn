-- EXCLUSIVAMENTE CI/disposable PostgreSQL. Nunca ejecutar este archivo en Supabase real.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
