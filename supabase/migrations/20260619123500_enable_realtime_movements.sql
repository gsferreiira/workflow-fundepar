-- Habilita Realtime (Postgres Changes) nas tabelas usadas pelos hooks de
-- notificação do coordenador (toast de novo equipamento, modal "Novidades
-- na sua sala" e atualização automática do sino). Sem isso, os canais do
-- app se inscrevem mas nunca recebem eventos — tudo cai de volta no polling
-- inicial feito no login/mount.
alter publication supabase_realtime add table public.equipment_locations;
alter publication supabase_realtime add table public.asset_movements;
alter publication supabase_realtime add table public.equipment;
