-- ══════════════════════════════════════════════════════
-- ⟡ MIGRACIÓN 006: Branding Multi-Tenant para Panel Web
-- ══════════════════════════════════════════════════════

-- Agregar columna branding al sub_bots para personalización visual del panel
ALTER TABLE sub_bots ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT '{}'::jsonb;

-- Ejemplo de estructura branding:
-- {
--   "logo_url": "https://example.com/logo.png",
--   "community_display_name": "SafeShop Perú",
--   "accent_color": "#8b5cf6",
--   "theme": "client"
-- }
