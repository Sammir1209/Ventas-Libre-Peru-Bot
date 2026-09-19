'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/common/Sidebar';
import Header from '../components/common/Header';
import Toast from '../components/common/Toast';
import StaffSection from '../components/staff/StaffSection';
import DealsSection from '../components/deals/DealsSection';
import GbanSection from '../components/gban/GbanSection';
import SubBotsSection from '../components/subbots/SubBotsSection';
import GroupsSection from '../components/groups/GroupsSection';
import ChannelsVerificationSection from '../components/portal/ChannelsVerificationSection';
import LandingPage from '../components/landing/LandingPage';
import SubBotPortal from '../components/portal/SubBotPortal';
import DocsSection from '../components/docs/DocsSection';
import {
  IconUsers,
  IconScale,
  IconAlertTriangle,
  IconBot,
  IconShield,
  IconExternalLink,
} from '../components/common/Icons';

export default function DashboardPage() {
  const [viewMode, setViewMode] = useState('landing'); // 'landing' | 'admin'
  const [activeTab, setActiveTab] = useState('stats');
  const [adminKey, setAdminKey] = useState('vlp_master_key_99x_2026_sec');
  const [stats, setStats] = useState(null);
  const [staff, setStaff] = useState([]);
  const [deals, setDeals] = useState([]);
  const [burned, setBurned] = useState([]);
  const [subbots, setSubbots] = useState([]);
  const [groups, setGroups] = useState([]);
  const [channelSettings, setChannelSettings] = useState(null);
  const [savingChannels, setSavingChannels] = useState(false);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.has('slug') || params.has('bot') || window.location.pathname.startsWith('/portal')) {
        setViewMode('portal');
      } else if (window.location.hash.includes('admin') || window.location.pathname.includes('portal')) {
        setViewMode('admin');
      }
    }
  }, []);

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

  const fetchWithAuth = useCallback(async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      'x-admin-key': adminKey,
      ...(options.headers || {}),
    };
    const res = await fetch(url, { ...options, headers });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || `Error en llamada a ${url}`);
    }
    return data;
  }, [adminKey]);

  const loadAllData = useCallback(async () => {
    try {
      const [statsRes, staffRes, dealsRes, gbanRes, subbotsRes, groupsRes, channelsRes] = await Promise.allSettled([
        fetchWithAuth('/api/stats'),
        fetchWithAuth('/api/staff'),
        fetchWithAuth('/api/deals'),
        fetchWithAuth('/api/gban'),
        fetchWithAuth('/api/subbots'),
        fetchWithAuth('/api/groups'),
        fetchWithAuth('/api/channels'),
      ]);

      if (statsRes.status === 'fulfilled') setStats(statsRes.value.stats);
      if (staffRes.status === 'fulfilled') setStaff(staffRes.value.staff);
      if (dealsRes.status === 'fulfilled') setDeals(dealsRes.value.deals);
      if (gbanRes.status === 'fulfilled') setBurned(gbanRes.value.burned);
      if (subbotsRes.status === 'fulfilled') setSubbots(subbotsRes.value.subbots);
      if (groupsRes.status === 'fulfilled') setGroups(groupsRes.value.groups);
      if (channelsRes.status === 'fulfilled') setChannelSettings(channelsRes.value.settings);
    } catch (err) {
      console.warn('Carga inicial:', err.message);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // ── Channels Handlers ──
  const handleSaveChannels = async (formData) => {
    setSavingChannels(true);
    try {
      const res = await fetchWithAuth('/api/channels', {
        method: 'PUT',
        body: JSON.stringify(formData),
      });
      addToast(res.message || 'Canales y enlaces guardados exitosamente');
      setChannelSettings(formData);
      loadAllData();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSavingChannels(false);
    }
  };

  // ── Staff Handlers ──
  const handleSyncStaff = async (userId) => {
    try {
      const res = await fetchWithAuth(`/api/staff/${userId}/sync`, { method: 'POST' });
      addToast(res.message || 'Staff sincronizado con Telegram');
      loadAllData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleUpdateStaff = async (userId, data) => {
    try {
      const res = await fetchWithAuth(`/api/staff/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      addToast(res.message || 'Staff actualizado');
      loadAllData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleAddStaff = async (data) => {
    try {
      const res = await fetchWithAuth('/api/staff', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      addToast(res.message || 'Staff agregado');
      loadAllData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDeleteStaff = async (userId) => {
    if (!confirm(`¿Estás seguro de remover al staff #${userId}?`)) return;
    try {
      const res = await fetchWithAuth(`/api/staff/${userId}`, { method: 'DELETE' });
      addToast(res.message || 'Staff removido');
      loadAllData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  // ── Deals Handlers ──
  const handleUpdateDeal = async (id, data) => {
    try {
      const res = await fetchWithAuth(`/api/deals/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      addToast(res.message || 'Trato actualizado');
      loadAllData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleCreateDeal = async (data) => {
    try {
      const res = await fetchWithAuth('/api/deals', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      addToast(res.message || 'Trato creado');
      loadAllData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDeleteDeal = async (id) => {
    if (!confirm(`¿Eliminar trato #${id}?`)) return;
    try {
      const res = await fetchWithAuth(`/api/deals/${id}`, { method: 'DELETE' });
      addToast(res.message || 'Trato eliminado');
      loadAllData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  // ── GBan Handlers ──
  const handleAddBurned = async (data) => {
    try {
      const res = await fetchWithAuth('/api/gban', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      addToast(res.message || 'GBan registrado');
      loadAllData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleUpdateBurned = async (userId, data) => {
    try {
      const res = await fetchWithAuth(`/api/gban/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      addToast(res.message || 'GBan actualizado');
      loadAllData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleRemoveBurned = async (userId) => {
    if (!confirm(`¿Remover de la lista negra al usuario #${userId}?`)) return;
    try {
      const res = await fetchWithAuth(`/api/gban/${userId}`, { method: 'DELETE' });
      addToast(res.message || 'Usuario desbaneado');
      loadAllData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleEnforceGban = async (userId) => {
    try {
      const res = await fetchWithAuth(`/api/gban/${userId}/enforce`, { method: 'POST' });
      addToast(res.message || 'Expulsión ejecutada en grupos');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  // ── Sub-Bots Handlers ──
  const handleCreateSubBot = async (data) => {
    try {
      const res = await fetchWithAuth('/api/subbots', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      addToast(res.message || 'Sub-bot creado e iniciado');
      loadAllData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleUpdateSubBot = async (id, data) => {
    try {
      const res = await fetchWithAuth(`/api/subbots/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      addToast(res.message || 'Sub-bot configurado');
      loadAllData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleExecuteAction = async (id, action) => {
    try {
      const res = await fetchWithAuth(`/api/subbots/${id}/action`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      addToast(res.message || `Acción '${action}' completada`);
      loadAllData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDeleteSubBot = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este sub-bot?')) return;
    try {
      const res = await fetchWithAuth(`/api/subbots/${id}`, { method: 'DELETE' });
      addToast(res.message || 'Sub-bot eliminado');
      loadAllData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  // ── Groups & Channels Handlers ──
  const handleAddGroup = async (data) => {
    try {
      const res = await fetchWithAuth('/api/groups', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      addToast(res.message || 'Canal o grupo vinculado con éxito');
      loadAllData();
    } catch (err) {
      addToast(err.message, 'error');
      throw err;
    }
  };

  const handleRemoveGroup = async (chatId, title) => {
    try {
      const res = await fetchWithAuth(`/api/groups/${chatId}`, {
        method: 'DELETE',
      });
      addToast(res.message || `Canal o grupo desvinculado`);
      loadAllData();
    } catch (err) {
      addToast(err.message, 'error');
      throw err;
    }
  };

  const handleReverifyGroup = async (chatId, mode) => {
    try {
      const res = await fetchWithAuth(`/api/groups/${chatId}/reverify`, {
        method: 'POST',
        body: JSON.stringify({ mode }),
      });
      addToast(res.message || 'Auditoría de miembros actualizada');
      loadAllData();
    } catch (err) {
      addToast(err.message, 'error');
      throw err;
    }
  };

  // Si está en modo Portal de Sub-Bot (Público de Canales o Admin B&W)
  if (viewMode === 'portal') {
    return <SubBotPortal onBackToMain={() => setViewMode('landing')} />;
  }

  // Si está en modo Landing Page pública
  if (viewMode === 'landing') {
    return <LandingPage onGoToAdmin={() => setViewMode('admin')} stats={stats} />;
  }

  return (
    <div className="app-shell">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="main-wrapper">
        <header className="top-bar">
          <div className="page-title">
            <h1>Ventas Libres Perú — Consola Central</h1>
            <p>Control operativo de seguridad, mediaciones y ecosistema de bots</p>
          </div>

          <div className="top-actions">
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setViewMode('landing')}
              title="Volver a la vista pública"
            >
              <IconExternalLink size={13} />
              <span>Ver Landing Pública</span>
            </button>
            <input
              type="password"
              placeholder="Clave de Administrador"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              className="input-field"
              style={{ width: '220px' }}
            />
            <button className="btn btn-secondary btn-sm" onClick={loadAllData}>
              Actualizar Datos
            </button>
          </div>
        </header>

        <main className="content-body">
          {/* Tab: Stats Overview */}
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
                    <span className="stat-label">Tratos Escrow</span>
                    <div className="stat-value">{stats ? stats.totalDeals : deals.length}</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon-wrap rose">
                    <IconAlertTriangle size={22} />
                  </div>
                  <div className="stat-meta">
                    <span className="stat-label">Lista Negra (GBan)</span>
                    <div className="stat-value">{stats ? stats.totalBurned : burned.length}</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon-wrap purple">
                    <IconBot size={22} />
                  </div>
                  <div className="stat-meta">
                    <span className="stat-label">Sub-Bots SaaS</span>
                    <div className="stat-value">{subbots.length}</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon-wrap amber">
                    <IconShield size={22} />
                  </div>
                  <div className="stat-meta">
                    <span className="stat-label">Grupos Oficiales</span>
                    <div className="stat-value">{stats ? stats.totalGroups : groups.length}</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
                <div className="panel-card" style={{ padding: '24px' }}>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', marginBottom: '8px' }}>
                    ⟡ Accesos Rápidos
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                    Administra rápidamente las funciones críticas de la red oficial.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button className="btn btn-secondary" onClick={() => setActiveTab('channels')}>
                      Configurar Canales de Verificación & Enlaces
                    </button>
                    <button className="btn btn-secondary" onClick={() => setActiveTab('groups')}>
                      Grupos Oficiales & Protocolos de Seguridad
                    </button>
                    <button className="btn btn-secondary" onClick={() => setActiveTab('staff')}>
                      Gestionar y Sincronizar Staff
                    </button>
                    <button className="btn btn-secondary" onClick={() => setActiveTab('deals')}>
                      Asignar y Reasignar Tratos Admin
                    </button>
                    <button className="btn btn-secondary" onClick={() => setActiveTab('gban')}>
                      Registrar o Consultar Lista Negra
                    </button>
                    <button className="btn btn-secondary" onClick={() => setActiveTab('subbots')}>
                      Monitor de Instancias Sub-Bots
                    </button>
                  </div>
                </div>

                <div className="panel-card" style={{ padding: '24px' }}>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', marginBottom: '8px' }}>
                    Telemetría del Sistema
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                    Métricas de salud del servidor y del bot en vivo.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Uptime:</span>
                      <span style={{ fontWeight: 600 }}>{stats ? `${Math.floor(stats.uptimeSeconds / 60)} min` : 'En línea'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Consumo de RAM Heap:</span>
                      <span style={{ fontWeight: 600, color: 'var(--cyan-primary)' }}>{stats ? `${stats.memoryUsageMb} MB / 512 MB` : 'Normal'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Tratos Activos:</span>
                      <span style={{ fontWeight: 600, color: 'var(--emerald-success)' }}>{stats ? stats.activeDealsCount : 0}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Modo Motor:</span>
                      <span style={{ fontWeight: 600, color: 'var(--purple-royal)' }}>Multi-Tenant grammY</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Staff */}
          {activeTab === 'staff' && (
            <StaffSection
              staff={staff}
              onSyncStaff={handleSyncStaff}
              onUpdateStaff={handleUpdateStaff}
              onAddStaff={handleAddStaff}
              onDeleteStaff={handleDeleteStaff}
            />
          )}

          {/* Tab: Deals */}
          {activeTab === 'deals' && (
            <DealsSection
              deals={deals}
              staff={staff}
              onUpdateDeal={handleUpdateDeal}
              onCreateDeal={handleCreateDeal}
              onDeleteDeal={handleDeleteDeal}
            />
          )}

          {/* Tab: GBan */}
          {activeTab === 'gban' && (
            <GbanSection
              burned={burned}
              onAddBurned={handleAddBurned}
              onUpdateBurned={handleUpdateBurned}
              onRemoveBurned={handleRemoveBurned}
              onEnforceGban={handleEnforceGban}
            />
          )}

          {/* Tab: Channels & Verification Links */}
          {activeTab === 'channels' && (
            <ChannelsVerificationSection
              settings={channelSettings}
              onSaveSettings={handleSaveChannels}
              saving={savingChannels}
              onPreviewLanding={() => setViewMode('landing')}
              slug=""
              adminKey={adminKey}
              isMaster={true}
            />
          )}

          {/* Tab: SubBots */}
          {activeTab === 'subbots' && (
            <SubBotsSection
              subbots={subbots}
              onCreateSubBot={handleCreateSubBot}
              onUpdateSubBot={handleUpdateSubBot}
              onExecuteAction={handleExecuteAction}
              onDeleteSubBot={handleDeleteSubBot}
            />
          )}

          {/* Tab: Groups */}
          {activeTab === 'groups' && (
            <GroupsSection
              groups={groups}
              onAddGroup={handleAddGroup}
              onRemoveGroup={handleRemoveGroup}
              onReverifyGroup={handleReverifyGroup}
            />
          )}

          {/* Tab: Docs & Comandos */}
          {activeTab === 'docs' && (
            <DocsSection />
          )}
        </main>
      </div>

      <Toast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
