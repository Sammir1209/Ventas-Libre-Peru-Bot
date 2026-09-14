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

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('stats');
  const [adminKey, setAdminKey] = useState('vlp_master_key_99x_2026_sec');
  const [stats, setStats] = useState(null);
  const [staff, setStaff] = useState([]);
  const [deals, setDeals] = useState([]);
  const [burned, setBurned] = useState([]);
  const [subbots, setSubbots] = useState([]);
  const [groups, setGroups] = useState([]);
  const [toasts, setToasts] = useState([]);

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
      const [statsRes, staffRes, dealsRes, gbanRes, subbotsRes, groupsRes] = await Promise.allSettled([
        fetchWithAuth('/api/stats'),
        fetchWithAuth('/api/staff'),
        fetchWithAuth('/api/deals'),
        fetchWithAuth('/api/gban'),
        fetchWithAuth('/api/subbots'),
        fetchWithAuth('/api/groups'),
      ]);

      if (statsRes.status === 'fulfilled') setStats(statsRes.value.stats);
      if (staffRes.status === 'fulfilled') setStaff(staffRes.value.staff);
      if (dealsRes.status === 'fulfilled') setDeals(dealsRes.value.deals);
      if (gbanRes.status === 'fulfilled') setBurned(gbanRes.value.burned);
      if (subbotsRes.status === 'fulfilled') setSubbots(subbotsRes.value.subbots);
      if (groupsRes.status === 'fulfilled') setGroups(groupsRes.value.groups);
    } catch (err) {
      console.warn('Carga inicial:', err.message);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

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
      addToast(res.message || `Acción ${action} completada`);
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

  return (
    <div class="app-shell">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <div class="main-wrapper">
        <Header adminKey={adminKey} setAdminKey={setAdminKey} onRefresh={loadAllData} />

        <main class="content-body">
          {/* Tab: Stats Overview */}
          {activeTab === 'stats' && (
            <div>
              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-icon-wrap cyan">👑</div>
                  <div class="stat-meta">
                    <span class="stat-label">Staff Oficial</span>
                    <div class="stat-value">{stats ? stats.totalStaff : staff.length}</div>
                  </div>
                </div>

                <div class="stat-card">
                  <div class="stat-icon-wrap emerald">🤝</div>
                  <div class="stat-meta">
                    <span class="stat-label">Tratos Escrow</span>
                    <div class="stat-value">{stats ? stats.totalDeals : deals.length}</div>
                  </div>
                </div>

                <div class="stat-card">
                  <div class="stat-icon-wrap rose">🚨</div>
                  <div class="stat-meta">
                    <span class="stat-label">Lista Negra (GBan)</span>
                    <div class="stat-value">{stats ? stats.totalBurned : burned.length}</div>
                  </div>
                </div>

                <div class="stat-card">
                  <div class="stat-icon-wrap purple">🤖</div>
                  <div class="stat-meta">
                    <span class="stat-label">Sub-Bots SaaS</span>
                    <div class="stat-value">{subbots.length}</div>
                  </div>
                </div>

                <div class="stat-card">
                  <div class="stat-icon-wrap amber">🛡️</div>
                  <div class="stat-meta">
                    <span class="stat-label">Grupos Oficiales</span>
                    <div class="stat-value">{stats ? stats.totalGroups : groups.length}</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
                <div class="panel-card" style={{ padding: '24px' }}>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', marginBottom: '8px' }}>
                    ⟡ Accesos Rápidos
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                    Administra rápidamente las funciones críticas de la red oficial.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button class="btn btn-secondary" onClick={() => setActiveTab('staff')}>
                      👑 Gestionar y Sincronizar Staff
                    </button>
                    <button class="btn btn-secondary" onClick={() => setActiveTab('deals')}>
                      🤝 Asignar y Reasignar Tratos Admin
                    </button>
                    <button class="btn btn-secondary" onClick={() => setActiveTab('gban')}>
                      🚨 Registrar o Consultar Lista Negra
                    </button>
                    <button class="btn btn-secondary" onClick={() => setActiveTab('subbots')}>
                      🤖 Monitor de Instancias Sub-Bots
                    </button>
                  </div>
                </div>

                <div class="panel-card" style={{ padding: '24px' }}>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', marginBottom: '8px' }}>
                    ⚡ Telemetría del Sistema
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
                      <span style={{ fontWeight: 600, color: 'var(--purple-royal)' }}>Multi-TenantgrammY</span>
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
            />
          )}
        </main>
      </div>

      <Toast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
