-- Vínculo genérico usuário→sala/setor, independente de coordinator_id
-- (que continua representando especificamente quem coordena a sala).
-- Usado para organizar a tela de Usuários por setor.
alter table public.profiles add column if not exists room_id uuid references public.rooms(id);
create index if not exists profiles_room_id_idx on public.profiles(room_id);
