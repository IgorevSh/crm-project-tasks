-- =============================================================================
-- Синхронизация auth.users → public.profiles
-- Выполнять ПОСЛЕ schema.sql
-- =============================================================================
-- Display name → raw_user_meta_data.display_name (также full_name / name)
-- Роль по умолчанию: executor. manager — через app_metadata.role или SQL.
-- =============================================================================

create or replace function public.profile_display_name(meta jsonb, email text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(trim(meta->>'display_name'), ''),
    nullif(trim(meta->>'full_name'), ''),
    nullif(trim(meta->>'name'), ''),
    split_part(email, '@', 1)
  );
$$;

create or replace function public.role_id_by_code(p_code text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.roles where code = p_code limit 1;
$$;

create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_code text := coalesce(nullif(new.raw_app_meta_data->>'role', ''), 'executor');
  v_role_id uuid;
begin
  v_role_id := public.role_id_by_code(v_role_code);
  if v_role_id is null then
    v_role_id := public.role_id_by_code('executor');
  end if;

  insert into public.profiles (id, email, full_name, role_id)
  values (
    new.id,
    coalesce(new.email, ''),
    public.profile_display_name(new.raw_user_meta_data, coalesce(new.email, '')),
    v_role_id
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name;

  return new;
end;
$$;

create or replace function public.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if new.email is distinct from old.email
     or new.raw_user_meta_data is distinct from old.raw_user_meta_data
  then
    v_name := public.profile_display_name(
      new.raw_user_meta_data,
      coalesce(new.email, '')
    );

    update public.profiles
    set
      email = coalesce(new.email, email),
      full_name = v_name
    where id = new.id;

    if not found then
      insert into public.profiles (id, email, full_name, role_id)
      values (
        new.id,
        coalesce(new.email, ''),
        v_name,
        public.role_id_by_code('executor')
      )
      on conflict (id) do nothing;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_auth_user_created();

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_auth_user_updated();

-- Догон существующих пользователей без профиля:
/*
insert into public.profiles (id, email, full_name, role_id)
select
  u.id,
  coalesce(u.email, ''),
  public.profile_display_name(u.raw_user_meta_data, coalesce(u.email, '')),
  public.role_id_by_code('executor')
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
*/

-- Повысить постановщика:
-- update public.profiles
-- set role_id = (select id from public.roles where code = 'manager')
-- where email = 'manager@crm.local';
