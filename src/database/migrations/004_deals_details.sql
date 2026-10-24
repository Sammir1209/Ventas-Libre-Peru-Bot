-- ══════════════════════════════════════════════════════
-- ⟡ Migración 004: Detalles Enriquecidos de Tratos Admin y Thread ID
-- ══════════════════════════════════════════════════════

ALTER TABLE deals ADD COLUMN IF NOT EXISTS role VARCHAR(50);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS counterpart VARCHAR(255);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS creator_username VARCHAR(255);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS thread_id BIGINT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'PEN';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS fee NUMERIC(12, 2);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS phase VARCHAR(50) DEFAULT 'AGREEMENT';
