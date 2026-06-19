-- Desvincula automaticamente a sala quando o usuário perde a role 'coordenador',
-- independente de onde a alteração de role aconteça (tela de Usuários, SQL direto, etc.)
create or replace function public.unlink_room_on_coordinator_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'coordenador' and new.role is distinct from 'coordenador' then
    update public.rooms
    set coordinator_id = null,
        coordinator = null
    where coordinator_id = new.id
      and deleted_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_unlink_room_on_coordinator_role_change on public.profiles;

create trigger trg_unlink_room_on_coordinator_role_change
after update of role on public.profiles
for each row
execute function public.unlink_room_on_coordinator_role_change();
