-- =============================================================
-- MIGRACAO - Modulo de Gerenciamento de Impressoras
-- Cole no Supabase Dashboard -> SQL Editor -> New query -> Run
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.printers (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id             UUID REFERENCES public.equipment(id) ON DELETE RESTRICT,
  asset_number             TEXT,
  hostname                 TEXT NOT NULL,
  ip_address               INET NOT NULL,
  room_id                  UUID NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
  status                   TEXT NOT NULL DEFAULT 'ativa'
                             CHECK (status IN ('ativa', 'inativa', 'manutencao')),
  toner_percent            INTEGER CHECK (toner_percent BETWEEN 0 AND 100),
  image_unit_percent       INTEGER CHECK (image_unit_percent BETWEEN 0 AND 100),
  maintenance_kit_percent  INTEGER CHECK (maintenance_kit_percent BETWEEN 0 AND 100),
  created_by               UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by               UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at               TIMESTAMPTZ
);

ALTER TABLE public.printers
  ADD COLUMN IF NOT EXISTS equipment_id UUID REFERENCES public.equipment(id) ON DELETE RESTRICT;

ALTER TABLE public.printers
  ADD COLUMN IF NOT EXISTS asset_number TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS printers_hostname_unique
  ON public.printers (lower(hostname))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS printers_ip_address_unique
  ON public.printers (ip_address)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS printers_asset_number_unique
  ON public.printers (asset_number)
  WHERE deleted_at IS NULL
    AND asset_number IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'printers_asset_number_fkey'
      AND conrelid = 'public.printers'::regclass
  ) THEN
    ALTER TABLE public.printers
      ADD CONSTRAINT printers_asset_number_fkey
      FOREIGN KEY (asset_number)
      REFERENCES public.equipment_locations(asset_number)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS printers_equipment_id_idx
  ON public.printers (equipment_id);

CREATE INDEX IF NOT EXISTS printers_room_id_idx
  ON public.printers (room_id);

CREATE INDEX IF NOT EXISTS printers_status_idx
  ON public.printers (status);

CREATE INDEX IF NOT EXISTS printers_deleted_at_idx
  ON public.printers (deleted_at);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS printers_set_updated_at ON public.printers;
CREATE TRIGGER printers_set_updated_at
  BEFORE UPDATE ON public.printers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.printers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_printers_admin" ON public.printers;
DROP POLICY IF EXISTS "select_printers_admin_tecnico" ON public.printers;
CREATE POLICY "select_printers_admin_tecnico"
  ON public.printers FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'tecnico')
  );

DROP POLICY IF EXISTS "insert_printers_admin" ON public.printers;
DROP POLICY IF EXISTS "insert_printers_admin_tecnico" ON public.printers;
CREATE POLICY "insert_printers_admin_tecnico"
  ON public.printers FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'tecnico')
  );

DROP POLICY IF EXISTS "update_printers_admin" ON public.printers;
DROP POLICY IF EXISTS "update_printers_admin_tecnico" ON public.printers;
CREATE POLICY "update_printers_admin_tecnico"
  ON public.printers FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'tecnico')
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'tecnico')
  );

DROP POLICY IF EXISTS "delete_printers_admin" ON public.printers;
DROP POLICY IF EXISTS "delete_printers_admin_tecnico" ON public.printers;
CREATE POLICY "delete_printers_admin_tecnico"
  ON public.printers FOR DELETE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'tecnico')
  );

-- Verificacao:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'printers'
-- ORDER BY ordinal_position;
