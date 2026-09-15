'use client';

import { useState, useEffect, useCallback } from 'react';
import PublicChannelsLanding from './PublicChannelsLanding';
import ChannelsVerificationSection from './ChannelsVerificationSection';
import Sidebar from '../common/Sidebar';
import Toast from '../common/Toast';
import StaffSection from '../staff/StaffSection';
import DealsSection from '../deals/DealsSection';
import GbanSection from '../gban/GbanSection';
import GroupsSection from '../groups/GroupsSection';
import DocsSection from '../docs/DocsSection';
import {
  IconUsers,
  IconScale,
  IconAlertTriangle,
  IconShield,
  IconExternalLink,
} from '../common/Icons';

export default function SubBotPortal({ defaultSlug = '', defaultView = 'public', onBackToMain = null }) {
  const [slug, setSlug] = useState(defaultSlug);
  const [view, setView] = useState(defaultView); // 'public' | 'admin'
  const [activeTab, setActiveTab] = useState('stats');
  const [adminToken, setAdminToken] = useState('');
  const [adminKey, setAdminKey] = useState('vlp_master_key_99x_2026_sec');
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState(null);

  const [portalData, setPortalData] = useState(null);
  const [adminData, setAdminData] = useState(null);
  const [stats, setStats] = useState(null);
  const [staff, setStaff] = useState([]);
  const [deals, setDeals] = useState([]);
  const [burned, setBurned] = useState([]);
  const [groups, setGroups] = useState([]);
  const [settings, setSettings] = useState(null);
  const [toasts, setToasts] = useState([]);

  // Estados de Login Seguro (Zero-Trust)
  const [loginForm, setLoginForm] = useState({ userId: '', password: '' });
  const [loggingIn, setLoggingIn] = useState(false);
  const [authError, setAuthError] = useState(null);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoggingIn(true);
    setAuthError(null);
    try {
      const res = await fetch(`/api/portal/${encodeURIComponent(slug)}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: loginForm.userId, password: loginForm.password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Credenciales inválidas.');
      }
      setAdminToken(data.token);
      localStorage.setItem(`subbot_token_${slug}`, data.token);
      addToast('Sesión de Owner iniciada con éxito');
      loadAdminData();
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setLoggingIn(false);
    }
  };

  const addToast = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Inicializar slug, token y view desde URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlSlug = params.get('slug') || params.get('bot') || params.get('c') || defaultSlug;
      const urlToken = params.get('token') || localStorage.getItem(`subbot_token_${urlSlug}`) || '';
      const urlView = params.get('view') || (window.location.pathname.includes('/admin') ? 'admin' : defaultView);

      if (urlSlug) setSlug(urlSlug);
      if (urlToken) {
        setAdminToken(urlToken);
        localStorage.setItem(`subbot_token_${urlSlug}`, urlToken);
      }
      if (urlView) setView(urlView);
    }
  }, [defaultSlug, defaultView]);

  // Carga de datos públicos para la Landing
  const loadPublicData = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/${encodeURIComponent(slug)}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo cargar la información de la comunidad.');
      }
      setPortalData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  // Carga de datos administrativos completos para el Owner del Sub-Bot
  const loadAdminData = useCallback(async () => {
    if (!slug) return;
    try {
      const queryParams = new URLSearchParams();
      if (adminToken) queryParams.set('token', adminToken);
      if (adminKey) queryParams.set('key', adminKey);

      const res = await fetch(`/api/portal/${encodeURIComponent(slug)}/admin/data?${queryParams.toString()}`, {
        headers: {
          'x-admin-key': adminKey,
          'x-auth-token': adminToken,
        },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Acceso administrativo no autorizado.');
      }

      setAdminData(data);
      if (data.stats) setStats(data.stats);
      if (data.staff) setStaff(data.staff);
      if (data.deals) setDeals(data.deals);
      if (data.burned) setBurned(data.burned);
      if (data.groups) setGroups(data.groups);

      const sb = data.subbot || {};
      const cs = sb.custom_settings || {};
      const channelsList = Array.isArray(sb.channels_to_verify) ? sb.channels_to_verify.join('\n') : '';

      setSettings({
        staff_invite_link: cs.staff_invite_link || '',
        channels_to_verify: channelsList,
        groups_folder_link: sb.groups_folder_link || '',
        community_name: sb.community_name || '',
        welcome_message: cs.welcome_message || '',
      });
    } catch (err) {
      console.warn('Error cargando administración de sub-bot:', err.message);
    }
  }, [slug, adminToken, adminKey]);

  useEffect(() => {
    if (slug) {
      loadPublicData();
      if (view === 'admin') {
        loadAdminData();
      }
    }
  }, [slug, view, loadPublicData, loadAdminData]);

  // Helper fetch autenticado para el sub-bot
  const fetchWithSubBotAuth = useCallback(
    async (url, options = {}) => {
      const headers = {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey,
        'x-auth-token': adminToken,
        ...(options.headers || {}),
      };
      const res = await fetch(url, { ...options, headers });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Error en la llamada a ${url}`);
      }
      return data;
    },
    [adminKey, adminToken]
  );

  // ── Handlers de Staff en Sub-Bot ──
  const handleSyncStaff = async (userId) => {
    try {
      const res = await fetchWithSubBotAuth(`/api/portal/${slug}/admin/staff/${userId}/sync`, { method: 'POST' });
      addToast(res.message || 'Staff sincronizado con Telegram');
      loadAdminData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleUpdateStaff = async (userId, data) => {
    try {
      const res = await fetchWithSubBotAuth(`/api/portal/${slug}/admin/staff`, {
        method: 'POST',
        body: JSON.stringify({ userId, ...data }),
      });
      addToast(res.message || 'Staff actualizado');
      loadAdminData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleAddStaff = async (data) => {
    try {
      const res = await fetchWithSubBotAuth(`/api/portal/${slug}/admin/staff`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      addToast(res.message || 'Miembro añadido al Staff');
      loadAdminData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDeleteStaff = async (userId) => {
    if (!confirm(`¿Remover del staff de esta comunidad al usuario #${userId}?`)) return;
    try {
      const res = await fetchWithSubBotAuth(`/api/portal/${slug}/admin/staff/${userId}`, { method: 'DELETE' });
      addToast(res.message || 'Staff removido');
      loadAdminData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  // ── Handlers de Tratos Escrow en Sub-Bot (Para Monetizar) ──
  const handleCreateDeal = async (data) => {
    try {
      const res = await fetchWithSubBotAuth(`/api/portal/${slug}/admin/deals`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      addToast(res.message || 'Trato creado exitosamente');
      loadAdminData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleUpdateDeal = async (id, data) => {
    try {
      const res = await fetchWithSubBotAuth(`/api/portal/${slug}/admin/deals/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      addToast(res.message || 'Trato actualizado');
      loadAdminData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDeleteDeal = async (id) => {
    if (!confirm(`¿Eliminar trato #${id}?`)) return;
    try {
      const res = await fetchWithSubBotAuth(`/api/portal/${slug}/admin/deals/${id}`, { method: 'DELETE' });
      addToast(res.message || 'Trato eliminado');
      loadAdminData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  // ── Handlers de Sanciones / Lista Negra en Sub-Bot ──
  const handleAddBurned = async (data) => {
    try {
      const res = await fetchWithSubBotAuth(`/api/portal/${slug}/admin/gban`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      addToast(res.message || 'Sanción registrada');
      loadAdminData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleRemoveBurned = async (userId) => {
    if (!confirm(`¿Remover sanción del usuario #${userId}?`)) return;
    try {
      const res = await fetchWithSubBotAuth(`/api/portal/${slug}/admin/gban/${userId}`, { method: 'DELETE' });
      addToast(res.message || 'Sanción eliminada');
      loadAdminData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  // ── Handler de Canales & Enlaces ──
  const handleSaveSettings = async (formData) => {
    setSavingSettings(true);
    try {
      const res = await fetchWithSubBotAuth(`/api/portal/${slug}/admin/settings`, {
        method: 'PUT',
        body: JSON.stringify(formData),
      });
      addToast(res.message || 'Ajustes guardados con éxito');
      loadAdminData();
      loadPublicData();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // ════ VISTA 1: LANDING PÚBLICA DE CANALES (ULTRA-PREMIUM) ════
  if (view === 'public') {
    return (
      <PublicChannelsLanding
        portalData={portalData}
        loading={loading}
        error={error}
        onGoToAdmin={() => setView('admin')}
      />
    );
  }

  // ════ VISTA 2: PANEL ENTERPRISE COMPLETO (OWNER DEL SUB-BOT) ════
  const communityDisplayName = portalData?.community_name || 'COMUNIDAD AFILIADA';

  // Si está en vista admin pero aún no ha iniciado sesión válida
  if (!adminData) {
    return (
      <div style={{ minHeight: '100vh', background: '#000000', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ maxWidth: '440px', width: '100%', background: 'rgba(18, 18, 20, 0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '20px', padding: '2.5rem 2rem', boxShadow: '0 25px 50px rgba(0, 0, 0, 0.9)' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.8rem' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: '#18181b', border: '1px solid rgba(255, 255, 255, 0.2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <IconShield size={28} color="#ffffff" />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.4rem 0', color: '#ffffff' }}>{communityDisplayName}</h2>
            <p style={{ fontSize: '0.85rem', color: '#a1a1aa', margin: 0 }}>Autenticación Segura de Owner</p>
          </div>

          {authError && (
            <div style={{ padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#ef4444', fontSize: '0.82rem', marginBottom: '1.2rem', textAlign: 'center' }}>
              {authError}
            </div>
          )}

          <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#d4d4d8', display: 'block', marginBottom: '0.4rem' }}>Tu ID Numérico de Telegram</label>
              <input
                type="text"
                required
                className="input-field"
                style={{ width: '100%', background: '#09090b', borderColor: 'rgba(255, 255, 255, 0.2)', color: '#ffffff' }}
                placeholder="Ej: 7849224682"
                value={loginForm.userId}
                onChange={(e) => setLoginForm({ ...loginForm, userId: e.target.value })}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#d4d4d8', display: 'block', marginBottom: '0.4rem' }}>Contraseña Temporal de Acceso</label>
              <input
                type="password"
                required
                className="input-field"
                style={{ width: '100%', background: '#09090b', borderColor: 'rgba(255, 255, 255, 0.2)', color: '#ffffff' }}
                placeholder="Clave emitida por el bot"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.85rem', background: '#ffffff', color: '#000000', fontWeight: 800, fontSize: '0.95rem' }}
              disabled={loggingIn}
            >
              {loggingIn ? 'Validando Credenciales...' : 'Ingresar al Panel de Control'}
            </button>
          </form>

          <div style={{ marginTop: '1.5rem', padding: '0.9rem', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', fontSize: '0.78rem', color: '#71717a', lineHeight: 1.5 }}>
            💡 <strong>¿No tienes tu contraseña?</strong> Ejecuta <code>/panel</code> en tu grupo o en privado con tu bot para recibir de inmediato tus credenciales por mensaje privado.
          </div>

          <div style={{ marginTop: '1.2rem', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => setView('public')}
              style={{ background: 'none', border: 'none', color: '#a1a1aa', fontSize: '0.82rem', cursor: 'pointer' }}
            >
              ← Volver a la Landing de Canales
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Barra Lateral Adaptativa para Sub-Bot (Sin venta de subbots, con Canales & Enlaces) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSubBot={true}
        communityName={communityDisplayName}
        subtitle="SUB-BOT ENTERPRISE"
      />

      <div className="main-wrapper">
        <header className="top-bar">
          <div className="page-title">
            <h1>{communityDisplayName} — Panel Administrativo</h1>
            <p>Control integral de staff, tratos escrow, seguridad perimetral y canales</p>
          </div>

          <div className="top-actions">
            {onBackToMain && (
              <button className="btn btn-secondary btn-sm" onClick={onBackToMain} title="Volver a Consola Central VLP">
                Volver a VLP
              </button>
            )}

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setView('public')}
              title="Previsualizar Landing de Canales"
            >
              <IconExternalLink size={13} />
              <span>Ver Landing Pública</span>
            </button>

            <input
              type="password"
              placeholder="Clave / Token de Acceso"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              className="input-field"
              style={{ width: '220px' }}
            />

            <button className="btn btn-secondary btn-sm" onClick={loadAdminData}>
              Actualizar Datos
            </button>
          </div>
        </header>

        <main className="content-body">
          {/* Tab 1: Centro de Mando / Stats */}
          {activeTab === 'stats' && (
            <div>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon-wrap cyan">
                    <IconUsers size={22} />
                  </div>
                  <div className="stat-meta">
                    <span className="stat-label">Staff Oficial</span>
                    <div className="stat-value">{stats ? stats.totalStaff : staff.length}</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon-wrap emerald">
                    <IconScale size={22} />
                  </div>
                  <div className="stat-meta">
                    <span className="stat-label">Tratos Activos (Escrow)</span>
                    <div className="stat-value">{stats ? stats.activeDealsCount : deals.length}</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon-wrap rose">
                    <IconAlertTriangle size={22} />
                  </div>
                  <div className="stat-meta">
                    <span className="stat-label">Sanciones / Quemados</span>
                    <div className="stat-value">{stats ? stats.totalBurned : burned.length}</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon-wrap amber">
                    <IconShield size={22} />
                  </div>
                  <div className="stat-meta">
                    <span className="stat-label">Grupos Vinculados</span>
                    <div className="stat-value">{stats ? stats.totalGroups : groups.length}</div>
                  </div>
                </div>
              </div>

              {/* Accesos Rápidos y Telemetría */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
                <div className="panel-card" style={{ padding: '24px' }}>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', marginBottom: '8px' }}>
                    Acciones de Gestión Rápida
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                    Herramientas de configuración operativa de tu comunidad.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button className="btn btn-secondary" onClick={() => setActiveTab('channels')}>
                      Configurar Canales de Verificación & Enlace de Staff
                    </button>
                    <button className="btn btn-secondary" onClick={() => setActiveTab('staff')}>
                      Gestionar Equipo de Staff y Moderadores
                    </button>
                    <button className="btn btn-secondary" onClick={() => setActiveTab('deals')}>
                      Monitorear y Auditar Tratos P2P (Monetización)
                    </button>
                    <button className="btn btn-secondary" onClick={() => setActiveTab('docs')}>
                      Consultar Guía y Catálogo de Comandos
                    </button>
                  </div>
                </div>

                <div className="panel-card" style={{ padding: '24px' }}>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', marginBottom: '8px' }}>
                    Estado Operativo del Sub-Bot
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                    Telemetría del motor de Telegram en tiempo real.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Bot Telegram:</span>
                      <span style={{ fontWeight: 700, color: '#ffffff' }}>{stats?.botUsername ? `@${stats.botUsername.replace(/^@/, '')}` : 'Conectado'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Uptime de la Instancia:</span>
                      <span style={{ fontWeight: 600 }}>{stats ? `${Math.floor(stats.uptimeSeconds / 60)} min` : 'En línea'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Sistema de Mute Preventivo:</span>
                      <span style={{ fontWeight: 700, color: settings?.channels_to_verify ? 'var(--emerald-success)' : 'var(--amber-warning)' }}>
                        {settings?.channels_to_verify ? 'Activado (Exige Canales)' : 'Desactivado (Acceso Libre)'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Aislamiento Multi-Tenant:</span>
                      <span style={{ fontWeight: 600, color: 'var(--cyan-primary)' }}>100% Independiente</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Gestión de Staff */}
          {activeTab === 'staff' && (
            <StaffSection
              staff={staff}
              onSyncStaff={handleSyncStaff}
              onUpdateStaff={handleUpdateStaff}
              onAddStaff={handleAddStaff}
              onDeleteStaff={handleDeleteStaff}
            />
          )}

          {/* Tab 3: Tratos & Escrow (Monetización de la Comunidad) */}
          {activeTab === 'deals' && (
            <DealsSection
              deals={deals}
              staff={staff}
              onUpdateDeal={handleUpdateDeal}
              onCreateDeal={handleCreateDeal}
              onDeleteDeal={handleDeleteDeal}
            />
          )}

          {/* Tab 4: Lista Negra / Sanciones */}
          {activeTab === 'gban' && (
            <GbanSection
              burned={burned}
              onAddBurned={handleAddBurned}
              onUpdateBurned={() => {}}
              onRemoveBurned={handleRemoveBurned}
              onEnforceGban={() => {}}
            />
          )}

          {/* Tab 5: Canales de Verificación & Enlaces Oficiales */}
          {activeTab === 'channels' && (
            <ChannelsVerificationSection
              settings={settings}
              onSaveSettings={handleSaveSettings}
              saving={savingSettings}
              onPreviewLanding={() => setView('public')}
              slug={slug}
              adminToken={adminToken}
              adminKey={adminKey}
            />
          )}

          {/* Tab 6: Grupos & Seguridad */}
          {activeTab === 'groups' && (
            <GroupsSection
              groups={groups}
            />
          )}

          {/* Tab 7: Guía de Comandos & Documentación */}
          {activeTab === 'docs' && (
            <DocsSection />
          )}
        </main>
      </div>

      <Toast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
