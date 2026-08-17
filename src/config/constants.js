// ══════════════════════════════════════════════════════
// ⟡ Constantes Globales — Ventas Libres Perú
// ══════════════════════════════════════════════════════

// ── Símbolos Estéticos y Separadores de Diseño (Glyphy Aesthetic Symbols) ──
const SYM = {
  // Símbolos Principales y Marcas
  DIAMOND:    '⟡',
  STAR:       '✧',
  STAR_FULL:  '✦',
  FLOWER:     '✤',
  CROWN:      '♔',
  SEAL:       '㉿',
  BADGE:      '〄',
  SHIELD:     '⛊',
  SWORD:      '⚔',
  WARNING:    '⚠',
  ALERT:      '⨻',
  PRINT:      '⎙',
  EDIT:       '✎',

  // Flechas y Punteros
  ARROW:      '➜',
  ARROW_THIN: '»',
  BULLET:     '▸',
  DOT:        '·',
  CHECK:      '✓',
  CROSS:      '✗',
  CIRCLE:     '◉',
  RING:       '○',

  // Números Circulares
  NUM_1:      '①',
  NUM_2:      '②',
  NUM_3:      '③',
  NUM_4:      '④',
  NUM_5:      '⑤',

  // Líneas y Separadores Ultra-Clean (Ajuste estilizado y compacto)
  DASH:       '━',
  DASH_SLIM:  '─',
  DIVIDER:    '━━━━━━━━━━━━',
  LINE:       '━━━━━━━━━━━━',
  THIN_LINE:  '────────────',
  FRAME_DIV:  '⊱ ━━━━━━━━━━ ⊰',
};

// ── Roles del Staff ──
const ROLES = {
  OWNER:       'OWNER',
  CO_OWNER:    'CO-OWNER',
  DEAL_ADMIN:  'TRATO ADMIN',
};

// ── Estados de Tratos (Escrow) ──
const DEAL_STATUS = {
  PENDING:     'PENDING',
  ASSIGNED:    'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED:   'COMPLETED',
  CANCELLED:   'CANCELLED',
};

// ── Estados del flujo /quemar ──
const BURN_STEPS = {
  IDLE:          'IDLE',
  AWAIT_ID:      'AWAIT_ID',
  AWAIT_CONTEXT: 'AWAIT_CONTEXT',
  AWAIT_PROOF:   'AWAIT_PROOF',
  CONFIRM:       'CONFIRM',
};

// ── Prefijos de Callback Data ──
const CB = {
  VERIFY:             'verify_membership',
  HOW_IT_WORKS:       'how_it_works',
  START_DEAL:         'start_deal',
  DEAL_INFO:          'deal_info',
  DEAL_CANCEL:        'deal_cancel',
  DEAL_ACCEPT:        'deal_accept:',      // + dealId
  DEAL_COMPLETE:      'deal_complete:',     // + dealId
  DEAL_RATE:          'deal_rate:',         // + dealId:stars
  BURN_SEND:          'burn_send',
  BURN_APPROVE:       'burn_approve:',      // + reportId
  BURN_REJECT:        'burn_reject:',       // + reportId
  BURN_BAN_REPORTER:  'burn_ban_reporter:', // + reportId
};

// ── Comisión del Escrow ──
const ESCROW_COMMISSION = 0.10; // 10%

// ── Rate Limiting ──
const RATE_LIMIT = {
  WINDOW_SECONDS: 60,
  MAX_COMMANDS:   10,
};

module.exports = {
  SYM,
  ROLES,
  DEAL_STATUS,
  BURN_STEPS,
  CB,
  ESCROW_COMMISSION,
  RATE_LIMIT,
};
