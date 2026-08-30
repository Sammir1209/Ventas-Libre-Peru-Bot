// ══════════════════════════════════════════════════════
// ⟡ VLP SaaS Dashboard — Client Application
// ══════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  const API_PREFIX = '/api-sec-vlp';

  // Containers
  const botsContainer = document.getElementById('bots-container');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnOpenModal = document.getElementById('btn-open-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelModal = document.getElementById('btn-cancel-modal');
  const modalCreate = document.getElementById('modal-create');
  const formCreate = document.getElementById('form-create-bot');

  // Auth Elements
  const modalAuth = document.getElementById('modal-auth');
  const formAuth = document.getElementById('form-auth');
  const adminTgIdInput = document.getElementById('admin_tg_id');
  const adminKeyInput = document.getElementById('admin_key_input');
  const authErrorMsg = document.getElementById('auth-error-msg');

  // User Profile in Sidebar
  const sidebarUserBox = document.getElementById('sidebar-user-box');
  const userAvatarImg = document.getElementById('user-avatar-img');
  const userAvatarInitials = document.getElementById('user-avatar-initials');
  const userDisplayName = document.getElementById('user-display-name');
  const userDisplayRole = document.getElementById('user-display-role');
  const btnLogout = document.getElementById('btn-logout');

  // Form Fields & Verifiers
  const botTokenInput = document.getElementById('bot_token');
  const btnVerifyToken = document.getElementById('btn-verify-token');
  const tokenFeedback = document.getElementById('token-feedback');

  const officialChatIdInput = document.getElementById('official_chat_id');
  const btnVerifyChat = document.getElementById('btn-verify-chat');
  const chatFeedback = document.getElementById('chat-feedback');

  const channelInput = document.getElementById('channel_input');
  const btnAddChannel = document.getElementById('btn-add-channel');
  const channelFeedback = document.getElementById('channel-feedback');
  const channelsChipsContainer = document.getElementById('channels-chips-container');

  // Stats Elements
  const statTotal = document.getElementById('stat-total');
  const statOnline = document.getElementById('stat-online');
  const statGroups = document.getElementById('stat-groups');
  const statBurned = document.getElementById('stat-burned');
  const botsCountBadge = document.getElementById('bots-count-badge');

  // State
  let verifiedChannelsList = [];
  let currentVerifiedBot = null;
  let adminKey = localStorage.getItem('vlp_admin_key') || '';
  let storedUser = null;

  try {
    storedUser = JSON.parse(localStorage.getItem('vlp_admin_user') || 'null');
  } catch {}

  // Initial Auth Check
  if (!adminKey || !storedUser) {
    modalAuth.classList.add('active');
  } else {
    displayUserHeader(storedUser);
    fetchBots();
    fetchStats();
  }

  // ── Logout ──
  btnLogout.addEventListener('click', () => {
    localStorage.removeItem('vlp_admin_key');
    localStorage.removeItem('vlp_admin_user');
    location.reload();
  });

  // ── Login con ID de Telegram + Master Key ──
  formAuth.addEventListener('submit', async (e) => {
    e.preventDefault();
    const telegramId = adminTgIdInput.value.trim();
    const key = adminKeyInput.value.trim();

    if (!telegramId || !key) return;

    authErrorMsg.textContent = 'Verificando con Telegram API...';
    authErrorMsg.className = 'verify-feedback';

    try {
      const res = await fetch(`${API_PREFIX}/auth-owner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId, key }),
      });
      const data = await res.json();

      if (data.ok && data.user) {
        adminKey = key;
        localStorage.setItem('vlp_admin_key', key);
        localStorage.setItem('vlp_admin_user', JSON.stringify(data.user));

        displayUserHeader(data.user);
        modalAuth.classList.remove('active');
        authErrorMsg.textContent = '';
        await fetchBots();
        await fetchStats();
      } else {
        authErrorMsg.textContent = `✗ ${data.error || 'Acceso denegado'}`;
        authErrorMsg.className = 'verify-feedback error';
      }
    } catch (err) {
      authErrorMsg.textContent = `✗ Error de conexión: ${err.message}`;
      authErrorMsg.className = 'verify-feedback error';
    }
  });

  function displayUserHeader(user) {
    sidebarUserBox.style.display = 'flex';
    userDisplayName.textContent = user.name || `ID: ${user.id}`;
    userDisplayRole.textContent = user.role || 'OWNER SUPREMO';

    if (user.avatarUrl) {
      userAvatarImg.src = user.avatarUrl;
      userAvatarImg.style.display = 'block';
      userAvatarInitials.style.display = 'none';
    } else {
      userAvatarImg.style.display = 'none';
      userAvatarInitials.style.display = 'block';
      const initials = (user.name || 'OW')
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
      userAvatarInitials.textContent = initials || 'OW';
    }
  }

  // Helper para Fetch Seguro
  function secureFetch(url, options = {}) {
    options.headers = {
      ...options.headers,
      'x-admin-key': adminKey,
    };
    return fetch(url, options);
  }

  // Modal Controls
  btnOpenModal.addEventListener('click', () => {
    verifiedChannelsList = [];
    renderChannelChips();
    tokenFeedback.textContent = '';
    chatFeedback.textContent = '';
    channelFeedback.textContent = '';
    modalCreate.classList.add('active');
  });
  btnCloseModal.addEventListener('click', () => modalCreate.classList.remove('active'));
  btnCancelModal.addEventListener('click', () => modalCreate.classList.remove('active'));
  btnRefresh.addEventListener('click', () => {
    fetchBots();
    fetchStats();
  });

  // ── 1. Verificar Token de BotFather ──
  btnVerifyToken.addEventListener('click', async () => {
    const token = botTokenInput.value.trim();
    if (!token) {
      tokenFeedback.textContent = 'Ingresa un token para verificar.';
      tokenFeedback.className = 'verify-feedback error';
      return;
    }

    tokenFeedback.textContent = 'Consultando Telegram API...';
    tokenFeedback.className = 'verify-feedback';

    try {
      const res = await secureFetch(`${API_PREFIX}/test-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();

      if (data.ok) {
        currentVerifiedBot = data.bot;
        tokenFeedback.textContent = `✓ Bot Válido: @${data.bot.username} (${data.bot.first_name})`;
        tokenFeedback.className = 'verify-feedback success';
      } else {
        tokenFeedback.textContent = `✗ Error: ${data.error}`;
        tokenFeedback.className = 'verify-feedback error';
      }
    } catch (err) {
      tokenFeedback.textContent = `✗ Error: ${err.message}`;
      tokenFeedback.className = 'verify-feedback error';
    }
  });

  // ── 2. Verificar Grupo Oficial Chat (por ID o Enlace https://t.me/+...) ──
  btnVerifyChat.addEventListener('click', async () => {
    const chatId = officialChatIdInput.value.trim();
    const token = botTokenInput.value.trim();

    if (!chatId) {
      chatFeedback.textContent = 'Ingresa el ID (ej: -100...) o enlace (ej: https://t.me/+...).';
      chatFeedback.className = 'verify-feedback error';
      return;
    }

    chatFeedback.textContent = 'Verificando pertenencia y permisos del bot...';
    chatFeedback.className = 'verify-feedback';

    try {
      const res = await secureFetch(`${API_PREFIX}/verify-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, chatId }),
      });
      const data = await res.json();

      if (data.ok && data.chat) {
        const c = data.chat;
        const admText = c.isBotAdmin ? '✓ Bot es Administrador' : '⚠️ Bot es Miembro (Recomendado hacerlo Admin)';
        chatFeedback.textContent = `✓ "${c.title}" (${c.type}) — ${admText}`;
        chatFeedback.className = 'verify-feedback success';
      } else {
        chatFeedback.textContent = `✗ ${data.error || 'Grupo no encontrado'}`;
        chatFeedback.className = 'verify-feedback error';
      }
    } catch (err) {
      chatFeedback.textContent = `✗ Error: ${err.message}`;
      chatFeedback.className = 'verify-feedback error';
    }
  });

  // ── 3. Verificar Grupo de Tratos Admin (Escrow) ──
  const escrowGroupInput = document.getElementById('escrow_group_id');
  const btnVerifyEscrow = document.getElementById('btn-verify-escrow');
  const escrowFeedback = document.getElementById('escrow-feedback');

  btnVerifyEscrow.addEventListener('click', async () => {
    const chatId = escrowGroupInput.value.trim();
    const token = botTokenInput.value.trim();

    if (!chatId) {
      escrowFeedback.textContent = 'Ingresa el ID o enlace del grupo de tratos.';
      escrowFeedback.className = 'verify-feedback error';
      return;
    }

    escrowFeedback.textContent = 'Verificando grupo de tratos...';
    escrowFeedback.className = 'verify-feedback';

    try {
      const res = await secureFetch(`${API_PREFIX}/verify-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, chatId }),
      });
      const data = await res.json();

      if (data.ok && data.chat) {
        const c = data.chat;
        const admText = c.isBotAdmin ? '✓ Bot es Administrador' : '⚠️ Bot no es Administrador';
        escrowFeedback.textContent = `✓ "${c.title}" — ${admText}`;
        escrowFeedback.className = 'verify-feedback success';
      } else {
        escrowFeedback.textContent = `✗ ${data.error || 'Grupo no encontrado'}`;
        escrowFeedback.className = 'verify-feedback error';
      }
    } catch (err) {
      escrowFeedback.textContent = `✗ Error: ${err.message}`;
      escrowFeedback.className = 'verify-feedback error';
    }
  });

  // ── 4. Verificar Grupo Oficial de Staff ──
  const staffChatInput = document.getElementById('staff_chat_id');
  const btnVerifyStaff = document.getElementById('btn-verify-staff');
  const staffFeedback = document.getElementById('staff-feedback');

  btnVerifyStaff.addEventListener('click', async () => {
    const chatId = staffChatInput.value.trim();
    const token = botTokenInput.value.trim();

    if (!chatId) {
      staffFeedback.textContent = 'Ingresa el ID o enlace del grupo de staff.';
      staffFeedback.className = 'verify-feedback error';
      return;
    }

    staffFeedback.textContent = 'Verificando grupo de staff...';
    staffFeedback.className = 'verify-feedback';

    try {
      const res = await secureFetch(`${API_PREFIX}/verify-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, chatId }),
      });
      const data = await res.json();

      if (data.ok && data.chat) {
        const c = data.chat;
        const admText = c.isBotAdmin ? '✓ Bot es Administrador' : '⚠️ Bot no es Administrador';
        staffFeedback.textContent = `✓ "${c.title}" — ${admText}`;
        staffFeedback.className = 'verify-feedback success';
      } else {
        staffFeedback.textContent = `✗ ${data.error || 'Grupo no encontrado'}`;
        staffFeedback.className = 'verify-feedback error';
      }
    } catch (err) {
      staffFeedback.textContent = `✗ Error: ${err.message}`;
      staffFeedback.className = 'verify-feedback error';
    }
  });

  // ── 3. Verificar y Agregar Canal 1 por 1 ──
  btnAddChannel.addEventListener('click', async () => {
    const channelRaw = channelInput.value.trim();
    const token = botTokenInput.value.trim();

    if (!channelRaw) {
      channelFeedback.textContent = 'Escribe el @canal o enlace.';
      channelFeedback.className = 'verify-feedback error';
      return;
    }

    channelFeedback.textContent = 'Verificando canal...';
    channelFeedback.className = 'verify-feedback';

    try {
      const res = await secureFetch(`${API_PREFIX}/verify-channel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, channelIdentifier: channelRaw }),
      });
      const data = await res.json();

      if (data.ok && data.channel) {
        const ch = data.channel;
        if (!verifiedChannelsList.includes(ch.username)) {
          verifiedChannelsList.push(ch.username);
          renderChannelChips();
          channelInput.value = '';
          channelFeedback.textContent = `✓ Canal agregado: ${ch.title} (${ch.username})`;
          channelFeedback.className = 'verify-feedback success';
        } else {
          channelFeedback.textContent = 'Este canal ya está en la lista.';
          channelFeedback.className = 'verify-feedback error';
        }
      } else {
        channelFeedback.textContent = `✗ ${data.error || 'Canal no encontrado'}`;
        channelFeedback.className = 'verify-feedback error';
      }
    } catch (err) {
      channelFeedback.textContent = `✗ Error: ${err.message}`;
      channelFeedback.className = 'verify-feedback error';
    }
  });

  function renderChannelChips() {
    if (verifiedChannelsList.length === 0) {
      channelsChipsContainer.innerHTML = `<span style="color: var(--text-dim); font-size: 0.75rem;">Sin canales agregados aún.</span>`;
      return;
    }

    channelsChipsContainer.innerHTML = verifiedChannelsList
      .map(
        (ch, idx) => `
        <div class="channel-chip">
          <span>${escapeHtml(ch)}</span>
          <span class="channel-chip-remove" onclick="removeChannel(${idx})">&times;</span>
        </div>
      `
      )
      .join('');
  }

  window.removeChannel = (index) => {
    verifiedChannelsList.splice(index, 1);
    renderChannelChips();
  };

  // ── Cargar Métricas y Sub-Bots ──
  async function fetchStats() {
    try {
      const res = await secureFetch(`${API_PREFIX}/system-stats`);
      const data = await res.json();
      if (data.ok && data.stats) {
        statGroups.textContent = data.stats.totalGroups || 0;
        statBurned.textContent = data.stats.totalBurnedScammers || 0;
      }
    } catch {}
  }

  async function fetchBots() {
    if (!adminKey) return;

    botsContainer.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Cargando instancias en tiempo real...</p>
      </div>
    `;

    try {
      const res = await secureFetch(`${API_PREFIX}/subbots`);

      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('vlp_admin_key');
        localStorage.removeItem('vlp_admin_user');
        modalAuth.classList.add('active');
        return;
      }

      const data = await res.json();

      if (!data.ok || !data.bots) {
        throw new Error(data.error || 'Error al obtener bots');
      }

      renderStats(data.bots);
      renderBots(data.bots);
    } catch (err) {
      botsContainer.innerHTML = `
        <div class="empty-state">
          <p>Error al cargar sub-bots: ${escapeHtml(err.message)}</p>
        </div>
      `;
    }
  }

  function renderStats(bots) {
    const total = bots.length;
    const online = bots.filter((b) => b.isOnline).length;

    statTotal.textContent = total;
    statOnline.textContent = online;
    botsCountBadge.textContent = `${total} Sub-Bots`;
  }

  function renderBots(bots) {
    if (bots.length === 0) {
      botsContainer.innerHTML = `
        <div class="empty-state">
          <p>No tienes ningún sub-bot registrado. Haz clic en "NUEVO SUB-BOT" para desplegar el primero.</p>
        </div>
      `;
      return;
    }

    botsContainer.innerHTML = bots
      .map((bot) => {
        const isOnline = bot.isOnline;
        const statusBadge = isOnline
          ? '<span class="badge badge-green">ONLINE</span>'
          : '<span class="badge badge-red">DETENIDO</span>';

        const expiresFormatted = bot.expires_at
          ? new Date(bot.expires_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
          : 'Ilimitado';

        const ownersList = bot.owner_ids && bot.owner_ids.length > 0 ? bot.owner_ids.join(', ') : 'No asignado';
        const channelsCount = Array.isArray(bot.channels_to_verify) ? bot.channels_to_verify.length : 0;

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
                <span>Token:</span>
                <strong><code>${escapeHtml(bot.bot_token_masked || '••••••••')}</code></strong>
              </div>
              <div class="bot-info-row">
                <span>Owner ID:</span>
                <strong><code>${escapeHtml(ownersList)}</code></strong>
              </div>
              <div class="bot-info-row">
                <span>Canales a Verificar:</span>
                <strong>${channelsCount} canales</strong>
              </div>
              <div class="bot-info-row">
                <span>Vencimiento:</span>
                <strong>${expiresFormatted}</strong>
              </div>
            </div>

            <div class="bot-card-actions">
              ${
                isOnline
                  ? `<button class="btn btn-secondary btn-sm" onclick="toggleBot('${bot.id}', 'stop')">Pausar</button>`
                  : `<button class="btn btn-primary btn-sm" onclick="toggleBot('${bot.id}', 'start')">Iniciar</button>`
              }
              <button class="btn btn-secondary btn-sm" onclick="toggleBot('${bot.id}', 'restart')">Reiniciar</button>
              <button class="btn btn-danger btn-sm" onclick="deleteBot('${bot.id}')">Eliminar</button>
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
    payload.channels_to_verify = verifiedChannelsList;

    try {
      const res = await secureFetch(`${API_PREFIX}/subbots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.ok) {
        modalCreate.classList.remove('active');
        formCreate.reset();
        verifiedChannelsList = [];
        renderChannelChips();
        tokenFeedback.textContent = '';
        chatFeedback.textContent = '';
        await fetchBots();
        await fetchStats();
      } else {
        alert(`Error al crear sub-bot: ${data.error}`);
      }
    } catch (err) {
      alert(`Error de red: ${err.message}`);
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'DESPLEGAR SUB-BOT';
    }
  });

  // ── Control de Sub-Bots ──
  window.toggleBot = async (id, action) => {
    try {
      const res = await secureFetch(`${API_PREFIX}/subbots/${id}/${action}`, { method: 'POST' });
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
    if (!confirm('¿Deseas eliminar este sub-bot? Se detendrá la instancia y se borrará la configuración.')) return;
    try {
      const res = await secureFetch(`${API_PREFIX}/subbots/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        await fetchBots();
        await fetchStats();
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
});
