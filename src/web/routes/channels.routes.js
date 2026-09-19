// ══════
// ⟡ Rutas de Canales de Verificación & Enlaces Oficiales (Bot Principal)
// ══════

const { Router } = require('express');
const { requireAdminAuth } = require('../middlewares/auth');
const db = require('../../database/postgres');
const config = require('../../config/env');
const { invalidateChannelsCache } = require('../../modules/verification/handler');

const router = Router();
router.use(requireAdminAuth);

/**
 * GET /api/channels
 * Obtiene los canales de verificación y enlaces oficiales del bot principal
 */
router.get('/', async (req, res) => {
  try {
    const rawChannels = await db.getSetting('channels_to_verify');
    let channelsStr = '';
    if (rawChannels) {
      try {
        const parsed = JSON.parse(rawChannels);
        if (Array.isArray(parsed)) {
          channelsStr = parsed.join('\n');
        } else {
          channelsStr = String(rawChannels);
        }
      } catch {
        channelsStr = String(rawChannels);
      }
    } else if (Array.isArray(config.CHANNELS_TO_VERIFY)) {
      channelsStr = config.CHANNELS_TO_VERIFY.join('\n');
    }

    const staffLink = (await db.getSetting('staff_invite_link')) || '';
    const folderLink = (await db.getSetting('groups_folder_link')) || config.GROUPS_FOLDER_LINK || '';
    const communityName = (await db.getSetting('community_name')) || 'Ventas Libres Perú';
    const welcomeMsg = (await db.getSetting('welcome_message')) || '';
    const primaryChatId = (await db.getSetting('primary_verification_chat')) || '';

    return res.json({
      ok: true,
      settings: {
        channels_to_verify: channelsStr,
        staff_invite_link: staffLink,
        groups_folder_link: folderLink,
        community_name: communityName,
        welcome_message: welcomeMsg,
      },
      primaryChatId,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * PUT /api/channels
 * Guarda canales y enlaces oficiales del bot principal
 */
router.put('/', async (req, res) => {
  try {
    const {
      channels_to_verify,
      staff_invite_link,
      groups_folder_link,
      community_name,
      welcome_message,
    } = req.body;

    if (channels_to_verify !== undefined) {
      let arr = [];
      if (Array.isArray(channels_to_verify)) {
        arr = channels_to_verify.map((s) => String(s).trim()).filter(Boolean);
      } else if (typeof channels_to_verify === 'string') {
        arr = channels_to_verify
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
      }
      await db.setSetting('channels_to_verify', JSON.stringify(arr));
      invalidateChannelsCache();
    }

    if (staff_invite_link !== undefined) {
      await db.setSetting('staff_invite_link', String(staff_invite_link).trim());
    }

    if (groups_folder_link !== undefined) {
      await db.setSetting('groups_folder_link', String(groups_folder_link).trim());
    }

    if (community_name !== undefined) {
      await db.setSetting('community_name', String(community_name).trim());
    }

    if (welcome_message !== undefined) {
      await db.setSetting('welcome_message', String(welcome_message).trim());
    }

    return res.json({
      ok: true,
      message: 'Canales de verificación y enlaces guardados exitosamente.',
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
