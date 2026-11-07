-- =============================================================================
-- CRM для строительной компании — схема, роли/права, RLS, переходы статусов
-- Выполнить целиком в Supabase → SQL Editor (чистый проект)
-- Если schema уже накатывали со старым enum — см. migrate_to_roles.sql
-- =============================================================================

create type public.task_status as enum (
  'new',
  'in_progress',
  'review',
  'accepted',
  'revision'
);

-- -----------------------------------------------------------------------------
-- Роли и права (масштабируемый RBAC)
-- -----------------------------------------------------------------------------
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(trim(code)) > 0),
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(trim(code)) > 0),
  description text not null default ''
);

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

insert into public.roles (code, name, description) values
  ('manager', 'Постановщик', 'Управление объектами и задачами, приёмка работ'),
  ('executor', 'Исполнитель', 'Выполнение назначенных задач');

insert into public.permissions (code, description) values
  ('objects.manage', 'Создание/редактирование/удаление объектов'),
  ('tasks.manage', 'Создание/редактирование/удаление задач, назначение исполнителей'),
  ('tasks.review', 'Приёмка задач и возврат на доработку'),
  ('tasks.execute', 'Взятие в работу и отправка на проверку');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'manager'
  and p.code in ('objects.manage', 'tasks.manage', 'tasks.review');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'tasks.execute'
where r.code = 'executor';

-- -----------------------------------------------------------------------------
-- Profiles / objects / tasks / history
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null,
  role_id uuid not null references public.roles (id),
  created_at timestamptz not null default now()
);

create table public.construction_objects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  address text not null check (char_length(trim(address)) > 0),
  lat double precision,
  lng double precision,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  task_number bigserial not null unique,
  title text not null check (char_length(trim(title)) > 0),
  description text not null default '',
  object_id uuid not null references public.construction_objects (id) on delete cascade,
  assignee_id uuid not null references public.profiles (id),
  author_id uuid not null references public.profiles (id),
  status public.task_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.task_status_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  changed_by uuid not null references public.profiles (id),
  from_status public.task_status,
  to_status public.task_status not null,
  comment text,
  created_at timestamptz not null default now()
);

create index profiles_role_id_idx on public.profiles (role_id);
create index tasks_object_id_idx on public.tasks (object_id);
create index tasks_assignee_id_idx on public.tasks (assignee_id);
create index task_status_history_task_id_idx on public.task_status_history (task_id);

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function public.current_role_code()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select r.code
  from public.profiles p
  join public.roles r on r.id = p.role_id
  where p.id = auth.uid();
$$;

create or replace function public.has_permission(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.role_permissions rp on rp.role_id = p.role_id
    join public.permissions perm on perm.id = rp.permission_id
    where p.id = auth.uid()
      and perm.code = p_code
  );
$$;

create or replace function public.profile_has_permission(p_profile_id uuid, p_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.role_permissions rp on rp.role_id = p.role_id
    join public.permissions perm on perm.id = rp.permission_id
    where p.id = p_profile_id
      and perm.code = p_code
  );
$$;

-- Совместимость со старыми политиками / удобные алиасы
create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_permission('tasks.manage');
$$;

create or replace function public.is_task_assignee(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tasks
    where id = p_task_id and assignee_id = auth.uid()
  );
$$;

create or replace function public.user_has_tasks_on_object(p_object_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tasks
    where object_id = p_object_id and assignee_id = auth.uid()
  );
$$;

create or replace function public.executor_can_see_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tasks t
    where t.assignee_id = auth.uid()
      and (t.assignee_id = p_profile_id or t.author_id = p_profile_id)
  );
$$;

revoke all on function public.current_role_code() from public;
revoke all on function public.has_permission(text) from public;
revoke all on function public.profile_has_permission(uuid, text) from public;
revoke all on function public.is_manager() from public;
revoke all on function public.is_task_assignee(uuid) from public;
revoke all on function public.user_has_tasks_on_object(uuid) from public;
revoke all on function public.executor_can_see_profile(uuid) from public;

