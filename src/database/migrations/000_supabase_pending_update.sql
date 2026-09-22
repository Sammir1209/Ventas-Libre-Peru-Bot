-- ══════════════════════════════════════════════════════════════
-- ⟡ VENTAS LIBRES PERÚ — ACTUALIZACIÓN COMPLETA PARA SUPABASE
-- ══════════════════════════════════════════════════════════════
-- Instrucciones:
-- 1. Entra a tu panel de Supabase: https://supabase.com/dashboard/project/sblafmztxfwhgqgkdspx
-- 2. Ve a la pestaña "SQL Editor" en el menú izquierdo.
-- 3. Pega este código completo y haz clic en "RUN".
-- ══════════════════════════════════════════════════════════════

-- ── 1. Tablas de Seguridad de Grupos, Anti-Raid y Filtros (Migración 005) ──

CREATE TABLE IF NOT EXISTS group_security_settings (
    chat_id BIGINT PRIMARY KEY,
    anti_raid_enabled BOOLEAN DEFAULT TRUE,
    anti_raid_threshold INT DEFAULT 6,
    anti_raid_window_seconds INT DEFAULT 10,
    anti_raid_action VARCHAR(20) DEFAULT 'MUTE',
    lockdown_active BOOLEAN DEFAULT FALSE,
    anti_flood_enabled BOOLEAN DEFAULT TRUE,
    anti_flood_msg_limit INT DEFAULT 5,
    anti_flood_window_seconds INT DEFAULT 4,
    anti_arab_enabled BOOLEAN DEFAULT FALSE,
    anti_bot_enabled BOOLEAN DEFAULT TRUE,
    warn_limit INT DEFAULT 3,
    warn_action VARCHAR(20) DEFAULT 'MUTE',
    warn_duration VARCHAR(20) DEFAULT '1d',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_locks (
    chat_id BIGINT PRIMARY KEY,
    lock_links BOOLEAN DEFAULT FALSE,
    lock_forwards BOOLEAN DEFAULT FALSE,
    lock_stickers BOOLEAN DEFAULT FALSE,
    lock_gifs BOOLEAN DEFAULT FALSE,
    lock_audio BOOLEAN DEFAULT FALSE,
    lock_voice BOOLEAN DEFAULT FALSE,
    lock_video BOOLEAN DEFAULT FALSE,
    lock_docs BOOLEAN DEFAULT FALSE,
    lock_bots BOOLEAN DEFAULT FALSE,
    lock_games BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_notes (
    id SERIAL PRIMARY KEY,
    chat_id BIGINT NOT NULL,
    name VARCHAR(64) NOT NULL,
    content TEXT NOT NULL,
    file_id TEXT,
    media_type VARCHAR(32),
    buttons JSONB DEFAULT '[]',
    created_by BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(chat_id, name)
);

CREATE TABLE IF NOT EXISTS group_filters (
    id SERIAL PRIMARY KEY,
    chat_id BIGINT NOT NULL,
    keyword VARCHAR(64) NOT NULL,
    response_text TEXT,
    action VARCHAR(20) DEFAULT 'REPLY',
    created_by BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(chat_id, keyword)
);

CREATE INDEX IF NOT EXISTS idx_group_notes_chat_name ON group_notes(chat_id, name);
CREATE INDEX IF NOT EXISTS idx_group_filters_chat_kw ON group_filters(chat_id, keyword);

-- ── 2. Columnas de Tratos Admin Enriquecidos (Migración 004) ──

ALTER TABLE deals ADD COLUMN IF NOT EXISTS role VARCHAR(50);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS counterpart VARCHAR(255);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS creator_username VARCHAR(255);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS thread_id BIGINT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_deals_tenant ON deals(tenant_id);

-- ── 3. Personalización y Branding de Sub-Bots (Migración 006) ──

ALTER TABLE sub_bots ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT '{}'::jsonb;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS custom_title VARCHAR(100);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT NULL;
ALTER TABLE official_groups ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT NULL;

-- Recargar caché de esquemas de Supabase PostgREST
NOTIFY pgrst, 'reload schema';
