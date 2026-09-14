// ══════
// ⟡ VLP SaaS Sub-Bot Manager — Client Application
// ══════

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

  // User Profile
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
  let authToken = localStorage.getItem('vlp_auth_token') || '';
  let storedUser = null;

  try {
    storedUser = JSON.parse(localStorage.getItem('vlp_admin_user') || 'null');
  } catch {}

  // Check URL params
  const urlParams = new URLSearchParams(window.location.search);
  const urlAuthToken = urlParams.get('auth_token');
  const urlUid = urlParams.get('uid');

  if (urlAuthToken) {
    authToken = urlAuthToken;
    localStorage.setItem('vlp_auth_token', urlAuthToken);
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  function secureFetch(url, options = {}) {
    options.headers = {
      ...options.headers,
      'x-admin-key': adminKey,
      'x-auth-token': authToken,
    };
    return fetch(url, options);
  }

  // Initial Auth Check
  if (authToken) {
    displayUserHeader({
      id: urlUid || 'Oficial',
      name: 'Owner Autorizado',
      role: 'OWNER SUPREMO',
    });
    modalAuth.classList.remove('active');
    fetchBots();
    fetchStats();
  } else if (adminKey && storedUser) {
    displayUserHeader(storedUser);
    modalAuth.classList.remove('active');
    fetchBots();
    fetchStats();
  } else {
    modalAuth.classList.add('active');
  }

  // Logout
  btnLogout.addEventListener('click', () => {
    localStorage.removeItem('vlp_admin_key');
    localStorage.removeItem('vlp_auth_token');
    localStorage.removeItem('vlp_admin_user');
    location.reload();
  });

  // Login
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
    if (sidebarUserBox) sidebarUserBox.style.display = 'flex';
    if (userDisplayName) userDisplayName.textContent = user.name || `ID: ${user.id}`;
    if (userDisplayRole) userDisplayRole.textContent = user.role || 'OWNER SUPREMO';

    if (user.avatarUrl) {
      if (userAvatarImg) {
        userAvatarImg.src = user.avatarUrl;
        userAvatarImg.style.display = 'block';
      }
      if (userAvatarInitials) userAvatarInitials.style.display = 'none';
    } else {
      if (userAvatarImg) userAvatarImg.style.display = 'none';
      if (userAvatarInitials) {
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
  }

  // Modal Controls
  btnOpenModal.addEventListener('click', () => {
    modalCreate.classList.add('active');
  });

  btnCloseModal.addEventListener('click', () => {
    modalCreate.classList.remove('active');
  });

  btnCancelModal.addEventListener('click', () => {
    modalCreate.classList.remove('active');
  });

  // Verificar Token BotFather
  btnVerifyToken.addEventListener('click', async () => {
    const token = botTokenInput.value.trim();
    if (!token) {
      setFeedback(tokenFeedback, 'Ingresa un token válido', 'error');
      return;
    }

    setFeedback(tokenFeedback, 'Validando token con Telegram...', 'loading');

    try {
      const res = await secureFetch(`${API_PREFIX}/test-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();

      if (data.ok && data.bot) {
        currentVerifiedBot = data.bot;
        setFeedback(
          tokenFeedback,
          `✓ Bot verificado: @${data.bot.username} (${data.bot.first_name})`,
          'success'
        );
      } else {
        setFeedback(tokenFeedback, `✗ Token inválido: ${data.error}`, 'error');
      }
    } catch (err) {
      setFeedback(tokenFeedback, `✗ Error: ${err.message}`, 'error');
    }
  });

  // Verificar Chat
  btnVerifyChat.addEventListener('click', async () => {
    const chatId = officialChatIdInput.value.trim();
    const token = botTokenInput.value.trim();

    if (!chatId) {
      setFeedback(chatFeedback, 'Ingresa un ID numérico o enlace t.me', 'error');
      return;
    }

    setFeedback(chatFeedback, 'Verificando con Telegram...', 'loading');

    try {
      const res = await secureFetch(`${API_PREFIX}/verify-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, chatId }),
      });
      const data = await res.json();

      if (data.ok && data.chat) {
        setFeedback(
          chatFeedback,
          `✓ Chat encontrado: "${data.chat.title}" (${data.chat.type})`,
          'success'
        );
      } else {
        setFeedback(chatFeedback, `✗ No se pudo acceder: ${data.error}`, 'error');
      }
    } catch (err) {
      setFeedback(chatFeedback, `✗ Error: ${err.message}`, 'error');
    }
  });

  // Canales Obligatorios
  btnAddChannel.addEventListener('click', async () => {
    const channel = channelInput.value.trim();
    const token = botTokenInput.value.trim();

    if (!channel) {
      setFeedback(channelFeedback, 'Ingresa @canal o enlace', 'error');
      return;
    }

    setFeedback(channelFeedback, 'Verificando canal...', 'loading');

    try {
      const res = await secureFetch(`${API_PREFIX}/verify-channel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, channel }),
      });
      const data = await res.json();

      if (data.ok && data.channel) {
        if (!verifiedChannelsList.includes(data.channel.target)) {
          verifiedChannelsList.push(data.channel.target);
          renderChannelChips();
        }
        channelInput.value = '';
        setFeedback(channelFeedback, `✓ Canal añadido: ${data.channel.title}`, 'success');
      } else {
        setFeedback(channelFeedback, `✗ ${data.error}`, 'error');
      }
    } catch (err) {
      setFeedback(channelFeedback, `✗ Error: ${err.message}`, 'error');
    }
  });

  function renderChannelChips() {
    channelsChipsContainer.innerHTML = verifiedChannelsList
      .map(
        (ch, idx) => `
      <div class="channel-chip">
        <span>${escapeHtml(ch)}</span>
        <span class="channel-chip-remove" onclick="removeChannelChip(${idx})">&times;</span>
      </div>
    `
      )
      .join('');
  }

  window.removeChannelChip = (index) => {
    verifiedChannelsList.splice(index, 1);
    renderChannelChips();
  };

  function setFeedback(element, text, state) {
    element.textContent = text;
    element.className = `verify-feedback ${state}`;
  }

  // Cargar estadísticas
  async function fetchStats() {
    try {
      const res = await secureFetch(`${API_PREFIX}/stats`);
      const data = await res.json();
      if (data.ok && data.stats) {
        if (statTotal) statTotal.textContent = data.stats.totalBots || 0;
        if (statOnline) statOnline.textContent = data.stats.onlineBots || 0;
        if (statGroups) statGroups.textContent = data.stats.totalGroups || 0;
        if (statBurned) statBurned.textContent = data.stats.totalBurned || 0;
      }
    } catch {}
  }

  // Cargar bots
  async function fetchBots() {
    try {
      const res = await secureFetch(`${API_PREFIX}/subbots`);
      const data = await res.json();

      if (data.ok && Array.isArray(data.bots)) {
        renderBots(data.bots);
        if (botsCountBadge) botsCountBadge.textContent = `${data.bots.length} Bots`;
      } else {
        if (botsContainer) botsContainer.innerHTML = '<div class="empty-state">No se pudieron cargar los sub-bots.</div>';
      }
    } catch (err) {
      botsContainer.innerHTML = `<div class="empty-state">Error de conexión: ${err.message}</div>`;
    }
  }

  function renderBots(bots) {
    if (bots.length === 0) {
      botsContainer.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/></svg>
          <p>Aún no hay sub-bots creados.</p>
          <button class="btn btn-primary btn-sm" onclick="document.getElementById('modal-create').classList.add('active')" style="margin-top: 1rem;">Crear el Primero</button>
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

  // Crear Sub-Bot
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

  // Control de Sub-Bots
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
