-- =============================================================
-- MIGRAÇÃO FASE 6 — Conferências de Setores
-- Cole no Supabase Dashboard → SQL Editor → New query → Run
-- =============================================================


-- -------------------------------------------------------------
-- 1. Tabela room_conferences
--    Registra uma conferência mensal feita por um coordenador
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.room_conferences (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id          UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  coordinator_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  competencia      TEXT NOT NULL,  -- formato 'YYYY-MM', ex: '2026-06'
  concluded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Só pode haver uma conferência por sala por mês
  CONSTRAINT room_conferences_room_competencia_unique UNIQUE (room_id, competencia)
);

CREATE INDEX IF NOT EXISTS room_conferences_room_id_idx
  ON public.room_conferences (room_id);

CREATE INDEX IF NOT EXISTS room_conferences_coordinator_id_idx
  ON public.room_conferences (coordinator_id);

CREATE INDEX IF NOT EXISTS room_conferences_competencia_idx
  ON public.room_conferences (competencia);


-- -------------------------------------------------------------
-- 2. Tabela conference_items
--    Snapshot de cada equipamento no momento da conferência
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conference_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id    UUID NOT NULL REFERENCES public.room_conferences(id) ON DELETE CASCADE,
  asset_number     TEXT,
  serial_number    TEXT,
  equipment_name   TEXT,
  categoria        TEXT,
  -- ok | ausente | com_problema
  status           TEXT NOT NULL DEFAULT 'ok'
                     CHECK (status IN ('ok', 'ausente', 'com_problema')),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conference_items_conference_id_idx
  ON public.conference_items (conference_id);


-- -------------------------------------------------------------
-- 3. Tabela conference_occurrences
--    Gerada automaticamente para itens com status != 'ok'
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conference_occurrences (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id        UUID NOT NULL REFERENCES public.room_conferences(id) ON DELETE CASCADE,
  conference_item_id   UUID REFERENCES public.conference_items(id) ON DELETE SET NULL,
  room_id              UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  asset_number         TEXT,
  equipment_name       TEXT,
  -- ausente | com_problema
  occurrence_type      TEXT NOT NULL CHECK (occurrence_type IN ('ausente', 'com_problema')),
  description          TEXT,
  -- aberta | resolvida
  status               TEXT NOT NULL DEFAULT 'aberta'
                         CHECK (status IN ('aberta', 'resolvida')),
  resolved_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at          TIMESTAMPTZ,
  resolution_notes     TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conference_occurrences_conference_id_idx
  ON public.conference_occurrences (conference_id);

CREATE INDEX IF NOT EXISTS conference_occurrences_room_id_idx
  ON public.conference_occurrences (room_id);

CREATE INDEX IF NOT EXISTS conference_occurrences_status_idx
  ON public.conference_occurrences (status);


-- -------------------------------------------------------------
-- 4. RLS — room_conferences
-- -------------------------------------------------------------
ALTER TABLE public.room_conferences ENABLE ROW LEVEL SECURITY;

-- Coordenador: lê e insere apenas da própria sala
DROP POLICY IF EXISTS "coordenador_select_own_conferences" ON public.room_conferences;
CREATE POLICY "coordenador_select_own_conferences"
  ON public.room_conferences FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'coordenador'
    OR coordinator_id = auth.uid()
  );

DROP POLICY IF EXISTS "coordenador_insert_own_conferences" ON public.room_conferences;
CREATE POLICY "coordenador_insert_own_conferences"
  ON public.room_conferences FOR INSERT TO authenticated
  WITH CHECK (
    coordinator_id = auth.uid()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'coordenador'
  );


-- -------------------------------------------------------------
-- 5. RLS — conference_items
-- -------------------------------------------------------------
ALTER TABLE public.conference_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_conference_items" ON public.conference_items;
CREATE POLICY "select_conference_items"
  ON public.conference_items FOR SELECT TO authenticated
  USING (
    conference_id IN (
      SELECT id FROM public.room_conferences
      WHERE
        (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'coordenador'
        OR coordinator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_conference_items" ON public.conference_items;
CREATE POLICY "insert_conference_items"
  ON public.conference_items FOR INSERT TO authenticated
  WITH CHECK (
    conference_id IN (
      SELECT id FROM public.room_conferences WHERE coordinator_id = auth.uid()
    )
  );


-- -------------------------------------------------------------
-- 6. RLS — conference_occurrences
-- -------------------------------------------------------------
ALTER TABLE public.conference_occurrences ENABLE ROW LEVEL SECURITY;

-- Todos os autenticados leem (admin/tecnico precisam ver ocorrências abertas)
DROP POLICY IF EXISTS "select_conference_occurrences" ON public.conference_occurrences;
CREATE POLICY "select_conference_occurrences"
  ON public.conference_occurrences FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'tecnico')
    OR room_id IN (
      SELECT id FROM public.rooms WHERE coordinator_id = auth.uid()
    )
  );

-- Apenas coordenador insere (ao finalizar conferência)
DROP POLICY IF EXISTS "insert_conference_occurrences" ON public.conference_occurrences;
CREATE POLICY "insert_conference_occurrences"
  ON public.conference_occurrences FOR INSERT TO authenticated
  WITH CHECK (
    room_id IN (
      SELECT id FROM public.rooms WHERE coordinator_id = auth.uid()
    )
  );

-- Admin e técnico podem atualizar (marcar como resolvida)
DROP POLICY IF EXISTS "update_conference_occurrences" ON public.conference_occurrences;
CREATE POLICY "update_conference_occurrences"
  ON public.conference_occurrences FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'tecnico')
  );


-- -------------------------------------------------------------
-- Verificação (rode após a migration para confirmar)
-- -------------------------------------------------------------
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN ('room_conferences', 'conference_items', 'conference_occurrences');
