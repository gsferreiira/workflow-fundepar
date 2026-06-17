-- ============================================================
-- MIGRATION: Módulo Patrimônio
-- Fase 1: campo dominio em equipment + role patrimonio
-- ============================================================

-- 1. Nova coluna dominio na tabela equipment
--    Default 'TI' garante compatibilidade total com dados existentes.
ALTER TABLE public.equipment
  ADD COLUMN IF NOT EXISTS dominio text NOT NULL DEFAULT 'TI';

CREATE INDEX IF NOT EXISTS equipment_dominio_idx
  ON public.equipment (dominio)
  WHERE deleted_at IS NULL;

-- 2. Role 'patrimonio' — adicionar à constraint de check se existir.
--    Execute o bloco abaixo SE a tabela profiles tiver uma CHECK constraint
--    restringindo os valores de role. Se role for texto livre, pule este bloco.
/*
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'tecnico', 'usuario', 'coordenador', 'patrimonio'));
*/

-- 3. RLS: patrimonio tem acesso total a equipment (como admin/tecnico)
--    As policies existentes já permitem acesso a qualquer role != 'coordenador',
--    então 'patrimonio' já está coberto sem alteração de policies.

-- Verificação: listar registros com dominio para confirmar
-- SELECT dominio, COUNT(*) FROM public.equipment WHERE deleted_at IS NULL GROUP BY dominio;
