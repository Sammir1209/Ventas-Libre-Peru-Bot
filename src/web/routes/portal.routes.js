// ══════
// ⟡ Rutas de Portal Web y Verificación para Sub-Bots (B&W)
// ══════

const { Router } = require('express');
const subbotService = require('../services/subbotService');
const panelHandler = require('../../modules/security/panelHandler');
const config = require('../../config/env');
const db = require('../../database/postgres');

const router = Router();

/**
 * Middleware para autenticar acceso de administración al portal de un sub-bot específico
 */
async function authenticateSubBotAdmin(req, res, next) {
  const token = req.query.token || req.headers['x-auth-token'] || req.body?.token;
  const key = req.headers['x-admin-key'] || req.query.key || req.body?.admin_key;

  // 1. Clave Maestra Global
  if (key && key === (config.ADMIN_KEY || 'vlp_master_key_99x_2026_sec')) {
    req.isAdmin = true;
    return next();
  }

  // 2. Token de Sesión de Telegram (/panel)
  if (token) {
    try {
      const session = await panelHandler.validatePanelSession(token);
      if (session && session.userId) {
        const slug = req.params.slug;
        const subBot = await subbotService.getSubBotBySlug(slug);
        if (!subBot) {
          return res.status(404).json({ ok: false, error: 'Sub-bot no encontrado.' });
        }

        const isOwner = Array.isArray(subBot.owner_ids) && subBot.owner_ids.some(id => Number(id) === Number(session.userId));
        const isGlobal = session.isGlobalOwner || config.OWNER_IDS.includes(Number(session.userId));

        // Verificar si es staff del sub-bot
        const staff = await db.getStaffMember(session.userId, subBot.id);
        const isStaffAdmin = staff && (staff.role.includes('OWNER') || staff.role.includes('CO-OWNER') || staff.role.includes('ADMIN'));

        if (isOwner || isGlobal || isStaffAdmin) {
          req.sessionUser = session;
          req.subBot = subBot;
          return next();
        }
      }
    } catch (err) {
      console.warn('⟡ Error validando sesión de portal sub-bot:', err.message);
    }
  }

  return res.status(401).json({
    ok: false,
    error: 'Acceso no autorizado. Inicia sesión con /panel en tu bot para ingresar al panel de administración.',
  });
}

// ── 1. Endpoint Público: Datos de Landing de Verificación de Sub-Bot ──
router.get('/:slug', async (req, res) => {
  try {
    const data = await subbotService.getPublicLandingData(req.params.slug);
    if (!data) {
      return res.status(404).json({ ok: false, error: 'Comunidad o Sub-Bot no encontrado.' });
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── 2. Endpoint Administrativo: Datos Completos y Staff para el Owner ──
router.get('/:slug/admin/data', authenticateSubBotAdmin, async (req, res) => {
  try {
    const subBot = req.subBot || await subbotService.getSubBotBySlug(req.params.slug);
    if (!subBot) {
      return res.status(404).json({ ok: false, error: 'Sub-bot no encontrado.' });
    }

    const staff = await subbotService.getTenantStaff(subBot.id);
    const groups = await db.getAllGroups(subBot.id);

    res.json({
      ok: true,
      subbot: subBot,
      staff: staff || [],
      groups: groups || [],
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── 3. Endpoint Administrativo: Guardar Enlaces y Ajustes ──
router.put('/:slug/admin/settings', authenticateSubBotAdmin, async (req, res) => {
  try {
    const subBot = req.subBot || await subbotService.getSubBotBySlug(req.params.slug);
    if (!subBot) {
      return res.status(404).json({ ok: false, error: 'Sub-bot no encontrado.' });
    }

    const updates = {};
    if (req.body.staff_invite_link !== undefined) updates.staff_invite_link = req.body.staff_invite_link;
    if (req.body.channels_to_verify !== undefined) updates.channels_to_verify = req.body.channels_to_verify;
    if (req.body.groups_folder_link !== undefined) updates.groups_folder_link = req.body.groups_folder_link;
    if (req.body.community_name !== undefined) updates.community_name = req.body.community_name;
    if (req.body.welcome_message !== undefined) updates.welcome_message = req.body.welcome_message;

    const updated = await subbotService.updateSubBot(subBot.id, updates);
    res.json({ ok: true, message: 'Ajustes actualizados con éxito.', subbot: updated });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// ── 4. Endpoint Administrativo: Añadir o Actualizar Staff en este Sub-Bot ──
router.post('/:slug/admin/staff', authenticateSubBotAdmin, async (req, res) => {
  try {
    const subBot = req.subBot || await subbotService.getSubBotBySlug(req.params.slug);
    if (!subBot) {
      return res.status(404).json({ ok: false, error: 'Sub-bot no encontrado.' });
    }

    const { userId, role, customTitle } = req.body;
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'ID de usuario o @username requerido.' });
    }

    // Resolver ID si es un username
    let resolvedId = Number(userId);
    let username = null;
    let firstName = 'Staff';

    if (isNaN(resolvedId)) {
      const cleanUser = String(userId).replace(/^@/, '');
      const u = await db.getUserByUsername(cleanUser);
      if (u && u.user_id) {
        resolvedId = Number(u.user_id);
        username = u.username;
        firstName = u.first_name || 'Staff';
      } else {
        return res.status(400).json({ ok: false, error: `No se localizó al usuario @${cleanUser}. Ingresa su ID numérico.` });
      }
    } else {
      const u = await db.getUser(resolvedId);
      if (u) {
        username = u.username;
        firstName = u.first_name || 'Staff';
      }
    }

    const staff = await subbotService.updateTenantStaff(subBot.id, {
      userId: resolvedId,
      username,
      firstName,
      role: role || 'ADMIN',
      customTitle: customTitle || role || 'Staff',
      assignedBy: req.sessionUser?.userId || resolvedId,
    });

    res.json({ ok: true, message: 'Miembro añadido al Staff con éxito.', staff });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// ── 5. Endpoint Administrativo: Remover Staff en este Sub-Bot ──
router.delete('/:slug/admin/staff/:userId', authenticateSubBotAdmin, async (req, res) => {
  try {
    const subBot = req.subBot || await subbotService.getSubBotBySlug(req.params.slug);
    if (!subBot) {
      return res.status(404).json({ ok: false, error: 'Sub-bot no encontrado.' });
    }

    const numId = Number(req.params.userId);
    await subbotService.removeTenantStaff(subBot.id, numId);
    res.json({ ok: true, message: 'Miembro removido del Staff.' });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;
