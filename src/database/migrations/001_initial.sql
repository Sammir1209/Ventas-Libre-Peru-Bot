-- ══════════════════════════════════════════════════════
-- ⟡ Ventas Libres Perú — Schema Inicial
-- ══════════════════════════════════════════════════════

-- ── Usuarios verificados ──
CREATE TABLE IF NOT EXISTS users (
  user_id       BIGINT PRIMARY KEY,
  username      VARCHAR(255),
  first_name    VARCHAR(255),
  verified      BOOLEAN DEFAULT FALSE,
  verified_at   TIMESTAMP WITH TIME ZONE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Staff y roles ──
CREATE TABLE IF NOT EXISTS staff (
  user_id       BIGINT PRIMARY KEY,
  username      VARCHAR(255),
  first_name    VARCHAR(255),
  role          VARCHAR(50) NOT NULL,  -- 'OWNER', 'CO-OWNER', 'TRATO ADMIN'
  assigned_by   BIGINT,
  assigned_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Tratos / Escrow ──
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

-- ── Calificaciones de Admins ──
CREATE TABLE IF NOT EXISTS ratings (
  id            SERIAL PRIMARY KEY,
  deal_id       INTEGER REFERENCES deals(id) ON DELETE CASCADE,
  admin_id      BIGINT NOT NULL,
  rater_id      BIGINT NOT NULL,
  stars         SMALLINT NOT NULL CHECK (stars >= 1 AND stars <= 5),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(deal_id, rater_id)
);

-- ── Grupos oficiales registrados ──
CREATE TABLE IF NOT EXISTS official_groups (
  chat_id       BIGINT PRIMARY KEY,
  title         VARCHAR(500),
  added_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Configuración y Ajustes del Bot (Hilos, Temas y Canales) ──
CREATE TABLE IF NOT EXISTS bot_settings (
  key           VARCHAR(255) PRIMARY KEY,
  value         TEXT NOT NULL,
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Estafadores quemados (Lista Negra Oficial) ──
CREATE TABLE IF NOT EXISTS burned_users (
  user_id       BIGINT PRIMARY KEY,
  username      VARCHAR(255),
  first_name    VARCHAR(255),
  reported_by   BIGINT NOT NULL,
  context       TEXT,
  approved_by   BIGINT,
  burned_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Asegurar columnas si ya existía la tabla
ALTER TABLE burned_users ADD COLUMN IF NOT EXISTS username VARCHAR(255);
ALTER TABLE burned_users ADD COLUMN IF NOT EXISTS first_name VARCHAR(255);

-- ── Reportes pendientes de /quemar ──
CREATE TABLE IF NOT EXISTS burn_reports (
  id            SERIAL PRIMARY KEY,
  reporter_id   BIGINT NOT NULL,
  target_id     BIGINT NOT NULL,
  context       TEXT,
  proof_file_ids TEXT[],  -- Array de file_id de Telegram (temporales)
  proof_urls    TEXT[],   -- Array de URLs permanentes de Supabase Storage
  status        VARCHAR(30) DEFAULT 'PENDING',  -- PENDING, APPROVED, REJECTED
  reviewed_by   BIGINT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at   TIMESTAMP WITH TIME ZONE
);

-- ── Logs de moderación ──
CREATE TABLE IF NOT EXISTS mod_logs (
  id            SERIAL PRIMARY KEY,
  action        VARCHAR(50) NOT NULL,  -- BAN, UNBAN, MUTE, UNMUTE, BURN
  moderator_id  BIGINT NOT NULL,
  target_id     BIGINT NOT NULL,
  chat_id       BIGINT,
  reason        TEXT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Índices ──
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_creator ON deals(creator_id);
CREATE INDEX IF NOT EXISTS idx_deals_admin ON deals(admin_id);
CREATE INDEX IF NOT EXISTS idx_ratings_admin ON ratings(admin_id);
CREATE INDEX IF NOT EXISTS idx_burn_reports_status ON burn_reports(status);
CREATE INDEX IF NOT EXISTS idx_mod_logs_action ON mod_logs(action);
CREATE INDEX IF NOT EXISTS idx_mod_logs_moderator ON mod_logs(moderator_id);
