-- Necessário para o Realtime entregar o valor antigo de current_room_id em
-- eventos UPDATE (payload.old). Com REPLICA IDENTITY padrão, o Postgres só
-- inclui a chave primária no "old row" — sem isso não dá pra detectar que um
-- equipamento SAIU de uma sala (old.current_room_id != new.current_room_id).
alter table public.equipment_locations replica identity full;
