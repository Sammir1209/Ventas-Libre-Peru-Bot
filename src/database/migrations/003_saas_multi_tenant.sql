-- ══════════════════════════════════════════════════════
-- ⟡ MIGRACIÓN COMPLETA 003: SaaS Multi-Tenant & Aislamiento
-- ══════════════════════════════════════════════════════

-- 1. Tabla de Sub-Bots
CREATE TABLE IF NOT EXISTS sub_bots (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_token               VARCHAR(255) UNIQUE NOT NULL,
  bot_username            VARCHAR(255),
  community_name          VARCHAR(255) NOT NULL DEFAULT 'Ventas Libres Perú',
  owner_ids               BIGINT[] NOT NULL DEFAULT '{}',
  plan_status             VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  expires_at              TIMESTAMP WITH TIME ZONE,
  channels_to_verify      JSONB DEFAULT '[]'::jsonb,
  groups_folder_link      TEXT,
  staff_chat_id           BIGINT,
  staff_thread_id         BIGINT,
  log_channel_id          BIGINT,
  log_thread_id           BIGINT,
  burn_chat_id            BIGINT,
  burn_thread_id          BIGINT,
  public_burn_channel_id  BIGINT,
  public_burn_thread_id   BIGINT,
  escrow_group_id         BIGINT,
  custom_settings         JSONB DEFAULT '{}'::jsonb,
  created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_sub_bots_status ON sub_bots(plan_status);
CREATE INDEX IF NOT EXISTS idx_sub_bots_bot_username ON sub_bots(bot_username);

-- 2. Asegurar Tabla de Staff y Aislamiento por Sub-Bot
CREATE TABLE IF NOT EXISTS staff (
  user_id       BIGINT PRIMARY KEY,
  username      VARCHAR(255),
  first_name    VARCHAR(255),
  role          VARCHAR(255) NOT NULL,
  custom_title  VARCHAR(100),
  assigned_by   BIGINT,
  tenant_id     UUID DEFAULT NULL,
  assigned_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE staff ADD COLUMN IF NOT EXISTS custom_title VARCHAR(100);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_staff_tenant ON staff(tenant_id);

-- 3. Asegurar Tabla de Grupos Oficiales
CREATE TABLE IF NOT EXISTS official_groups (
  chat_id       BIGINT PRIMARY KEY,
  title         VARCHAR(500),
  type          VARCHAR(50) DEFAULT 'supergroup',
  username      VARCHAR(255),
  tenant_id     UUID DEFAULT NULL,
  added_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE official_groups ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_groups_tenant ON official_groups(tenant_id);

-- 4. Asegurar Tabla de Tratos (Deals)
CREATE TABLE IF NOT EXISTS deals (
  id            SERIAL PRIMARY KEY,
  creator_id    BIGINT NOT NULL,
  admin_id      BIGINT,
  group_chat_id BIGINT,
  invite_link   TEXT,
  status        VARCHAR(30) DEFAULT 'PENDING',
  tenant_id     UUID DEFAULT NULL,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_at   TIMESTAMP WITH TIME ZONE,
  completed_at  TIMESTAMP WITH TIME ZONE
);

ALTER TABLE deals ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_tenant ON deals(tenant_id);

-- 5. Asegurar Tabla de Ajustes del Bot
CREATE TABLE IF NOT EXISTS bot_settings (
  key           VARCHAR(255) PRIMARY KEY,
  value         TEXT NOT NULL,
  tenant_id     UUID DEFAULT NULL,
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE bot_settings ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT NULL;
