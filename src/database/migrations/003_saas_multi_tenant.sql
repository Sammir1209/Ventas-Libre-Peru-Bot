-- ══════════════════════════════════════════════════════
-- ⟡ MIGRACIÓN 003: Plataforma SaaS Multi-Tenant (Sub-Bots)
-- ══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sub_bots (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_token               VARCHAR(255) UNIQUE NOT NULL,
  bot_username            VARCHAR(255),
  community_name          VARCHAR(255) NOT NULL DEFAULT 'Ventas Libres Perú',
  owner_ids               BIGINT[] NOT NULL DEFAULT '{}',
  plan_status             VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'EXPIRED', 'SUSPENDED'
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

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_sub_bots_status ON sub_bots(plan_status);
CREATE INDEX IF NOT EXISTS idx_sub_bots_bot_username ON sub_bots(bot_username);
