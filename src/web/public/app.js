// ══════════════════════════════════════════════════════
// ⟡ SaaS Sub-Bots Dashboard — Client Application
// ══════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  const botsContainer = document.getElementById('bots-container');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnOpenModal = document.getElementById('btn-open-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelModal = document.getElementById('btn-cancel-modal');
  const modalCreate = document.getElementById('modal-create');
  const formCreate = document.getElementById('form-create-bot');
  const btnVerifyToken = document.getElementById('btn-verify-token');
  const botTokenInput = document.getElementById('bot_token');
  const tokenStatusMsg = document.getElementById('token-status-msg');

  // Stats Elements
  const statTotal = document.getElementById('stat-total');
  const statOnline = document.getElementById('stat-online');
  const statCommunities = document.getElementById('stat-communities');
  const statActive = document.getElementById('stat-active');
  const botsCountBadge = document.getElementById('bots-count-badge');

  // Modal Controls
  btnOpenModal.addEventListener('click', () => modalCreate.classList.add('active'));
  btnCloseModal.addEventListener('click', () => modalCreate.classList.remove('active'));
  btnCancelModal.addEventListener('click', () => modalCreate.classList.remove('active'));
  btnRefresh.addEventListener('click', fetchBots);

  // ── Probar Token con Telegram ──
  btnVerifyToken.addEventListener('click', async () => {
    const token = botTokenInput.value.trim();
    if (!token) {
      tokenStatusMsg.textContent = 'Ingresa un token para verificar.';
      tokenStatusMsg.className = 'token-status error';
      return;
    }

    tokenStatusMsg.textContent = 'Verificando con Telegram API...';
    tokenStatusMsg.className = 'token-status';

    try {
      const res = await fetch('/api/test-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();

      if (data.ok) {
        tokenStatusMsg.textContent = `✓ Bot Válido: @${data.bot.username} (${data.bot.first_name})`;
        tokenStatusMsg.className = 'token-status success';
      } else {
        tokenStatusMsg.textContent = `✗ Error: ${data.error}`;
        tokenStatusMsg.className = 'token-status error';
      }
    } catch (err) {
      tokenStatusMsg.textContent = `✗ Error de conexión: ${err.message}`;
      tokenStatusMsg.className = 'token-status error';
    }
  });

  // ── Cargar Lista de Sub-Bots ──
  async function fetchBots() {
    botsContainer.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Cargando sub-bots en tiempo real...</p>
      </div>
    `;

    try {
      const res = await fetch('/api/subbots');
      const data = await res.json();

      if (!data.ok || !data.bots) {
        throw new Error(data.error || 'Error al obtener bots');
      }

      renderStats(data.bots);
      renderBots(data.bots);
    } catch (err) {
      botsContainer.innerHTML = `
        <div class="empty-state">
          <p>⚠️ Error al cargar los sub-bots: ${err.message}</p>
        </div>
      `;
    }
  }

  // ── Renderizar Métricas ──
  function renderStats(bots) {
    const total = bots.length;
    const online = bots.filter((b) => b.isOnline).length;
    const active = bots.filter((b) => b.plan_status === 'ACTIVE').length;

    statTotal.textContent = total;
    statOnline.textContent = online;
    statCommunities.textContent = total;
    statActive.textContent = active;
    botsCountBadge.textContent = `${total} Sub-Bots`;
  }

  // ── Renderizar Tarjetas de Sub-Bots ──
  function renderBots(bots) {
    if (bots.length === 0) {
      botsContainer.innerHTML = `
        <div class="empty-state">
          <p>Aún no has creado ningún sub-bot. ¡Crea el primero haciendo clic en "Nuevo Sub-Bot"!</p>
        </div>
      `;
      return;
    }

    botsContainer.innerHTML = bots
      .map((bot) => {
        const isOnline = bot.isOnline;
        const statusBadge = isOnline
          ? '<span class="badge badge-green">🟢 ONLINE</span>'
          : '<span class="badge badge-red">🔴 DETENIDO</span>';

        const expiresFormatted = bot.expires_at
          ? new Date(bot.expires_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
          : 'Ilimitado';

        const ownersList = bot.owner_ids && bot.owner_ids.length > 0 ? bot.owner_ids.join(', ') : 'No asignado';

        return `
          <div class="bot-card" data-id="${bot.id}">
            <div class="bot-card-header">
              <div class="bot-card-title">
                <h3>${escapeHtml(bot.community_name)}</h3>
                <span>@${escapeHtml(bot.bot_username || 'SubBot')}</span>
              </div>
              ${statusBadge}
            </div>

            <div class="bot-card-body">
              <div class="bot-info-row">
                <span>Owner ID:</span>
                <strong><code>${ownersList}</code></strong>
              </div>
              <div class="bot-info-row">
                <span>Estado Plan:</span>
                <strong>${bot.plan_status}</strong>
              </div>
              <div class="bot-info-row">
                <span>Vence:</span>
                <strong>${expiresFormatted}</strong>
              </div>
            </div>

            <div class="bot-card-actions">
              ${
                isOnline
                  ? `<button class="btn btn-secondary btn-sm" onclick="toggleBot('${bot.id}', 'stop')">⏸️ Pausar</button>`
                  : `<button class="btn btn-primary btn-sm" onclick="toggleBot('${bot.id}', 'start')">▶️ Iniciar</button>`
              }
              <button class="btn btn-danger btn-sm" onclick="deleteBot('${bot.id}')">🗑️ Eliminar</button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  // ── Crear Sub-Bot ──
  formCreate.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById('btn-submit-bot');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Desplegando...';

    const formData = new FormData(formCreate);
    const payload = Object.fromEntries(formData.entries());

    try {
      const res = await fetch('/api/subbots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.ok) {
        modalCreate.classList.remove('active');
        formCreate.reset();
        tokenStatusMsg.textContent = '';
        await fetchBots();
      } else {
        alert(`Error al crear sub-bot: ${data.error}`);
      }
    } catch (err) {
      alert(`Error de red: ${err.message}`);
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = '🚀 DESPLEGAR SUB-BOT';
    }
  });

  // ── Funciones Globales para Control de Instancias ──
  window.toggleBot = async (id, action) => {
    try {
      const res = await fetch(`/api/subbots/${id}/${action}`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        await fetchBots();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  window.deleteBot = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este sub-bot? Se detendrá la instancia y se borrará su configuración.')) return;
    try {
      const res = await fetch(`/api/subbots/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        await fetchBots();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  function escapeHtml(text) {
    if (!text) return '';
    return String(text).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  // Inicial
  fetchBots();
});
