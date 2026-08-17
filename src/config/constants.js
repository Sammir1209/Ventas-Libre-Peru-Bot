// ══════════════════════════════════════════════════════
// ⟡ Constantes Globales — Ventas Libres Perú
// ══════════════════════════════════════════════════════

const EMOJI_DASH = '<tg-emoji emoji-id="5255830000707322745">-</tg-emoji>';

// ── Símbolos Estéticos y Separadores Custom ──
const SYM = {
  DIAMOND:    '⟡',
  ARROW:      '»',
  DASH:       EMOJI_DASH,
  DIVIDER:    `${EMOJI_DASH.repeat(8)}`,
  STAR:       '✧',
  STAR_FULL:  '✦',
  DOT:        '·',
  LINE:       `${EMOJI_DASH.repeat(10)}`,
  THIN_LINE:  `${EMOJI_DASH.repeat(8)}`,
  BULLET:     '▸',
  CHECK:      '✓',
  CROSS:      '✗',
  SHIELD:     '⛊',
  CIRCLE:     '◉',
  RING:       '○',
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
