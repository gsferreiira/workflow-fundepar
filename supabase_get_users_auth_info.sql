-- Cole este SQL no Supabase Dashboard → SQL Editor → New query → Run
-- (versão corrigida: evita ambiguidade de coluna "id")

create or replace function public.get_users_auth_info()
returns table (
  id              uuid,
  last_sign_in_at timestamptz,
  confirmed_at    timestamptz,
  invited_at      timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Só administradores podem chamar esta função
  if not exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin' and profiles.deleted_at is null
  ) then
    raise exception 'Acesso negado';
  end if;

  return query
  select
    u.id::uuid,
    u.last_sign_in_at::timestamptz,
    u.confirmed_at::timestamptz,
    u.invited_at::timestamptz
  from auth.users u
  where u.deleted_at is null;
end;
$$;
