-- ══════════════════════════════════════════════════════
-- ⟡ Migración 004: Detalles Enriquecidos de Tratos Admin
-- ══════════════════════════════════════════════════════

ALTER TABLE deals ADD COLUMN IF NOT EXISTS role VARCHAR(50);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS counterpart VARCHAR(255);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS creator_username VARCHAR(255);
