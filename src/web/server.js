const express = require('express');
const path = require('path');
const db = require('../database/postgres');
const botManager = require('../core/botManager');
const https = require('https');

// ══════════════════════════════════════════════════════
// ⟡ Servidor Web y API REST — SaaS Sub-Bots Dashboard
// ══════════════════════════════════════════════════════

function testTelegramToken(token) {
  return new Promise((resolve, reject) => {
    const url = `https://api.telegram.org/bot${token}/getMe`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.ok) {
            resolve(json.result);
          } else {
            reject(new Error(json.description || 'Token inválido en Telegram'));
          }
        } catch {
          reject(new Error('Respuesta inválida de Telegram'));
        }
      });
    }).on('error', (err) => reject(err));
  });
}

function createWebApp() {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Servir archivos estáticos del panel web
  app.use(express.static(path.join(__dirname, 'public')));

  // ── API: Probar Token con Telegram ──
  app.post('/api/test-token', async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ ok: false, error: 'Token requerido' });

      const botInfo = await testTelegramToken(token);
      res.json({ ok: true, bot: botInfo });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  // ── API: Listar Sub-Bots ──
  app.get('/api/subbots', async (req, res) => {
    try {
      const bots = await db.getAllSubBots();
      const liveStatus = botManager.getLiveStatus();
      const liveMap = new Map(liveStatus.map((s) => [s.id, s]));

      const enriched = bots.map((b) => {
        const live = liveMap.get(b.id);
        return {
          ...b,
          isOnline: !!live,
          liveStatus: live ? live.status : 'OFFLINE',
          startedAt: live ? live.startedAt : null,
        };
      });

      res.json({ ok: true, bots: enriched });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ── API: Crear Nuevo Sub-Bot ──
  app.post('/api/subbots', async (req, res) => {
    try {
      const {
        bot_token,
        community_name,
        owner_id,
        channels_to_verify,
        groups_folder_link,
        duration_days,
        staff_chat_id,
        escrow_group_id,
        log_channel_id,
        burn_chat_id,
        public_burn_channel_id,
      } = req.body;

      if (!bot_token) {
        return res.status(400).json({ ok: false, error: 'El Token de BotFather es obligatorio.' });
      }

      // Validar token en Telegram
      const botInfo = await testTelegramToken(bot_token);

      // Calcular expiración
      let expiresAt = null;
      if (duration_days && Number(duration_days) > 0) {
        const d = new Date();
        d.setDate(d.getDate() + Number(duration_days));
        expiresAt = d.toISOString();
      }

      const ownerIds = owner_id ? [Number(owner_id)] : [];

      let channelsArray = [];
      if (channels_to_verify) {
        if (Array.isArray(channels_to_verify)) {
          channelsArray = channels_to_verify;
        } else if (typeof channels_to_verify === 'string') {
          channelsArray = channels_to_verify.split(',').map((c) => c.trim()).filter(Boolean);
        }
      }

      const newBotData = {
        bot_token: bot_token.trim(),
        bot_username: botInfo.username,
        community_name: community_name?.trim() || `Comunidad de @${botInfo.username}`,
        owner_ids: ownerIds,
        plan_status: 'ACTIVE',
        expires_at: expiresAt,
        channels_to_verify: channelsArray,
        groups_folder_link: groups_folder_link?.trim() || null,
        staff_chat_id: staff_chat_id ? Number(staff_chat_id) : null,
        escrow_group_id: escrow_group_id ? Number(escrow_group_id) : null,
        log_channel_id: log_channel_id ? Number(log_channel_id) : null,
        burn_chat_id: burn_chat_id ? Number(burn_chat_id) : null,
        public_burn_channel_id: public_burn_channel_id ? Number(public_burn_channel_id) : null,
      };

      const saved = await db.createSubBot(newBotData);

      // Iniciar instancia automáticamente en vivo
      if (saved && saved.id) {
        try {
          await botManager.startSubBot(saved);
        } catch (startErr) {
          console.warn('⟡ No se pudo iniciar el bot en vivo inmediatamente:', startErr.message);
        }
      }

      res.json({ ok: true, subBot: saved });
    } catch (err) {
      console.error('⟡ Error creando sub-bot:', err.message);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ── API: Iniciar Sub-Bot ──
  app.post('/api/subbots/:id/start', async (req, res) => {
    try {
      const { id } = req.params;
      const subBot = await db.getSubBotById(id);
      if (!subBot) return res.status(404).json({ ok: false, error: 'Sub-bot no encontrado.' });

      await botManager.startSubBot(subBot);
      await db.updateSubBot(id, { plan_status: 'ACTIVE' });

      res.json({ ok: true, message: 'Sub-bot iniciado exitosamente.' });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ── API: Detener Sub-Bot ──
  app.post('/api/subbots/:id/stop', async (req, res) => {
    try {
      const { id } = req.params;
      await botManager.stopSubBot(id);
      await db.updateSubBot(id, { plan_status: 'SUSPENDED' });

      res.json({ ok: true, message: 'Sub-bot detenido.' });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ── API: Eliminar Sub-Bot ──
  app.delete('/api/subbots/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await botManager.stopSubBot(id);
      await db.deleteSubBot(id);

      res.json({ ok: true, message: 'Sub-bot eliminado.' });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return app;
}

module.exports = { createWebApp };
