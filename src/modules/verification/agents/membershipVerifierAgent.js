// ══════
// ⟡ Sub-Agente 2: MembershipVerifierAgent (Comprobador Concurrente de Canales)
//   Ejecución paralela, tolerancia a fallos y auto-omisión de canales inaccesibles
// ══════

class MembershipVerifierAgent {
  /**
   * Determina si un error reportado por Telegram significa que el bot no puede consultar el chat.
   */
  static isInaccessibleChannelError(err) {
    const msg = err?.message || '';
    return (
      msg.includes('kicked') ||
      msg.includes('not a member') ||
      msg.includes('chat not found') ||
      msg.includes('Forbidden') ||
      msg.includes('CHAT_ADMIN_REQUIRED') ||
      msg.includes('403') ||
      msg.includes('chat_id is empty')
    );
  }

  /**
   * Evalúa la membresía del usuario en todos los canales requeridos de manera PARALELA.
   * Retorna { isVerified, missingChannels, checkedCount, skippedCount }.
   */
  static async verifyChannels(api, channels, userId) {
    if (!Array.isArray(channels) || channels.length === 0) {
      return { isVerified: true, missingChannels: [], checkedCount: 0, skippedCount: 0 };
    }

    const checkPromises = channels.map(async (channel) => {
      let targetChatId = channel;
      // Normalizar enlaces específicos conocidos si aplica
      if (typeof channel === 'string' && (channel.includes('3My6QWWVjMw2Mzc8') || channel.includes('MADRE'))) {
        targetChatId = -1002561445231;
      }

      try {
        const member = await api.getChatMember(targetChatId, userId);
        const validStatuses = ['creator', 'administrator', 'member'];
        if (validStatuses.includes(member.status)) {
          return { channel, joined: true };
        }
        if (member.status === 'restricted' && member.is_member !== false) {
          return { channel, joined: true };
        }
        return { channel, joined: false };
      } catch (err) {
        if (this.isInaccessibleChannelError(err)) {
          // Si el bot no tiene acceso a ese canal, se omite para no perjudicar al usuario legítimo
          return { channel, joined: true, skipped: true };
        }
        return { channel, joined: false, error: err.message };
      }
    });

    const results = await Promise.allSettled(checkPromises);
    const missingChannels = [];
    let skippedCount = 0;
    let checkedCount = 0;

    for (const r of results) {
      if (r.status === 'fulfilled') {
        checkedCount++;
        const val = r.value;
        if (val.skipped) {
          skippedCount++;
        } else if (!val.joined) {
          missingChannels.push(val.channel);
        }
      } else {
        // En caso de rechazo no controlado, se omite con tolerancia
        skippedCount++;
      }
    }

    return {
      isVerified: missingChannels.length === 0,
      missingChannels,
      checkedCount,
      skippedCount,
    };
  }
}

module.exports = MembershipVerifierAgent;

