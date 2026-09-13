// ══════════════════════════════════════════════════════
// ⟡ VLP SaaS & Bot Control Center — Client Application
// ══════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  const API_PREFIX = '/api-sec-vlp';

  // ── Navigation Views ──
  const navItems = {
    groups: document.getElementById('nav-groups'),
    staff: document.getElementById('nav-staff'),
    verification: document.getElementById('nav-verification'),
    community: document.getElementById('nav-community'),
  };

  const views = {
    groups: document.getElementById('view-groups'),
    staff: document.getElementById('view-staff'),
    verification: document.getElementById('view-verification'),
    community: document.getElementById('view-community'),
  };

  function switchView(target) {
    Object.keys(views).forEach((k) => {
      if (views[k]) {
        views[k].style.display = k === target ? 'block' : 'none';
      }
      if (navItems[k]) {
        navItems[k].classList.toggle('active', k === target);
      }
    });
  }

  Object.keys(navItems).forEach((key) => {
    if (navItems[key]) {
      navItems[key].addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = key;
        switchView(key);
      });
    }
  });

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

  // Groups & Security Elements
  const groupsContainer = document.getElementById('groups-container');
  const btnRefreshGroups = document.getElementById('btn-refresh-groups');
  const modalGroupSecurity = document.getElementById('modal-group-security');
  const btnCloseGroupModal = document.getElementById('btn-close-group-modal');
  const btnCancelGroupModal = document.getElementById('btn-cancel-group-modal');
  const formGroupSecurity = document.getElementById('form-group-security');
  const modalGroupName = document.getElementById('modal-group-name');
  const modalGroupId = document.getElementById('modal-group-id');
  const panicBanner = document.getElementById('panic-status-banner');
  const btnTogglePanic = document.getElementById('btn-toggle-panic');
  const panicBannerTitle = document.getElementById('panic-banner-title');
  const panicBannerDesc = document.getElementById('panic-banner-desc');
  const groupSaveFeedback = document.getElementById('group-save-feedback');

  // Stats Elements
  const statGroupsCount = document.getElementById('stat-groups-count');
  const statAdminCount = document.getElementById('stat-admin-count');
  const statLockdownCount = document.getElementById('stat-lockdown-count');
  const groupsCountBadge = document.getElementById('groups-count-badge');

  // Staff Elements
  const staffContainer = document.getElementById('staff-container');
  const btnOpenStaffModal = document.getElementById('btn-open-staff-modal');
  const modalStaff = document.getElementById('modal-staff');
  const btnCloseStaffModal = document.getElementById('btn-close-staff-modal');
  const btnCancelStaffModal = document.getElementById('btn-cancel-staff-modal');
  const formStaffAssign = document.getElementById('form-staff-assign');
  const staffModalFeedback = document.getElementById('staff-modal-feedback');

  // Verification Channels Elements
  const inputNewVerifChannel = document.getElementById('input-new-verif-channel');
  const btnAddVerifChannel = document.getElementById('btn-add-verif-channel');
  const verifChannelFeedback = document.getElementById('verif-channel-feedback');
  const verifChannelsTableBody = document.getElementById('verif-channels-table-body');

  // Community Settings Elements
  const formCommunity = document.getElementById('form-community-settings');
  const communityFeedback = document.getElementById('community-feedback');

  // State
  let adminKey = localStorage.getItem('vlp_admin_key') || '';
  let authToken = localStorage.getItem('vlp_auth_token') || '';
  let storedUser = null;
  let activeChatId = null;
  let activeGroupIsLockedDown = false;
  let cachedVerifChannels = [];

  try {
    storedUser = JSON.parse(localStorage.getItem('vlp_admin_user') || 'null');
  } catch {}

  // Check URL params for one-click token login from /panel command: ?auth_token=...&uid=...
  const urlParams = new URLSearchParams(window.location.search);
  const urlAuthToken = urlParams.get('auth_token');
  const urlUid = urlParams.get('uid');

  if (urlAuthToken) {
    authToken = urlAuthToken;
    localStorage.setItem('vlp_auth_token', urlAuthToken);
    // Limpiar query params de la barra de direcciones por privacidad
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
  }

  // Helper para Fetch Seguro (Envía tanto x-admin-key como x-auth-token)
  function secureFetch(url, options = {}) {
    options.headers = {
      ...options.headers,
      'x-admin-key': adminKey,
      'x-auth-token': authToken,
    };
    return fetch(url, options);
  }

  // ── Multi-Tenant Theme Engine ──
  const brandLogo = document.getElementById('brand-logo');
  const brandBadgeIcon = document.getElementById('brand-badge-icon');
  const brandTitle = document.getElementById('brand-title');
  const brandSubtitle = document.getElementById('brand-subtitle');
  const devBadge = document.getElementById('dev-badge');

  let currentSession = null;

  function applyTheme(themeData) {
    if (!themeData) return;

    // Remove any existing theme classes
    document.body.classList.remove('theme-client', 'theme-owner-dev', 'theme-owner');

    const theme = themeData.theme || 'owner';

    if (theme === 'client') {
      document.body.classList.add('theme-client');
    } else if (theme === 'owner-dev') {
      document.body.classList.add('theme-owner-dev');
    }
    // 'owner' is the default (no extra class needed, uses :root vars)

    // Update sidebar branding
    const branding = themeData.branding || {};
    const communityName = branding.community_display_name || themeData.communityName || 'VENTAS LIBRES';

    if (theme === 'client') {
      // Client theme: show their community name
      brandTitle.textContent = communityName.toUpperCase();
      brandSubtitle.textContent = 'PANEL DE CONTROL';

      // Show logo if available
      if (branding.logo_url) {
        brandLogo.src = branding.logo_url;
        brandLogo.classList.add('visible');
        brandBadgeIcon.style.display = 'none';
      }

      // Custom accent color
      if (branding.accent_color) {
        document.body.style.setProperty('--custom-accent', branding.accent_color);
        document.body.setAttribute('data-accent', branding.accent_color);
      }

      // Update page title
      document.title = `${communityName} — Panel de Control`;
    } else {
      // Owner themes: VLP branding
      brandTitle.textContent = 'VENTAS LIBRES';
      brandSubtitle.textContent = 'CENTRO DE COMANDO';
      document.title = 'VLP Control Center — Panel Maestro de Configuración';
    }

    // Store session for later use
    currentSession = themeData;
  }

  async function loadSessionInfo() {
    try {
      const res = await secureFetch(`${API_PREFIX}/session-info`);
      const data = await res.json();
      if (data.ok && data.session) {
        applyTheme(data.session);
        return data.session;
      }
    } catch (err) {
      console.warn('⟡ Could not load session info:', err.message);
    }
    return null;
  }

  // Initial Auth Check
  async function initAuth() {
    if (authToken) {
      displayUserHeader({
        id: urlUid || 'Oficial',
        name: 'Administrador Autorizado',
        role: 'OWNER / STAFF',
      });
      modalAuth.classList.remove('active');
      loadAllData();
      // Load session info to apply correct theme
      loadSessionInfo();
      return;
    }

    if (adminKey && storedUser) {
      displayUserHeader(storedUser);
      modalAuth.classList.remove('active');
      loadAllData();
      // Apply stored theme if available
      if (storedUser.theme) {
        applyTheme({
          theme: storedUser.theme,
          isGlobalOwner: storedUser.isGlobalOwner,
          isDev: storedUser.isDev,
          communityName: 'Ventas Libres Perú',
          branding: {},
        });
      }
      return;
    }

    modalAuth.classList.add('active');
  }

  initAuth();

  // Hash Navigation routing
  const initialHash = window.location.hash.replace('#', '') || 'groups';
  if (views[initialHash]) switchView(initialHash);

  // Logout
  btnLogout.addEventListener('click', () => {
    localStorage.removeItem('vlp_admin_key');
    localStorage.removeItem('vlp_auth_token');
    localStorage.removeItem('vlp_admin_user');
    location.reload();
  });

  // Login form submit
  formAuth.addEventListener('submit', async (e) => {
    e.preventDefault();
    const telegramId = adminTgIdInput.value.trim();
    const key = adminKeyInput.value.trim();
    if (!telegramId || !key) return;

    authErrorMsg.textContent = 'Verificando autorización...';
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
        loadAllData();

        // Apply theme from auth-owner response
        if (data.user.theme) {
          applyTheme({
            theme: data.user.theme,
            isGlobalOwner: data.user.isGlobalOwner,
            isDev: data.user.isDev,
            communityName: 'Ventas Libres Perú',
            branding: {},
          });
        }
      } else {
        authErrorMsg.textContent = `✗ ${data.error || 'Acceso denegado'}`;
        authErrorMsg.className = 'verify-feedback error';
      }
    } catch (err) {
      authErrorMsg.textContent = `✗ Error de red: ${err.message}`;
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

  function loadAllData() {
    fetchGroups();
    fetchStaff();
    fetchVerificationChannels();
    fetchCommunitySettings();
  }

  // ══════════════════════════════════════════════════════
  // 1. GRUPOS & SEGURIDAD EN TIEMPO REAL
  // ══════════════════════════════════════════════════════

  async function fetchGroups() {
    groupsContainer.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Sincronizando grupos con Telegram API...</p>
      </div>`;

    try {
      const res = await secureFetch(`${API_PREFIX}/bot/groups`);
      const data = await res.json();

      if (!data.ok || !Array.isArray(data.groups)) {
        groupsContainer.innerHTML = `<div class="empty-state">No se pudieron cargar los grupos: ${data.error || 'Error'}</div>`;
        return;
      }

      renderGroups(data.groups);
    } catch (err) {
      groupsContainer.innerHTML = `<div class="empty-state">Error de conexión: ${err.message}</div>`;
    }
  }

  btnRefreshGroups.addEventListener('click', fetchGroups);

  function renderGroups(groups) {
    let adminCount = 0;
    let lockdownCount = 0;

    if (groups.length === 0) {
      groupsContainer.innerHTML = `<div class="empty-state">El bot aún no está registrado en ningún grupo. Agrégalo a tus grupos como administrador.</div>`;
      statGroupsCount.textContent = '0';
      statAdminCount.textContent = '0';
      statLockdownCount.textContent = '0';
      groupsCountBadge.textContent = '0 Grupos';
      return;
    }

    groupsContainer.innerHTML = groups
      .map((g) => {
        if (g.isBotAdmin) adminCount++;
        if (g.isLockedDown) lockdownCount++;

        const adminBadge = g.isBotAdmin
          ? '<span class="badge badge-green">ADMIN</span>'
          : '<span class="badge badge-red">MIEMBRO</span>';

        const panicBadge = g.isLockedDown
          ? '<span class="badge badge-red">🚨 DEFCON 1</span>'
          : '<span class="badge badge-orange">NORMAL</span>';

        const membersDisplay = g.memberCount ? `${g.memberCount.toLocaleString()} miembros` : 'Desconocido';

        return `
          <div class="group-card">
            <div class="group-card-header">
              <div class="group-title">
                <h3>${escapeHtml(g.title || 'Grupo')}</h3>
                <span>ID: <code>${g.chat_id}</code></span>
              </div>
              <div style="display: flex; gap: 6px;">
                ${adminBadge}
                ${panicBadge}
              </div>
            </div>

            <div class="group-details-list">
              <div class="group-detail-row">
                <span>Miembros:</span>
                <strong>${membersDisplay}</strong>
              </div>
              <div class="group-detail-row">
                <span>Permiso Borrar Mensajes:</span>
                <strong>${g.permissions?.can_delete_messages ? '✓ Sí' : '✗ No'}</strong>
              </div>
              <div class="group-detail-row">
                <span>Permiso Restringir (Mute/Ban):</span>
                <strong>${g.permissions?.can_restrict_members ? '✓ Sí' : '✗ No'}</strong>
              </div>
            </div>

            <div class="bot-card-actions">
              <button class="btn btn-primary btn-sm" onclick="openGroupSettings('${g.chat_id}', '${escapeHtml(g.title || 'Grupo')}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                Configurar Seguridad
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    statGroupsCount.textContent = groups.length;
    statAdminCount.textContent = adminCount;
    statLockdownCount.textContent = lockdownCount;
    groupsCountBadge.textContent = `${groups.length} Grupos`;
  }

  // Open Group Security Modal
  window.openGroupSettings = async (chatId, title) => {
    activeChatId = chatId;
    modalGroupName.textContent = title;
    modalGroupId.textContent = `ID: ${chatId}`;
    groupSaveFeedback.textContent = 'Cargando ajustes en vivo...';
    groupSaveFeedback.className = 'verify-feedback';
    modalGroupSecurity.classList.add('active');

    try {
      const res = await secureFetch(`${API_PREFIX}/group-settings/${chatId}`);
      const data = await res.json();

      if (data.ok && data.settings) {
        groupSaveFeedback.textContent = '';
        const s = data.settings;

        // Anti-Raid
        document.getElementById('toggle-antiraid-enabled').checked = !!s.antiRaid?.enabled;
        document.getElementById('select-antiraid-sensitivity').value = s.antiRaid?.sensitivity || 'high';
        document.getElementById('select-antiraid-action').value = s.antiRaid?.action || 'mute';

        // Anti-Flood
        document.getElementById('toggle-antiflood-enabled').checked = !!s.antiFlood?.enabled;
        document.getElementById('input-antiflood-limit').value = s.antiFlood?.msgLimit || 5;
        document.getElementById('select-antiflood-mutetime').value = s.antiFlood?.muteTime || '1h';

        // Locks
        const l = s.locks || {};
        document.getElementById('lock-links').checked = !!l.links;
        document.getElementById('lock-forwards').checked = !!l.forwards;
        document.getElementById('lock-stickers').checked = !!l.stickers;
        document.getElementById('lock-gifs').checked = !!l.gifs;
        document.getElementById('lock-audio').checked = !!l.audio;
        document.getElementById('lock-voice').checked = !!l.voice;
        document.getElementById('lock-video').checked = !!l.video;
        document.getElementById('lock-docs').checked = !!l.docs;
        document.getElementById('lock-bots').checked = !!l.bots;
        document.getElementById('lock-arab').checked = !!l.arab;

        // Verification
        document.getElementById('toggle-verify-enabled').checked = s.verifyEnabled !== false;

        // Panic state
        updatePanicBannerUI(!!s.isLockedDown);
      } else {
        groupSaveFeedback.textContent = 'Error cargando configuración.';
        groupSaveFeedback.className = 'verify-feedback error';
      }
    } catch (e) {
      groupSaveFeedback.textContent = `Error: ${e.message}`;
      groupSaveFeedback.className = 'verify-feedback error';
    }
  };

  function updatePanicBannerUI(isLocked) {
    activeGroupIsLockedDown = isLocked;
    if (isLocked) {
      panicBanner.classList.add('active');
      panicBannerTitle.textContent = '🚨 MODO PÁNICO ACTIVO (CHAT BLOQUEADO)';
      panicBannerDesc.textContent = 'Nadie puede enviar mensajes en este momento.';
      btnTogglePanic.textContent = 'LEVANTAR PÁNICO / NORMALIZAR';
      btnTogglePanic.className = 'btn btn-secondary btn-sm';
    } else {
      panicBanner.classList.remove('active');
      panicBannerTitle.textContent = 'ESTADO DE CIERRE (NORMAL)';
      panicBannerDesc.textContent = 'El chat está funcionando con normalidad.';
      btnTogglePanic.textContent = 'ACTIVAR PÁNICO DEFCON 1';
      btnTogglePanic.className = 'btn btn-danger btn-sm';
    }
  }

  // Panic Button Click
  btnTogglePanic.addEventListener('click', async () => {
    if (!activeChatId) return;
    const action = activeGroupIsLockedDown ? 'deactivate' : 'activate';
    btnTogglePanic.disabled = true;

    try {
      const res = await secureFetch(`${API_PREFIX}/group/${activeChatId}/panic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.ok) {
        updatePanicBannerUI(data.isLockedDown);
        fetchGroups();
      } else {
        alert(`Error al cambiar modo pánico: ${data.error}`);
      }
    } catch (e) {
      alert(`Error de red: ${e.message}`);
    } finally {
      btnTogglePanic.disabled = false;
    }
  });

  // Save Group Security
  formGroupSecurity.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeChatId) return;

    groupSaveFeedback.textContent = 'Aplicando ajustes en vivo a Telegram...';
    groupSaveFeedback.className = 'verify-feedback';

    const payload = {
      antiRaid: {
        enabled: document.getElementById('toggle-antiraid-enabled').checked,
        sensitivity: document.getElementById('select-antiraid-sensitivity').value,
        action: document.getElementById('select-antiraid-action').value,
      },
      antiFlood: {
        enabled: document.getElementById('toggle-antiflood-enabled').checked,
        msgLimit: Number(document.getElementById('input-antiflood-limit').value),
        muteTime: document.getElementById('select-antiflood-mutetime').value,
      },
      locks: {
        links: document.getElementById('lock-links').checked,
        forwards: document.getElementById('lock-forwards').checked,
        stickers: document.getElementById('lock-stickers').checked,
        gifs: document.getElementById('lock-gifs').checked,
        audio: document.getElementById('lock-audio').checked,
        voice: document.getElementById('lock-voice').checked,
        video: document.getElementById('lock-video').checked,
        docs: document.getElementById('lock-docs').checked,
        bots: document.getElementById('lock-bots').checked,
        arab: document.getElementById('lock-arab').checked,
      },
      verifyEnabled: document.getElementById('toggle-verify-enabled').checked,
    };

    try {
      const res = await secureFetch(`${API_PREFIX}/group-settings/${activeChatId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        groupSaveFeedback.textContent = '✓ Configuración aplicada y sincronizada en vivo con el grupo.';
        groupSaveFeedback.className = 'verify-feedback success';
        setTimeout(() => {
          modalGroupSecurity.classList.remove('active');
          fetchGroups();
        }, 1200);
      } else {
        groupSaveFeedback.textContent = `✗ Error: ${data.error}`;
        groupSaveFeedback.className = 'verify-feedback error';
      }
    } catch (err) {
      groupSaveFeedback.textContent = `✗ Error de red: ${err.message}`;
      groupSaveFeedback.className = 'verify-feedback error';
    }
  });

  btnCloseGroupModal.addEventListener('click', () => modalGroupSecurity.classList.remove('active'));
  btnCancelGroupModal.addEventListener('click', () => modalGroupSecurity.classList.remove('active'));

  // ══════════════════════════════════════════════════════
  // 2. GESTIÓN DE STAFF EN TIEMPO REAL
  // ══════════════════════════════════════════════════════

  async function fetchStaff() {
    staffContainer.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Cargando equipo de Staff...</p>
      </div>`;

    try {
      const res = await secureFetch(`${API_PREFIX}/staff`);
      const data = await res.json();

      if (!data.ok || !Array.isArray(data.staff)) {
        staffContainer.innerHTML = `<div class="empty-state">No se pudo cargar el Staff.</div>`;
        return;
      }

      renderStaff(data.staff, data.owners || []);
    } catch (e) {
      staffContainer.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
    }
  }

  function renderStaff(staffList, owners) {
    if (staffList.length === 0) {
      staffContainer.innerHTML = `<div class="empty-state">No hay miembros de staff registrados aún. Añade uno con el botón superior.</div>`;
      return;
    }

    staffContainer.innerHTML = staffList
      .map((st) => {
        const isOwner = owners.includes(Number(st.user_id)) || (st.role && st.role.includes('OWNER'));
        const roleBadge = isOwner
          ? '<span class="badge badge-orange">OWNER</span>'
          : '<span class="badge badge-green">STAFF</span>';

        const tagDisplay = st.custom_title ? `<code>${escapeHtml(st.custom_title)}</code>` : '<i>Sin tag</i>';
        const userTag = st.username ? `@${st.username}` : `ID: ${st.user_id}`;

        return `
          <div class="staff-card">
            <div class="staff-card-header">
              <div class="staff-title">
                <h3>${escapeHtml(st.first_name || 'Staff')}</h3>
                <span>${userTag}</span>
              </div>
              ${roleBadge}
            </div>

            <div class="staff-details-list">
              <div class="group-detail-row">
                <span>ID Telegram:</span>
                <strong><code>${st.user_id}</code></strong>
              </div>
              <div class="group-detail-row">
                <span>Rol(es):</span>
                <strong>${escapeHtml(st.role || 'ADMIN')}</strong>
              </div>
              <div class="group-detail-row">
                <span>Tag en Grupos:</span>
                <strong>${tagDisplay}</strong>
              </div>
            </div>

            <div class="bot-card-actions">
              <button class="btn btn-secondary btn-sm" onclick="editStaff('${st.user_id}', '${escapeHtml(st.role || 'ADMIN')}', '${escapeHtml(st.custom_title || '')}')">Editar</button>
              <button class="btn btn-danger btn-sm" onclick="deleteStaff('${st.user_id}')">Remover</button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  btnOpenStaffModal.addEventListener('click', () => {
    formStaffAssign.reset();
    staffModalFeedback.textContent = '';
    modalStaff.classList.add('active');
  });

  btnCloseStaffModal.addEventListener('click', () => modalStaff.classList.remove('active'));
  btnCancelStaffModal.addEventListener('click', () => modalStaff.classList.remove('active'));

  formStaffAssign.addEventListener('submit', async (e) => {
    e.preventDefault();
    staffModalFeedback.textContent = 'Guardando y sincronizando con Telegram...';
    staffModalFeedback.className = 'verify-feedback';

    const payload = {
      userId: Number(document.getElementById('staff_user_id').value),
      role: document.getElementById('staff_role').value,
      customTitle: document.getElementById('staff_custom_title').value.trim(),
      promoteInGroups: document.getElementById('staff_promote_groups').checked,
    };

    try {
      const res = await secureFetch(`${API_PREFIX}/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        staffModalFeedback.textContent = '✓ Staff asignado exitosamente.';
        staffModalFeedback.className = 'verify-feedback success';
        setTimeout(() => {
          modalStaff.classList.remove('active');
          fetchStaff();
        }, 1000);
      } else {
        staffModalFeedback.textContent = `✗ ${data.error}`;
        staffModalFeedback.className = 'verify-feedback error';
      }
    } catch (err) {
      staffModalFeedback.textContent = `✗ Error: ${err.message}`;
      staffModalFeedback.className = 'verify-feedback error';
    }
  });

  window.editStaff = (userId, role, tag) => {
    document.getElementById('staff_user_id').value = userId;
    document.getElementById('staff_role').value = role;
    document.getElementById('staff_custom_title').value = tag || '';
    modalStaff.classList.add('active');
  };

  window.deleteStaff = async (userId) => {
    if (!confirm(`¿Deseas remover a ${userId} del Staff y quitarle permisos de administrador?`)) return;
    try {
      const res = await secureFetch(`${API_PREFIX}/staff/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demoteInGroups: true }),
      });
      const data = await res.json();
      if (data.ok) {
        fetchStaff();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert(`Error de red: ${err.message}`);
    }
  };

  // ══════════════════════════════════════════════════════
  // 3. CANALES DE VERIFICACIÓN
  // ══════════════════════════════════════════════════════

  async function fetchVerificationChannels() {
    try {
      const res = await secureFetch(`${API_PREFIX}/config/verification-channels`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.channels)) {
        cachedVerifChannels = data.channels.map((c) => c.target);
        renderVerifChannels(data.channels);
      }
    } catch (e) {
      console.warn('Error cargando canales de verificación:', e);
    }
  }

  function renderVerifChannels(channels) {
    if (channels.length === 0) {
      verifChannelsTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-dim);">No hay canales agregados aún.</td></tr>`;
      return;
    }

    verifChannelsTableBody.innerHTML = channels
      .map((c, idx) => {
        const statusBadge = c.isBotAdmin
          ? '<span class="badge badge-green">BOT ADMIN</span>'
          : (c.isValid ? '<span class="badge badge-orange">CONECTADO</span>' : '<span class="badge badge-red">INVÁLIDO</span>');

        const subsDisplay = c.memberCount ? `${c.memberCount.toLocaleString()} subs` : '—';

        return `
          <tr>
            <td><code>${escapeHtml(c.target)}</code></td>
            <td><strong>${escapeHtml(c.title || c.target)}</strong></td>
            <td>${subsDisplay}</td>
            <td>${statusBadge}</td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="removeVerifChannel(${idx})">Eliminar</button>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  btnAddVerifChannel.addEventListener('click', async () => {
    const channel = inputNewVerifChannel.value.trim();
    if (!channel) return;

    verifChannelFeedback.textContent = 'Agregando canal y verificando...';
    verifChannelFeedback.className = 'verify-feedback';

    const updated = [...cachedVerifChannels, channel];
    try {
      const res = await secureFetch(`${API_PREFIX}/config/verification-channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channels: updated }),
      });
      const data = await res.json();
      if (data.ok) {
        inputNewVerifChannel.value = '';
        verifChannelFeedback.textContent = '✓ Canal agregado con éxito.';
        verifChannelFeedback.className = 'verify-feedback success';
        fetchVerificationChannels();
      } else {
        verifChannelFeedback.textContent = `✗ ${data.error}`;
        verifChannelFeedback.className = 'verify-feedback error';
      }
    } catch (e) {
      verifChannelFeedback.textContent = `✗ Error: ${e.message}`;
      verifChannelFeedback.className = 'verify-feedback error';
    }
  });

  window.removeVerifChannel = async (index) => {
    if (!confirm('¿Eliminar este canal de los requisitos obligatorios de verificación?')) return;
    const updated = cachedVerifChannels.filter((_, i) => i !== index);
    try {
      const res = await secureFetch(`${API_PREFIX}/config/verification-channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channels: updated }),
      });
      const data = await res.json();
      if (data.ok) {
        fetchVerificationChannels();
      }
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  };

  // ══════════════════════════════════════════════════════
  // 4. AJUSTES DE COMUNIDAD (/set commands)
  // ══════════════════════════════════════════════════════

  async function fetchCommunitySettings() {
    try {
      const res = await secureFetch(`${API_PREFIX}/config/community`);
      const data = await res.json();
      if (data.ok && data.settings) {
        const s = data.settings;
        document.getElementById('set_escrow_group_id').value = s.escrow_group_id || '';
        document.getElementById('set_staff_chat_id').value = s.staff_chat_id || '';
        document.getElementById('set_staff_thread_id').value = s.staff_thread_id || '';
        document.getElementById('set_log_channel_id').value = s.log_channel_id || '';
        document.getElementById('set_log_thread_id').value = s.log_thread_id || '';
        document.getElementById('set_public_burn_channel_id').value = s.public_burn_channel_id || '';
        document.getElementById('set_public_burn_thread_id').value = s.public_burn_thread_id || '';
        document.getElementById('set_groups_folder_link').value = s.groups_folder_link || '';
      }
    } catch (e) {
      console.warn('Error cargando ajustes de comunidad:', e);
    }
  }

  formCommunity.addEventListener('submit', async (e) => {
    e.preventDefault();
    communityFeedback.textContent = 'Guardando ajustes en base de datos...';
    communityFeedback.className = 'verify-feedback';

    const payload = {
      escrow_group_id: document.getElementById('set_escrow_group_id').value.trim(),
      staff_chat_id: document.getElementById('set_staff_chat_id').value.trim(),
      staff_thread_id: document.getElementById('set_staff_thread_id').value.trim(),
      log_channel_id: document.getElementById('set_log_channel_id').value.trim(),
      log_thread_id: document.getElementById('set_log_thread_id').value.trim(),
      public_burn_channel_id: document.getElementById('set_public_burn_channel_id').value.trim(),
      public_burn_thread_id: document.getElementById('set_public_burn_thread_id').value.trim(),
      groups_folder_link: document.getElementById('set_groups_folder_link').value.trim(),
    };

    try {
      const res = await secureFetch(`${API_PREFIX}/config/community`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        communityFeedback.textContent = '✓ Configuración maestra de canales y grupos guardada con éxito.';
        communityFeedback.className = 'verify-feedback success';
      } else {
        communityFeedback.textContent = `✗ ${data.error}`;
        communityFeedback.className = 'verify-feedback error';
      }
    } catch (err) {
      communityFeedback.textContent = `✗ Error: ${err.message}`;
      communityFeedback.className = 'verify-feedback error';
    }
  });

  function escapeHtml(text) {
    if (!text) return '';
    return String(text).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }
});