grant execute on function public.current_role_code() to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.profile_has_permission(uuid, text) to authenticated;
grant execute on function public.is_manager() to authenticated;
grant execute on function public.is_task_assignee(uuid) to authenticated;
grant execute on function public.user_has_tasks_on_object(uuid) to authenticated;
grant execute on function public.executor_can_see_profile(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger construction_objects_updated_at
  before update on public.construction_objects
  for each row execute function public.set_updated_at();

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create or replace function public.enforce_task_guards()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.status is distinct from 'new' then
      raise exception 'Новая задача может быть только со статусом «Новая»';
    end if;
    return new;
  end if;

  if old.author_id is distinct from new.author_id then
    raise exception 'Автора задачи нельзя менять';
  end if;

  if old.created_at is distinct from new.created_at then
    raise exception 'Дату создания задачи нельзя менять';
  end if;

  if old.status is distinct from new.status then
    if coalesce(current_setting('app.allow_status_change', true), '') <> 'on' then
      raise exception 'Смену статуса выполняйте через функцию change_task_status()';
    end if;
  end if;

  return new;
end;
$$;

create trigger tasks_guards
  before insert or update on public.tasks
  for each row execute function public.enforce_task_guards();

create or replace function public.forbid_history_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Историю статусов нельзя изменять или удалять';
end;
$$;

create trigger task_status_history_no_update
  before update on public.task_status_history
  for each row execute function public.forbid_history_mutation();

create trigger task_status_history_no_delete
  before delete on public.task_status_history
  for each row execute function public.forbid_history_mutation();

create or replace function public.forbid_direct_history_insert()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.allow_history_insert', true), '') <> 'on' then
    raise exception 'Историю статусов нельзя создавать напрямую';
  end if;
  return new;
end;
$$;

create trigger task_status_history_insert_guard
  before insert on public.task_status_history
  for each row execute function public.forbid_direct_history_insert();

create or replace function public.log_task_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.allow_history_insert', 'on', true);
  insert into public.task_status_history (task_id, changed_by, from_status, to_status, comment)
  values (new.id, new.author_id, null, new.status, null);
  return new;
end;
$$;

create trigger tasks_log_created
  after insert on public.tasks
  for each row execute function public.log_task_created();

-- -----------------------------------------------------------------------------
-- RPC: смена статуса
-- -----------------------------------------------------------------------------
create or replace function public.change_task_status(
  p_task_id uuid,
  p_new_status public.task_status,
  p_comment text default null
)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.tasks;
  v_from public.task_status;
  v_comment text := nullif(trim(coalesce(p_comment, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Не авторизован';
  end if;

  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then
    raise exception 'Задача не найдена';
  end if;

  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Профиль не найден';
  end if;

  -- Без права review/manage чужие задачи недоступны
  if not public.has_permission('tasks.review')
     and not public.has_permission('tasks.manage')
     and v_task.assignee_id <> auth.uid()
  then
    raise exception 'Нет доступа к этой задаче';
  end if;

  v_from := v_task.status;

  if v_from = p_new_status then
    raise exception 'Статус уже установлен';
  end if;

  if v_from = 'new' and p_new_status = 'in_progress' then
    if v_task.assignee_id <> auth.uid() or not public.has_permission('tasks.execute') then
      raise exception 'Только назначенный исполнитель может взять задачу в работу';
    end if;
  elsif v_from = 'in_progress' and p_new_status = 'review' then
    if v_task.assignee_id <> auth.uid() or not public.has_permission('tasks.execute') then
      raise exception 'Только назначенный исполнитель может отправить задачу на проверку';
    end if;
  elsif v_from = 'review' and p_new_status = 'accepted' then
    if not public.has_permission('tasks.review') then
      raise exception 'Недостаточно прав, чтобы принять задачу';
    end if;
  elsif v_from = 'review' and p_new_status = 'revision' then
    if not public.has_permission('tasks.review') then
      raise exception 'Недостаточно прав, чтобы вернуть задачу на доработку';
    end if;
    if v_comment is null then
      raise exception 'Комментарий обязателен при возврате на доработку';
    end if;
  elsif v_from = 'revision' and p_new_status = 'in_progress' then
    if v_task.assignee_id <> auth.uid() or not public.has_permission('tasks.execute') then
      raise exception 'Только назначенный исполнитель может взять задачу с доработки в работу';
    end if;
  else
    raise exception 'Переход из «%» в «%» запрещён', v_from, p_new_status;
  end if;

  perform set_config('app.allow_status_change', 'on', true);
  perform set_config('app.allow_history_insert', 'on', true);

  update public.tasks
  set status = p_new_status
  where id = p_task_id
  returning * into v_task;

  insert into public.task_status_history (task_id, changed_by, from_status, to_status, comment)
  values (p_task_id, auth.uid(), v_from, p_new_status, v_comment);

  return v_task;
end;
$$;

revoke all on function public.change_task_status(uuid, public.task_status, text) from public;
grant execute on function public.change_task_status(uuid, public.task_status, text) to authenticated;

create or replace function public.list_executors()
returns setof public.profiles
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_permission('tasks.manage') then
    raise exception 'Доступно только при праве tasks.manage';
  end if;
  return query
    select p.*
    from public.profiles p
    where public.profile_has_permission(p.id, 'tasks.execute')
      and not public.profile_has_permission(p.id, 'tasks.manage')
    order by p.full_name;
end;
$$;

revoke all on function public.list_executors() from public;
grant execute on function public.list_executors() to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security;
alter table public.construction_objects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_status_history enable row level security;

-- Справочники ролей — только чтение
create policy "roles_select_authenticated"
  on public.roles for select to authenticated
  using (true);

create policy "permissions_select_authenticated"
  on public.permissions for select to authenticated
  using (true);

create policy "role_permissions_select_authenticated"
  on public.role_permissions for select to authenticated
  using (true);

-- profiles
create policy "profiles_select_manager"
  on public.profiles for select to authenticated
  using (public.has_permission('tasks.manage'));

create policy "profiles_select_self"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "profiles_select_task_related"
  on public.profiles for select to authenticated
  using (public.executor_can_see_profile(id));

-- objects
create policy "objects_select_manager"
  on public.construction_objects for select to authenticated
  using (public.has_permission('objects.manage'));

create policy "objects_select_executor"
  on public.construction_objects for select to authenticated
  using (public.user_has_tasks_on_object(id));

create policy "objects_insert_manager"
  on public.construction_objects for insert to authenticated
  with check (public.has_permission('objects.manage') and created_by = auth.uid());

create policy "objects_update_manager"
  on public.construction_objects for update to authenticated
  using (public.has_permission('objects.manage'))
  with check (public.has_permission('objects.manage'));

create policy "objects_delete_manager"
  on public.construction_objects for delete to authenticated
  using (public.has_permission('objects.manage'));

-- tasks
create policy "tasks_select_manager"
  on public.tasks for select to authenticated
  using (public.has_permission('tasks.manage') or public.has_permission('tasks.review'));

create policy "tasks_select_assignee"
  on public.tasks for select to authenticated
  using (assignee_id = auth.uid());

create policy "tasks_insert_manager"
  on public.tasks for insert to authenticated
  with check (
    public.has_permission('tasks.manage')
    and author_id = auth.uid()
    and status = 'new'
    and public.profile_has_permission(assignee_id, 'tasks.execute')
    and not public.profile_has_permission(assignee_id, 'tasks.manage')
  );

create policy "tasks_update_manager"
  on public.tasks for update to authenticated
  using (public.has_permission('tasks.manage'))
  with check (public.has_permission('tasks.manage'));

create policy "tasks_delete_manager"
  on public.tasks for delete to authenticated
  using (public.has_permission('tasks.manage'));

-- history
create policy "history_select_manager"
  on public.task_status_history for select to authenticated
  using (public.has_permission('tasks.manage') or public.has_permission('tasks.review'));

create policy "history_select_assignee"
  on public.task_status_history for select to authenticated
  using (public.is_task_assignee(task_id));

-- -----------------------------------------------------------------------------
-- Table grants (нужны после drop schema public / чистого create)
-- RLS по-прежнему ограничивает строки; без GRANT будет 42501
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

grant select on public.roles to authenticated;
grant select on public.permissions to authenticated;
grant select on public.role_permissions to authenticated;

grant select on public.profiles to authenticated;

grant select, insert, update, delete on public.construction_objects to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select on public.task_status_history to authenticated;

grant usage, select on all sequences in schema public to authenticated;
