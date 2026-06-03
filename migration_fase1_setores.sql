-- =============================================================
-- MIGRAÇÃO FASE 1 — Módulo de Setores (Coordenadores)
-- Cole no Supabase Dashboard → SQL Editor → New query → Run
-- =============================================================


-- -------------------------------------------------------------
-- 1. Novo role 'coordenador' na tabela profiles
-- -------------------------------------------------------------
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'tecnico', 'usuario', 'coordenador'));


-- -------------------------------------------------------------
-- 2. Novos campos na tabela rooms
--    - sigla: identificador do setor (ex: DVTI, DCO, DAF)
--    - coordinator_id: vínculo ao perfil do coordenador
-- -------------------------------------------------------------
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS sigla TEXT,
  ADD COLUMN IF NOT EXISTS coordinator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Índice para busca por sigla e unicidade (ignora NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS rooms_sigla_unique
  ON public.rooms (sigla)
  WHERE sigla IS NOT NULL;

-- Índice para busca por coordinator_id
CREATE INDEX IF NOT EXISTS rooms_coordinator_id_idx
  ON public.rooms (coordinator_id)
  WHERE coordinator_id IS NOT NULL;


-- -------------------------------------------------------------
-- 3. Novo campo received_by_profile_id em asset_movements
--    Mantém o campo texto received_by como fallback
-- -------------------------------------------------------------
ALTER TABLE public.asset_movements
  ADD COLUMN IF NOT EXISTS received_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS asset_movements_received_by_profile_idx
  ON public.asset_movements (received_by_profile_id)
  WHERE received_by_profile_id IS NOT NULL;


-- -------------------------------------------------------------
-- 4. Novo campo received_by_profile_id em equipment_locations
-- -------------------------------------------------------------
ALTER TABLE public.equipment_locations
  ADD COLUMN IF NOT EXISTS received_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS equipment_locations_received_by_profile_idx
  ON public.equipment_locations (received_by_profile_id)
  WHERE received_by_profile_id IS NOT NULL;


-- -------------------------------------------------------------
-- 5. RLS: coordenador lê apenas a sala vinculada a ele
--    (políticas aplicadas nas tabelas existentes)
-- -------------------------------------------------------------

-- rooms: coordenador vê apenas a própria sala
DROP POLICY IF EXISTS "coordenador_select_own_room" ON public.rooms;
CREATE POLICY "coordenador_select_own_room"
  ON public.rooms
  FOR SELECT
  TO authenticated
  USING (
    -- admin/tecnico/usuario → já têm política própria
    -- coordenador → só a sala onde é coordinator_id
    (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'coordenador'
    OR coordinator_id = auth.uid()
  );

-- equipment_locations: coordenador vê só equipamentos da sua sala
DROP POLICY IF EXISTS "coordenador_select_own_room_equipment" ON public.equipment_locations;
CREATE POLICY "coordenador_select_own_room_equipment"
  ON public.equipment_locations
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'coordenador'
    OR current_room_id IN (
      SELECT id FROM public.rooms WHERE coordinator_id = auth.uid()
    )
  );

-- asset_movements: coordenador vê movimentações com destino/origem na sua sala
DROP POLICY IF EXISTS "coordenador_select_own_room_movements" ON public.asset_movements;
CREATE POLICY "coordenador_select_own_room_movements"
  ON public.asset_movements
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'coordenador'
    OR destination_room_id IN (
      SELECT id FROM public.rooms WHERE coordinator_id = auth.uid()
    )
    OR origin_room_id IN (
      SELECT id FROM public.rooms WHERE coordinator_id = auth.uid()
    )
  );

-- equipment: coordenador vê equipamentos que estão na sua sala
DROP POLICY IF EXISTS "coordenador_select_own_room_equip" ON public.equipment;
CREATE POLICY "coordenador_select_own_room_equip"
  ON public.equipment
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'coordenador'
    OR id IN (
      SELECT equipment_id FROM public.equipment_locations
      WHERE current_room_id IN (
        SELECT id FROM public.rooms WHERE coordinator_id = auth.uid()
      )
    )
  );


-- -------------------------------------------------------------
-- Verificação (opcional — rode após a migration para confirmar)
-- -------------------------------------------------------------
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'rooms' AND column_name IN ('sigla', 'coordinator_id');

-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'asset_movements' AND column_name = 'received_by_profile_id';

-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'equipment_locations' AND column_name = 'received_by_profile_id';
