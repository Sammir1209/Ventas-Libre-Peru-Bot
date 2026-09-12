-- ══════════════════════════════════════════════════════
-- Migración 005: Group Help Core, Seguridad y Anti-Raid
-- ══════════════════════════════════════════════════════

-- 1. Tabla de configuración de seguridad y características por grupo
CREATE TABLE IF NOT EXISTS group_security_settings (
    chat_id BIGINT PRIMARY KEY,
    anti_raid_enabled BOOLEAN DEFAULT TRUE,
    anti_raid_threshold INT DEFAULT 6,          -- Usuarios en ventana
    anti_raid_window_seconds INT DEFAULT 10,     -- Ventana en segundos
    anti_raid_action VARCHAR(20) DEFAULT 'MUTE', -- MUTE, KICK, BAN
    lockdown_active BOOLEAN DEFAULT FALSE,
    anti_flood_enabled BOOLEAN DEFAULT TRUE,
    anti_flood_msg_limit INT DEFAULT 5,         -- Mensajes en ventana
    anti_flood_window_seconds INT DEFAULT 4,    -- Segundos
    anti_arab_enabled BOOLEAN DEFAULT FALSE,     -- Bloqueo scripts árabes/RTL
    anti_bot_enabled BOOLEAN DEFAULT TRUE,       -- Expulsar bots no autorizados
    warn_limit INT DEFAULT 3,
    warn_action VARCHAR(20) DEFAULT 'MUTE',      -- MUTE, KICK, BAN
    warn_duration VARCHAR(20) DEFAULT '1d',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla de bloqueos selectivos (Locks)
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

-- 3. Tabla de notas y hashtags (#tag)
CREATE TABLE IF NOT EXISTS group_notes (
    id SERIAL PRIMARY KEY,
    chat_id BIGINT NOT NULL,
    name VARCHAR(64) NOT NULL,
    content TEXT NOT NULL,
    file_id TEXT,
    media_type VARCHAR(32), -- photo, document, video, sticker
    buttons JSONB DEFAULT '[]',
    created_by BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(chat_id, name)
);

-- 4. Tabla de filtros de palabras clave
CREATE TABLE IF NOT EXISTS group_filters (
    id SERIAL PRIMARY KEY,
    chat_id BIGINT NOT NULL,
    keyword VARCHAR(64) NOT NULL,
    response_text TEXT,
    action VARCHAR(20) DEFAULT 'REPLY', -- REPLY, DELETE, WARN, MUTE
    created_by BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(chat_id, keyword)
);

-- Índices de alto rendimiento
CREATE INDEX IF NOT EXISTS idx_group_notes_chat_name ON group_notes(chat_id, name);
CREATE INDEX IF NOT EXISTS idx_group_filters_chat_kw ON group_filters(chat_id, keyword);
