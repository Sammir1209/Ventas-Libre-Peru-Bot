// ══════
// ⟡ VLP SaaS & Bot Control Center — Client Application
// ══════

document.addEventListener('DOMContentLoaded', () => {
  const API_PREFIX = '/api-sec-vlp';

  // ── Navigation Views ──
  const navItems = {
    groups: document.getElementById('nav-groups'),
    users: document.getElementById('nav-users'),
    staff: document.getElementById('nav-staff'),
    deals: document.getElementById('nav-deals'),
    burn: document.getElementById('nav-burn'),
    audit: document.getElementById('nav-audit'),
    verification: document.getElementById('nav-verification'),
    community: document.getElementById('nav-community'),
  };

  const views = {
    groups: document.getElementById('view-groups'),
    users: document.getElementById('view-users'),
    staff: document.getElementById('view-staff'),
    deals: document.getElementById('view-deals'),
    burn: document.getElementById('view-burn'),
    audit: document.getElementById('view-audit'),
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

    if (target === 'users') fetchUsers();
    else if (target === 'deals') fetchDeals();
    else if (target === 'burn') fetchBurnData();
    else if (target === 'audit') fetchAuditLogs();
    else if (target === 'groups') fetchGroups();
    else if (target === 'staff') fetchStaff();
    else if (target === 'verification') fetchVerificationChannels();
    else if (target === 'community') fetchCommunitySettings();
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

  // Branding Settings Elements
  const formBranding = document.getElementById('form-branding-settings');
  const brandingFeedback = document.getElementById('branding-feedback');
  const inputBrandingLogo = document.getElementById('branding_logo_url');
  const inputBrandingName = document.getElementById('branding_community_name');
  const inputBrandingAccent = document.getElementById('branding_accent_color');

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
    populateBrandingInputs(branding, themeData.communityName);
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

  function loadAllData() {
    fetchOverviewStats();
    const hash = (window.location.hash || '#groups').replace('#', '');
    const initialView = views[hash] ? hash : 'groups';
    switchView(initialView);
  }

  // ══════
  // 1. GRUPOS & SEGURIDAD EN TIEMPO REAL
  // ══════

  async function fetchGroups(fresh = false) {
    groupsContainer.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Sincronizando grupos con Telegram API...</p>
      </div>`;

    try {
      const res = await secureFetch(`${API_PREFIX}/bot/groups${fresh ? '?fresh=1' : ''}`);
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

  btnRefreshGroups.addEventListener('click', () => fetchGroups(true));

  function renderGroups(groups) {
    let adminCount = 0;
    let lockdownCount = 0;

    if (groups.length === 0) {
      groupsContainer.innerHTML = `<div class="empty-state">El bot aún no está registrado en ningún grupo. Agrégalo a tus grupos como administrador.</div>`;
      if (statGroupsCount) statGroupsCount.textContent = '0';
      if (statAdminCount) statAdminCount.textContent = '0';
      if (statLockdownCount) statLockdownCount.textContent = '0';
      if (groupsCountBadge) groupsCountBadge.textContent = '0 Grupos';
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
          ? '<span class="badge badge-red">[ DEFCON 1 ]</span>'
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06-.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                Configurar Seguridad
              </button>
              <button class="btn btn-secondary btn-sm" onclick="unbindGroupClick('${g.chat_id}', '${escapeHtml(g.title || 'Grupo')}')" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3);">
                Desvincular
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    if (statGroupsCount) statGroupsCount.textContent = groups.length;
    if (statAdminCount) statAdminCount.textContent = adminCount;
    if (statLockdownCount) statLockdownCount.textContent = lockdownCount;
    if (groupsCountBadge) groupsCountBadge.textContent = `${groups.length} Grupos`;
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
      panicBannerTitle.textContent = '[ MODO PÁNICO ACTIVO ] (CHAT BLOQUEADO)';
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

  // ══════
  // 2. GESTIÓN DE STAFF EN TIEMPO REAL
  // ══════

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

  // ══════
  // 3. CANALES DE VERIFICACIÓN
  // ══════

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

  // ══════
  // 4. AJUSTES DE COMUNIDAD (/set commands)
  // ══════

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

  // ══════
  // 5. PERSONALIZACIÓN VISUAL & BRANDING
  // ══════

  function populateBrandingInputs(branding, communityName) {
    if (inputBrandingLogo && branding) {
      inputBrandingLogo.value = branding.logo_url || '';
    }
    if (inputBrandingName) {
      inputBrandingName.value = branding?.community_display_name || communityName || '';
    }
    if (inputBrandingAccent && branding?.accent_color) {
      inputBrandingAccent.value = branding.accent_color;
    }
  }

  if (formBranding) {
    formBranding.addEventListener('submit', async (e) => {
      e.preventDefault();
      brandingFeedback.textContent = 'Guardando personalización visual...';
      brandingFeedback.className = 'verify-feedback';

      const payload = {
        logo_url: inputBrandingLogo ? inputBrandingLogo.value.trim() : '',
        community_display_name: inputBrandingName ? inputBrandingName.value.trim() : '',
        accent_color: inputBrandingAccent ? inputBrandingAccent.value.trim() : '#ffffff',
      };

      try {
        const tenantId = currentSession?.tenantId || '';
        const url = tenantId ? `${API_PREFIX}/branding/${tenantId}` : `${API_PREFIX}/branding`;
        const res = await secureFetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.ok) {
          brandingFeedback.textContent = '✓ Personalización visual guardada y aplicada con éxito.';
          brandingFeedback.className = 'verify-feedback success';

          // Aplicar tema en tiempo real en la interfaz
          if (currentSession) {
            currentSession.branding = data.branding;
            applyTheme(currentSession);
          }
        } else {
          brandingFeedback.textContent = `✗ ${data.error}`;
          brandingFeedback.className = 'verify-feedback error';
        }
      } catch (err) {
        brandingFeedback.textContent = `✗ Error: ${err.message}`;
        brandingFeedback.className = 'verify-feedback error';
      }
    });
  }

  // ══════
  // 6. ESTADÍSTICAS GLOBALES CONSOLIDADAS (OVERVIEW)
  // ══════

  async function fetchOverviewStats() {
    try {
      const res = await secureFetch(`${API_PREFIX}/stats/overview`);
      const data = await res.json();
      if (data.ok && data.stats) {
        const s = data.stats;
        const elGroups = document.getElementById('stat-groups-count');
        const elUsers = document.getElementById('stat-users-count');
        const elStaff = document.getElementById('stat-staff-count');
        const elDeals = document.getElementById('stat-deals-count');
        const elChannels = document.getElementById('stat-channels-count');
        const elBurned = document.getElementById('stat-burned-count');

        if (elGroups) elGroups.textContent = s.groupsCount ?? 0;
        if (elUsers) elUsers.textContent = s.usersCount ?? '—';
        if (elStaff) elStaff.textContent = s.staffCount ?? 0;
        if (elDeals) elDeals.textContent = s.dealsCount ?? 0;
        if (elChannels) elChannels.textContent = s.channelsCount ?? 0;
        if (elBurned) elBurned.textContent = s.burnedCount ?? 0;
      }
    } catch (e) {
      console.warn('Error cargando estadísticas consolidadas:', e);
    }
  }

  // ══════
  // 7. DIRECTORIO DE USUARIOS
  // ══════

  let currentUsersPage = 1;
  let currentUsersSearch = '';
  const usersTableBody = document.getElementById('users-table-body');
  const inputSearchUsers = document.getElementById('input-search-users');
  const btnSearchUsers = document.getElementById('btn-search-users');
  const btnPrevUsers = document.getElementById('btn-prev-users');
  const btnNextUsers = document.getElementById('btn-next-users');
  const usersPaginationLabel = document.getElementById('users-pagination-label');
  const usersCountSummary = document.getElementById('users-count-summary');
  const btnRefreshUsers = document.getElementById('btn-refresh-users');

  // Modal Usuario
  const modalUserDetail = document.getElementById('modal-user-detail');
  const btnCloseUserModal = document.getElementById('btn-close-user-modal');
  const btnToggleVerifyUser = document.getElementById('btn-toggle-verify-user');
  let activeSelectedUser = null;

  async function fetchUsers(page = currentUsersPage, search = currentUsersSearch) {
    currentUsersPage = page;
    currentUsersSearch = search;
    if (!usersTableBody) return;

    usersTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-dim); padding: 2rem;"><div class="spinner" style="margin: 0 auto 10px;"></div>Cargando usuarios de la base de datos...</td></tr>`;

    try {
      const res = await secureFetch(`${API_PREFIX}/users?page=${page}&limit=20&search=${encodeURIComponent(search)}`);
      const data = await res.json();

      if (data.ok) {
        renderUsers(data.users || []);
        if (usersPaginationLabel) {
          usersPaginationLabel.textContent = `Página ${data.page} de ${data.totalPages || 1} (${data.total} registrados)`;
        }
        if (usersCountSummary) {
          usersCountSummary.textContent = `${data.total} usuarios registrados en la base de datos`;
        }
        if (btnPrevUsers) btnPrevUsers.disabled = data.page <= 1;
        if (btnNextUsers) btnNextUsers.disabled = data.page >= data.totalPages;
      } else {
        usersTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger); padding: 2rem;">✗ Error: ${escapeHtml(data.error)}</td></tr>`;
      }
    } catch (e) {
      usersTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger); padding: 2rem;">✗ Error de conexión: ${escapeHtml(e.message)}</td></tr>`;
    }
  }

  function renderUsers(users) {
    if (!users.length) {
      usersTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-dim); padding: 2rem;">No se encontraron usuarios coincidentes.</td></tr>`;
      return;
    }

    usersTableBody.innerHTML = users
      .map((u) => {
        const isVerif = u.verified || u.is_verified;
        const verifBadge = isVerif
          ? `<span class="badge badge-green" style="cursor: pointer;" onclick="toggleUserVerifyClick(${u.user_id}, false)" title="Pulsar para desverificar">✓ VERIFICADO</span>`
          : `<span class="badge badge-orange" style="cursor: pointer;" onclick="toggleUserVerifyClick(${u.user_id}, true)" title="Pulsar para verificar">⏳ PENDIENTE</span>`;

        const staffBadge = u.staff_role
          ? `<span class="badge badge-purple">${escapeHtml(u.staff_role)}</span>`
          : `<span style="color: var(--text-dim); font-size: 0.85rem;">Miembro</span>`;

        const burnBadge = u.is_burned
          ? `<span class="badge badge-red">[ QUEMADO ]</span>`
          : `<span class="badge badge-green" style="background: rgba(34,197,94,0.08); border-color: transparent;">LIMPIO</span>`;

        const displayName = u.first_name || u.username || 'Usuario';
        const userTag = u.username ? `@${escapeHtml(u.username)}` : '<i>Sin @alias</i>';

        return `
          <tr>
            <td>
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 34px; height: 34px; border-radius: 50%; background: var(--bg-hover); display: flex; align-items: center; justify-content: center; font-weight: 700; color: var(--primary);">
                  ${escapeHtml(displayName.charAt(0).toUpperCase())}
                </div>
                <div>
                  <strong>${escapeHtml(displayName)}</strong>
                  <div style="font-size: 0.75rem; color: var(--text-dim);">${userTag}</div>
                </div>
              </div>
            </td>
            <td><code>${u.user_id}</code></td>
            <td>${staffBadge}</td>
            <td>${verifBadge}</td>
            <td>${burnBadge}</td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="openUserDetailModal(${JSON.stringify(u).replace(/"/g, '&quot;')})">Ficha</button>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  window.toggleUserVerifyClick = async (userId, newStatus) => {
    try {
      const res = await secureFetch(`${API_PREFIX}/users/${userId}/toggle-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verified: newStatus }),
      });
      const data = await res.json();
      if (data.ok) {
        fetchUsers();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  };

  window.openUserDetailModal = (u) => {
    activeSelectedUser = u;
    const modal = document.getElementById('modal-user-detail');
    if (!modal) return;

    document.getElementById('modal-user-title').textContent = u.first_name || u.username || 'Ficha de Usuario';
    document.getElementById('modal-user-subtitle').textContent = `ID de Telegram: ${u.user_id}`;
    document.getElementById('user-detail-avatar').textContent = (u.first_name || u.username || 'U').charAt(0).toUpperCase();
    document.getElementById('user-detail-name').textContent = u.first_name || 'Sin nombre registrado';
    document.getElementById('user-detail-username').textContent = u.username ? `@${u.username}` : 'Sin @username';
    document.getElementById('user-detail-verified').innerHTML = (u.verified || u.is_verified)
      ? '<span style="color: #22c55e;">✓ Verificado Oficial</span>'
      : '<span style="color: #f59e0b;">Pendiente</span>';
    document.getElementById('user-detail-staff').textContent = u.staff_role || 'Miembro Regular';
    document.getElementById('user-detail-burned').innerHTML = u.is_burned
      ? '<span style="color: #ef4444; font-weight: 700;">[ ALERTA: REGISTRADO EN LISTA NEGRA ]</span>'
      : '<span style="color: #22c55e;">✓ Sin antecedentes</span>';
    document.getElementById('user-detail-created').textContent = u.created_at
      ? new Date(u.created_at).toLocaleString()
      : 'Desconocida';

    const feedback = document.getElementById('user-modal-feedback');
    if (feedback) feedback.textContent = '';

    modal.classList.add('active');
  };

  if (btnCloseUserModal) {
    btnCloseUserModal.addEventListener('click', () => {
      modalUserDetail.classList.remove('active');
    });
  }

  if (btnToggleVerifyUser) {
    btnToggleVerifyUser.addEventListener('click', async () => {
      if (!activeSelectedUser) return;
      const current = Boolean(activeSelectedUser.verified || activeSelectedUser.is_verified);
      const newStatus = !current;
      const feedback = document.getElementById('user-modal-feedback');
      if (feedback) {
        feedback.textContent = 'Actualizando estado de verificación...';
        feedback.className = 'verify-feedback';
      }

      try {
        const res = await secureFetch(`${API_PREFIX}/users/${activeSelectedUser.user_id}/toggle-verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verified: newStatus }),
        });
        const data = await res.json();
        if (data.ok) {
          activeSelectedUser.verified = newStatus;
          activeSelectedUser.is_verified = newStatus;
          document.getElementById('user-detail-verified').innerHTML = newStatus
            ? '<span style="color: #22c55e;">✓ Verificado Oficial</span>'
            : '<span style="color: #f59e0b;">⏳ No Verificado</span>';
          if (feedback) {
            feedback.textContent = '✓ Estado de verificación actualizado con éxito.';
            feedback.className = 'verify-feedback success';
          }
          fetchUsers();
        } else {
          if (feedback) {
            feedback.textContent = `✗ ${data.error}`;
            feedback.className = 'verify-feedback error';
          }
        }
      } catch (e) {
        if (feedback) {
          feedback.textContent = `✗ Error: ${e.message}`;
          feedback.className = 'verify-feedback error';
        }
      }
    });
  }

  if (btnSearchUsers && inputSearchUsers) {
    btnSearchUsers.addEventListener('click', () => {
      fetchUsers(1, inputSearchUsers.value.trim());
    });
    inputSearchUsers.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        fetchUsers(1, inputSearchUsers.value.trim());
      }
    });
  }

  if (btnPrevUsers) {
    btnPrevUsers.addEventListener('click', () => {
      if (currentUsersPage > 1) fetchUsers(currentUsersPage - 1, currentUsersSearch);
    });
  }

  if (btnNextUsers) {
    btnNextUsers.addEventListener('click', () => {
      fetchUsers(currentUsersPage + 1, currentUsersSearch);
    });
  }

  if (btnRefreshUsers) {
    btnRefreshUsers.addEventListener('click', () => {
      fetchUsers(currentUsersPage, currentUsersSearch);
    });
  }

  // ══════
  // 8. TRATOS & ESCROW
  // ══════

  const dealsTableBody = document.getElementById('deals-table-body');
  const btnRefreshDeals = document.getElementById('btn-refresh-deals');

  async function fetchDeals() {
    if (!dealsTableBody) return;
    dealsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-dim); padding: 2rem;"><div class="spinner" style="margin: 0 auto 10px;"></div>Cargando salas de intermediación...</td></tr>`;

    try {
      const res = await secureFetch(`${API_PREFIX}/deals`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.deals)) {
        renderDeals(data.deals);
      } else {
        dealsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger); padding: 2rem;">✗ Error: ${escapeHtml(data.error)}</td></tr>`;
      }
    } catch (e) {
      dealsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger); padding: 2rem;">✗ Error: ${escapeHtml(e.message)}</td></tr>`;
    }
  }

  function renderDeals(deals) {
    if (!deals.length) {
      dealsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-dim); padding: 2rem;">No hay tratos registrados aún.</td></tr>`;
      return;
    }

    dealsTableBody.innerHTML = deals
      .map((d) => {
        const st = (d.status || 'PENDING').toUpperCase();
        let badgeClass = 'badge-deal-pending';
        if (st === 'COMPLETED') badgeClass = 'badge-deal-completed';
        else if (st === 'IN_PROGRESS' || st === 'ASSIGNED') badgeClass = 'badge-deal-progress';
        else if (st === 'CANCELLED') badgeClass = 'badge-deal-cancelled';

        const roomBtn = d.invite_link
          ? `<a href="${escapeHtml(d.invite_link)}" target="_blank" class="btn btn-secondary btn-sm">Unirse a Sala</a>`
          : `<span style="color: var(--text-dim); font-size: 0.8rem;">Sin enlace</span>`;

        return `
          <tr>
            <td><strong>#${d.id}</strong></td>
            <td><code>${d.creator_id}</code></td>
            <td><strong>${escapeHtml(d.admin_name || 'Sin Asignar')}</strong></td>
            <td><span class="${badgeClass}">${st}</span></td>
            <td>${d.created_at ? new Date(d.created_at).toLocaleDateString() : '—'}</td>
            <td>${roomBtn}</td>
          </tr>
        `;
      })
      .join('');
  }

  if (btnRefreshDeals) {
    btnRefreshDeals.addEventListener('click', () => fetchDeals());
  }

  // ══════
  // 9. QUEMADOS & REPORTES DE ESTAFA
  // ══════

  const burnedTableBody = document.getElementById('burned-table-body');
  const burnReportsContainer = document.getElementById('burn-reports-container');
  const btnRefreshBurn = document.getElementById('btn-refresh-burn');
  const tabBurnScammers = document.getElementById('tab-burn-scammers');
  const tabBurnReports = document.getElementById('tab-burn-reports');
  const subviewBurnScammers = document.getElementById('subview-burn-scammers');
  const subviewBurnReports = document.getElementById('subview-burn-reports');
  const countBurnedTab = document.getElementById('count-burned-tab');
  const countReportsTab = document.getElementById('count-reports-tab');

  if (tabBurnScammers && tabBurnReports) {
    tabBurnScammers.addEventListener('click', () => {
      tabBurnScammers.className = 'btn btn-primary btn-sm';
      tabBurnReports.className = 'btn btn-secondary btn-sm';
      subviewBurnScammers.style.display = 'block';
      subviewBurnReports.style.display = 'none';
    });

    tabBurnReports.addEventListener('click', () => {
      tabBurnReports.className = 'btn btn-primary btn-sm';
      tabBurnScammers.className = 'btn btn-secondary btn-sm';
      subviewBurnScammers.style.display = 'none';
      subviewBurnReports.style.display = 'block';
    });
  }

  async function fetchBurnData() {
    if (!burnedTableBody) return;
    try {
      const res = await secureFetch(`${API_PREFIX}/burn`);
      const data = await res.json();
      if (data.ok) {
        renderBurnedUsers(data.burned || []);
        renderBurnReports(data.reports || []);
        if (countBurnedTab) countBurnedTab.textContent = (data.burned || []).length;
        if (countReportsTab) countReportsTab.textContent = (data.reports || []).length;
      }
    } catch (e) {
      console.warn('Error cargando datos de lista negra y reportes:', e);
    }
  }

  function renderBurnedUsers(burnedList) {
    if (!burnedList.length) {
      burnedTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-dim); padding: 2rem;">No hay estafadores registrados en lista negra.</td></tr>`;
      return;
    }

    burnedTableBody.innerHTML = burnedList
      .map((b) => {
        const userTag = b.username ? `@${escapeHtml(b.username)}` : (b.first_name || 'Estafador');
        return `
          <tr>
            <td><strong>${userTag}</strong></td>
            <td><code>${b.user_id}</code></td>
            <td style="max-width: 320px; font-size: 0.85rem;">${escapeHtml(b.context || 'Sin detalles')}</td>
            <td><code>${b.reported_by || b.approved_by || 'Staff'}</code></td>
            <td>${b.burned_at ? new Date(b.burned_at).toLocaleDateString() : '—'}</td>
          </tr>
        `;
      })
      .join('');
  }

  function renderBurnReports(reports) {
    if (!burnReportsContainer) return;
    const pending = reports.filter((r) => (r.status || 'PENDING') === 'PENDING');

    if (!pending.length) {
      burnReportsContainer.innerHTML = `<p style="color: var(--text-dim); text-align: center; padding: 2rem;">✓ No hay reportes pendientes de revisión. La comunidad está al día.</p>`;
      return;
    }

    burnReportsContainer.innerHTML = pending
      .map((r) => {
        const proofs = Array.isArray(r.proof_urls) ? r.proof_urls : [];
        const proofHtml = proofs.length > 0
          ? `
            <div class="proof-gallery">
              ${proofs.map((url) => `
                <div class="proof-thumbnail-wrap">
                  <a href="${escapeHtml(url)}" target="_blank">
                    <img src="${escapeHtml(url)}" class="proof-thumbnail" alt="Prueba">
                  </a>
                </div>
              `).join('')}
            </div>
          `
          : `<div style="color: var(--text-dim); font-size: 0.8rem; margin-top: 8px;">Sin capturas fotográficas adjuntas.</div>`;

        return `
          <div class="burn-report-card">
            <div class="burn-report-header">
              <div>
                <strong>Reporte #${r.id}</strong> — Acusado: <code>${r.target_id}</code>
              </div>
              <span class="badge badge-orange">PENDIENTE DE REVISIÓN</span>
            </div>
            <div>
              <div style="font-size: 0.8rem; color: var(--text-dim);">Denunciante: <code>${r.reporter_id}</code> | Fecha: ${r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</div>
              <p style="margin-top: 8px; font-size: 0.9rem; line-height: 1.4;">${escapeHtml(r.context || 'Sin descripción')}</p>
            </div>
            ${proofHtml}
            <div class="burn-actions">
              <button class="btn btn-secondary btn-sm" onclick="reviewBurnReportClick(${r.id}, 'REJECTED')">RECHAZAR</button>
              <button class="btn btn-danger btn-sm" onclick="reviewBurnReportClick(${r.id}, 'APPROVED')">APROBAR & QUEMAR</button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  window.reviewBurnReportClick = async (reportId, action) => {
    const verb = action === 'APPROVED' ? 'aprobar y quemar' : 'rechazar';
    if (!confirm(`¿Confirmas que deseas ${verb} el reporte #${reportId}?`)) return;

    try {
      const res = await secureFetch(`${API_PREFIX}/burn/report/${reportId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.ok) {
        fetchBurnData();
        fetchOverviewStats();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  };

  if (btnRefreshBurn) {
    btnRefreshBurn.addEventListener('click', () => fetchBurnData());
  }

  // ══════
  // 10. REGISTRO DE AUDITORÍA EN TIEMPO REAL (LIVE AUDIT LOG)
  // ══════

  let currentAuditPage = 1;
  let currentAuditAction = 'ALL';
  let currentAuditSearch = '';

  const auditTableBody = document.getElementById('audit-table-body');
  const selectAuditAction = document.getElementById('select-audit-action');
  const inputSearchAudit = document.getElementById('input-search-audit');
  const btnSearchAudit = document.getElementById('btn-search-audit');
  const btnRefreshAudit = document.getElementById('btn-refresh-audit');
  const btnPrevAudit = document.getElementById('btn-prev-audit');
  const btnNextAudit = document.getElementById('btn-next-audit');
  const auditPaginationLabel = document.getElementById('audit-pagination-label');
  const auditCountSummary = document.getElementById('audit-count-summary');

  async function fetchAuditLogs(page = currentAuditPage, action = currentAuditAction, search = currentAuditSearch) {
    currentAuditPage = page;
    currentAuditAction = action;
    currentAuditSearch = search;

    if (!auditTableBody) return;

    auditTableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-dim);">
          <div class="spinner" style="margin: 0 auto 10px;"></div>
          Consultando registros de auditoría en vivo...
        </td>
      </tr>
    `;

    try {
      const qParams = new URLSearchParams({
        page: String(page),
        limit: '20',
      });
      if (action && action !== 'ALL') qParams.set('action', action);
      if (search && search.trim()) qParams.set('search', search.trim());

      const res = await secureFetch(`${API_PREFIX}/audit-logs?${qParams.toString()}`);
      const data = await res.json();

      if (!data.ok || !Array.isArray(data.logs)) {
        auditTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--color-danger); padding: 2rem;">Error: ${data.error || 'No se pudieron cargar los registros'}</td></tr>`;
        return;
      }

      renderAuditLogs(data.logs, data.total, data.page, data.totalPages);
    } catch (err) {
      auditTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--color-danger); padding: 2rem;">Error de conexión: ${err.message}</td></tr>`;
    }
  }

  function renderAuditLogs(logs, total, page, totalPages) {
    if (auditCountSummary) {
      auditCountSummary.textContent = `${total} eventos registrados`;
    }
    if (auditPaginationLabel) {
      auditPaginationLabel.textContent = `Página ${page} de ${totalPages || 1} (${total} eventos)`;
    }
    if (btnPrevAudit) btnPrevAudit.disabled = page <= 1;
    if (btnNextAudit) btnNextAudit.disabled = page >= totalPages;

    if (logs.length === 0) {
      auditTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 3rem; color: var(--text-dim);">
            No se encontraron eventos de auditoría con los filtros aplicados.
          </td>
        </tr>
      `;
      return;
    }

    auditTableBody.innerHTML = logs
      .map((log) => {
        const dateStr = log.created_at
          ? new Date(log.created_at).toLocaleString('es-PE', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
          : '—';

        let badgeClass = 'badge-audit-default';
        const act = (log.action || '').toUpperCase();
        if (['GBAN', 'BAN', 'BURN'].includes(act)) badgeClass = 'badge-audit-gban';
        else if (['MUTE', 'WARN'].includes(act)) badgeClass = 'badge-audit-mute';
        else if (['UNMUTE', 'UNLOCKDOWN', 'VERIFIED'].includes(act)) badgeClass = 'badge-audit-unmute';
        else if (['ANTI_RAID_LOCKDOWN', 'LOCKDOWN'].includes(act)) badgeClass = 'badge-audit-lockdown';

        const targetDisplay = log.target_id && log.target_id !== 0 && log.target_id !== '0'
          ? `<code>${log.target_id}</code>`
          : '<span style="color: var(--text-dim);">N/A (Grupal)</span>';

        const reasonDisplay = log.reason ? escapeHtml(log.reason) : '<span style="color: var(--text-dim); font-style: italic;">Sin motivo especificado</span>';

        return `
          <tr>
            <td style="font-size: 0.8rem; color: var(--text-dim); white-space: nowrap;">${dateStr}</td>
            <td><span class="badge-audit ${badgeClass}">${escapeHtml(act)}</span></td>
            <td>
              <strong>${escapeHtml(log.moderator_name || 'Admin')}</strong>
              ${log.moderator_id ? `<br><small style="color: var(--text-dim);">ID: <code>${log.moderator_id}</code></small>` : ''}
            </td>
            <td>${targetDisplay}</td>
            <td>
              <span style="font-size: 0.85rem;">${escapeHtml(log.chat_title || 'Global')}</span>
              ${log.chat_id ? `<br><small style="color: var(--text-dim);"><code>${log.chat_id}</code></small>` : ''}
            </td>
            <td style="max-width: 250px; font-size: 0.85rem; line-height: 1.4;">${reasonDisplay}</td>
          </tr>
        `;
      })
      .join('');
  }

  if (selectAuditAction) {
    selectAuditAction.addEventListener('change', (e) => {
      fetchAuditLogs(1, e.target.value, currentAuditSearch);
    });
  }

  if (btnSearchAudit && inputSearchAudit) {
    btnSearchAudit.addEventListener('click', () => {
      fetchAuditLogs(1, currentAuditAction, inputSearchAudit.value);
    });
    inputSearchAudit.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        fetchAuditLogs(1, currentAuditAction, inputSearchAudit.value);
      }
    });
  }

  if (btnRefreshAudit) {
    btnRefreshAudit.addEventListener('click', () => {
      fetchAuditLogs(currentAuditPage, currentAuditAction, currentAuditSearch);
    });
  }

  if (btnPrevAudit) {
    btnPrevAudit.addEventListener('click', () => {
      if (currentAuditPage > 1) fetchAuditLogs(currentAuditPage - 1);
    });
  }

  if (btnNextAudit) {
    btnNextAudit.addEventListener('click', () => {
      fetchAuditLogs(currentAuditPage + 1);
    });
  }

  // ══════
  // 11. GESTIÓN OFICIAL DE STAFF Y SYNC TELEGRAM
  // ══════

  async function fetchStaff() {
    if (!staffContainer) return;
    staffContainer.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Cargando equipo de Staff oficial...</p></div>`;

    try {
      const res = await secureFetch(`/api/staff`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.staff)) {
        renderStaff(data.staff);
      } else {
        staffContainer.innerHTML = `<p style="color: var(--danger); text-align: center; padding: 2rem;">Error cargando staff: ${escapeHtml(data.error)}</p>`;
      }
    } catch (e) {
      staffContainer.innerHTML = `<p style="color: var(--danger); text-align: center; padding: 2rem;">Error de conexión: ${escapeHtml(e.message)}</p>`;
    }
  }

  function renderStaff(staffList) {
    if (!staffContainer) return;
    if (!staffList.length) {
      staffContainer.innerHTML = `<p style="color: var(--text-dim); text-align: center; padding: 2rem;">No hay miembros de staff registrados.</p>`;
      return;
    }

    staffContainer.innerHTML = staffList
      .map((s) => {
        const roleUpper = (s.role || 'ADMIN').toUpperCase();
        let badgeColor = 'badge-purple';
        if (roleUpper.includes('OWNER')) badgeColor = 'badge-orange';
        else if (roleUpper.includes('TRATO')) badgeColor = 'badge-green';

        const usernameDisplay = s.username
          ? `<a href="https://t.me/${escapeHtml(s.username)}" target="_blank" style="color: var(--primary); text-decoration: none;">@${escapeHtml(s.username)}</a>`
          : `<span style="color: var(--warning); font-size: 0.8rem;">Sin @</span>`;

        return `
          <div class="bot-card">
            <div class="bot-card-header">
              <div class="bot-avatar">
                ${escapeHtml((s.first_name || 'S').charAt(0).toUpperCase())}
              </div>
              <div class="bot-info">
                <h3>${escapeHtml(s.first_name || 'Staff')}</h3>
                <span class="bot-username">${usernameDisplay}</span>
              </div>
              <span class="badge ${badgeColor}">${escapeHtml(roleUpper)}</span>
            </div>
            <div class="bot-card-body" style="padding: 1rem 0; font-size: 0.85rem; color: var(--text-dim);">
              <div>ID Telegram: <code>${s.user_id}</code></div>
              ${s.custom_title ? `<div style="margin-top: 4px;">Título: <strong>${escapeHtml(s.custom_title)}</strong></div>` : ''}
            </div>
            <div class="bot-card-actions" style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn btn-secondary btn-sm" onclick="syncStaffClick(${s.user_id})" title="Consultar en Telegram si cambió de @ o nombre">Sync @ Telegram</button>
              <button class="btn btn-secondary btn-sm" onclick="editStaffClick(${s.user_id}, '${escapeHtml(s.username || '')}', '${escapeHtml(s.first_name || '')}', '${escapeHtml(s.role || 'ADMIN')}')">Editar</button>
              <button class="btn btn-danger btn-sm" onclick="deleteStaffClick(${s.user_id})">Eliminar</button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  window.syncStaffClick = async (userId) => {
    try {
      const res = await secureFetch(`/api/staff/${userId}/sync`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        alert(`✓ Sincronizado exitosamente con Telegram:\nNombre: ${data.data.firstName}\n@Username: @${data.data.username || 'Sin alias'}`);
        fetchStaff();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      alert(`Error de red: ${e.message}`);
    }
  };

  window.editStaffClick = async (userId, currentUsername, currentName, currentRole) => {
    const newUsername = prompt(`Nuevo @username para ID ${userId}:`, currentUsername ? `@${currentUsername}` : '');
    if (newUsername === null) return;

    const newRole = prompt(`Nuevo rol (OWNER, CO-OWNER, ADMIN, TRATO ADMIN):`, currentRole);
    if (!newRole) return;

    try {
      const res = await secureFetch(`/api/staff/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername.replace('@', '').trim(),
          role: newRole.toUpperCase().trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        alert('✓ Staff actualizado con éxito.');
        fetchStaff();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  };

  window.deleteStaffClick = async (userId) => {
    if (!confirm(`¿Estás seguro de remover al staff #${userId}?`)) return;
    try {
      const res = await secureFetch(`/api/staff/${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        fetchStaff();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  };

  if (btnOpenStaffModal) {
    btnOpenStaffModal.addEventListener('click', async () => {
      const userId = prompt('Ingresa el ID de Telegram del nuevo staff:');
      if (!userId) return;
      const role = prompt('Rol del Staff (TRATO ADMIN, ADMIN, CO-OWNER, OWNER):', 'TRATO ADMIN');
      if (!role) return;

      try {
        const res = await secureFetch(`/api/staff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: Number(userId.trim()), role: role.trim() }),
        });
        const data = await res.json();
        if (data.ok) {
          alert('✓ Miembro de Staff registrado con éxito.');
          fetchStaff();
        } else {
          alert(`Error: ${data.error}`);
        }
      } catch (e) {
        alert(`Error: ${e.message}`);
      }
    });
  }

  function escapeHtml(text) {
    if (!text) return '';
    return String(text).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }
});
