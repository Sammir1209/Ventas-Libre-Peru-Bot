-- ══════════════════════════════════════════════════════════════
-- ⟡ VENTAS LIBRES PERÚ — SCHEMA MAESTRO DE SUPABASE / POSTGRES
-- ══════════════════════════════════════════════════════════════
-- Copia y pega este script completo en el "SQL Editor" de Supabase
-- para crear o actualizar todas las tablas del bot oficial.

-- 1. Tabla de Usuarios Registrados y Verificados
CREATE TABLE IF NOT EXISTS users (
  user_id       BIGINT PRIMARY KEY,
  username      VARCHAR(255),
  first_name    VARCHAR(255),
  verified      BOOLEAN DEFAULT FALSE,
  is_verified   BOOLEAN DEFAULT FALSE,
  verified_at   TIMESTAMP WITH TIME ZONE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Asegurar columnas si la tabla ya existía
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Tabla de Verificaciones Pendientes (Nuevos miembros silenciados)
CREATE TABLE IF NOT EXISTS pending_verifications (
  id            SERIAL PRIMARY KEY,
  chat_id       BIGINT NOT NULL,
  user_id       BIGINT NOT NULL,
  username      VARCHAR(255),
  first_name    VARCHAR(255),
  welcome_msg_id BIGINT,
  joined_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(chat_id, user_id)
);

-- 3. Tabla de Staff Oficial (Jerarquías y Mediadores)
CREATE TABLE IF NOT EXISTS staff (
  user_id       BIGINT PRIMARY KEY,
  username      VARCHAR(255),
  first_name    VARCHAR(255),
  role          VARCHAR(50) NOT NULL,  -- 'OWNER', 'CO-OWNER', 'ADMIN', 'TRATO ADMIN'
  assigned_by   BIGINT,
  assigned_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabla de Tratos Admin (Sistema Escrow / Intermediación)
CREATE TABLE IF NOT EXISTS deals (
  id            SERIAL PRIMARY KEY,
  creator_id    BIGINT NOT NULL,
  admin_id      BIGINT,
  group_chat_id BIGINT,
  invite_link   TEXT,
  status        VARCHAR(30) DEFAULT 'PENDING',  -- PENDING, ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_at   TIMESTAMP WITH TIME ZONE,
  completed_at  TIMESTAMP WITH TIME ZONE
);

-- 5. Tabla de Calificaciones (Reputación de Mediadores / Trato Admin)
CREATE TABLE IF NOT EXISTS ratings (
  id            SERIAL PRIMARY KEY,
  deal_id       INTEGER REFERENCES deals(id) ON DELETE CASCADE,
  admin_id      BIGINT NOT NULL,
  rater_id      BIGINT NOT NULL,
  stars         SMALLINT NOT NULL CHECK (stars >= 1 AND stars <= 5),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(deal_id, rater_id)
);

-- 6. Tabla de Grupos y Canales Oficiales Registrados
CREATE TABLE IF NOT EXISTS official_groups (
  chat_id       BIGINT PRIMARY KEY,
  title         VARCHAR(500),
  type          VARCHAR(50) DEFAULT 'supergroup',
  username      VARCHAR(255),
  added_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE official_groups ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'supergroup';
ALTER TABLE official_groups ADD COLUMN IF NOT EXISTS username VARCHAR(255);

-- 7. Tabla de Ajustes del Bot (Canales de Verificación, Topics, Hilos)
CREATE TABLE IF NOT EXISTS bot_settings (
  key           VARCHAR(255) PRIMARY KEY,
  value         TEXT NOT NULL,
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Tabla de Estafadores Quemados (Lista Negra Oficial)
CREATE TABLE IF NOT EXISTS burned_users (
  user_id       BIGINT PRIMARY KEY,
  username      VARCHAR(255),
  first_name    VARCHAR(255),
  reported_by   BIGINT NOT NULL,
  context       TEXT,
  approved_by   BIGINT,
  burned_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE burned_users ADD COLUMN IF NOT EXISTS username VARCHAR(255);
ALTER TABLE burned_users ADD COLUMN IF NOT EXISTS first_name VARCHAR(255);

-- 9. Tabla de Reportes de Estafa (/quemar)
CREATE TABLE IF NOT EXISTS burn_reports (
  id            SERIAL PRIMARY KEY,
  reporter_id   BIGINT NOT NULL,
  target_id     BIGINT NOT NULL,
  context       TEXT,
  proof_file_ids TEXT[],  -- IDs de archivos temporales de Telegram
  proof_urls    TEXT[],   -- URLs permanentes en Supabase Storage
  status        VARCHAR(30) DEFAULT 'PENDING',  -- PENDING, APPROVED, REJECTED
  reviewed_by   BIGINT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at   TIMESTAMP WITH TIME ZONE
);

-- 10. Tabla de Logs de Moderación y Auditoría
CREATE TABLE IF NOT EXISTS mod_logs (
  id            SERIAL PRIMARY KEY,
  action        VARCHAR(50) NOT NULL,  -- BAN, UNBAN, MUTE, UNMUTE, GBAN, UNGBAN, BURN
  moderator_id  BIGINT NOT NULL,
  target_id     BIGINT NOT NULL,
  chat_id       BIGINT,
  reason        TEXT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- ⟡ ÍNDICES DE RENDIMIENTO Y BÚSQUEDA RÁPIDA
-- ══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_first_name ON users(first_name);
CREATE INDEX IF NOT EXISTS idx_pending_verifications_user ON pending_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_creator ON deals(creator_id);
CREATE INDEX IF NOT EXISTS idx_deals_admin ON deals(admin_id);
CREATE INDEX IF NOT EXISTS idx_ratings_admin ON ratings(admin_id);
CREATE INDEX IF NOT EXISTS idx_burned_users_username ON burned_users(username);
CREATE INDEX IF NOT EXISTS idx_burn_reports_status ON burn_reports(status);
CREATE INDEX IF NOT EXISTS idx_mod_logs_action ON mod_logs(action);
CREATE INDEX IF NOT EXISTS idx_mod_logs_moderator ON mod_logs(moderator_id);
