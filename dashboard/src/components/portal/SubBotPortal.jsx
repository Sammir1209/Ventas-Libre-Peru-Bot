'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  IconBot,
  IconShield,
  IconUsers,
  IconArrowRight,
  IconExternalLink,
  IconTrash,
  IconEdit,
  IconCheck,
  IconLock,
  IconRefresh,
} from '../common/Icons';

export default function SubBotPortal({ defaultSlug = '', defaultView = 'public' }) {
  const [slug, setSlug] = useState(defaultSlug);
  const [view, setView] = useState(defaultView); // 'public' | 'admin'
  const [adminTab, setAdminTab] = useState('staff'); // 'staff' | 'enlaces' | 'ajustes'
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [portalData, setPortalData] = useState(null);
  const [adminData, setAdminData] = useState(null);

  // Form states for Admin
  const [settingsForm, setSettingsForm] = useState({
    staff_invite_link: '',
    channels_to_verify: '',
    groups_folder_link: '',
    community_name: '',
    welcome_message: '',
  });

  const [newStaff, setNewStaff] = useState({
    userId: '',
    role: 'ADMIN',
    customTitle: '',
  });

  const [savingSettings, setSavingSettings] = useState(false);
  const [addingStaff, setAddingStaff] = useState(false);
  const [notification, setNotification] = useState(null);

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Initialize slug and token from window location
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlSlug = params.get('slug') || params.get('bot') || params.get('c') || defaultSlug;
      const urlToken = params.get('token') || localStorage.getItem(`subbot_token_${urlSlug}`) || '';
      const urlView = params.get('view') || (window.location.pathname.includes('/admin') ? 'admin' : defaultView);

      if (urlSlug) setSlug(urlSlug);
      if (urlToken) {
        setToken(urlToken);
        localStorage.setItem(`subbot_token_${urlSlug}`, urlToken);
      }
      if (urlView) setView(urlView);
    }
  }, [defaultSlug, defaultView]);

  // Load public data
  const loadPublicData = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/${encodeURIComponent(slug)}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo cargar la información de la comunidad');
      }
      setPortalData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  // Load admin data
  const loadAdminData = useCallback(async () => {
    if (!slug) return;
    try {
      const res = await fetch(`/api/portal/${encodeURIComponent(slug)}/admin/data?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Acceso de administración denegado.');
      }
      setAdminData(data);
      const sb = data.subbot || {};
      const cs = sb.custom_settings || {};
      const channelsList = Array.isArray(sb.channels_to_verify) ? sb.channels_to_verify.join('\n') : '';

      setSettingsForm({
        staff_invite_link: cs.staff_invite_link || '',
        channels_to_verify: channelsList,
        groups_folder_link: sb.groups_folder_link || '',
        community_name: sb.community_name || '',
        welcome_message: cs.welcome_message || '',
      });
    } catch (err) {
      console.warn('Error cargando admin data:', err.message);
    }
  }, [slug, token]);

  useEffect(() => {
    if (slug) {
      loadPublicData();
      if (view === 'admin') {
        loadAdminData();
      }
    }
  }, [slug, view, loadPublicData, loadAdminData]);

  // Save Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const channels = settingsForm.channels_to_verify
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch(`/api/portal/${encodeURIComponent(slug)}/admin/settings?token=${encodeURIComponent(token)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_invite_link: settingsForm.staff_invite_link.trim() || null,
          channels_to_verify: channels,
          groups_folder_link: settingsForm.groups_folder_link.trim() || null,
          community_name: settingsForm.community_name.trim() || undefined,
          welcome_message: settingsForm.welcome_message.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Error al guardar ajustes');

      showNotification('✓ Ajustes y enlaces de la comunidad actualizados');
      loadPublicData();
      loadAdminData();
    } catch (err) {
      showNotification(`✗ Error: ${err.message}`, 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // Add Staff Member
  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!newStaff.userId.trim()) return;
    setAddingStaff(true);
    try {
      const res = await fetch(`/api/portal/${encodeURIComponent(slug)}/admin/staff?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: newStaff.userId.trim(),
          role: newStaff.role,
          customTitle: newStaff.customTitle.trim() || newStaff.role,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Error al agregar staff');

      showNotification('✓ Miembro añadido al Staff de la comunidad');
      setNewStaff({ userId: '', role: 'ADMIN', customTitle: '' });
      loadAdminData();
    } catch (err) {
      showNotification(`✗ Error: ${err.message}`, 'error');
    } finally {
      setAddingStaff(false);
    }
  };

  // Remove Staff Member
  const handleRemoveStaff = async (userId) => {
    if (!confirm(`¿Deseas remover al miembro #${userId} del Staff?`)) return;
    try {
      const res = await fetch(`/api/portal/${encodeURIComponent(slug)}/admin/staff/${userId}?token=${encodeURIComponent(token)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Error al remover staff');

      showNotification('✓ Miembro removido del Staff');
      loadAdminData();
    } catch (err) {
      showNotification(`✗ Error: ${err.message}`, 'error');
    }
  };

  return (
    <div className="subbot-bw-portal">
      <style jsx global>{`
        .subbot-bw-portal {
          --bw-bg: #000000;
          --bw-surface: #0a0a0c;
          --bw-card: rgba(14, 14, 16, 0.9);
          --bw-border: rgba(255, 255, 255, 0.12);
          --bw-border-hover: rgba(255, 255, 255, 0.35);
          --bw-text: #ffffff;
          --bw-muted: #a1a1aa;
          --bw-dim: #71717a;

          min-height: 100vh;
          background: #000000;
          color: #ffffff;
          font-family: 'Inter', -apple-system, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 2.5rem 1rem 4rem;
          background-image:
            radial-gradient(circle at 50% -80px, rgba(255, 255, 255, 0.08) 0%, transparent 60%),
            radial-gradient(circle at 10% 90%, rgba(255, 255, 255, 0.02) 0%, transparent 40%),
            radial-gradient(circle at 90% 90%, rgba(255, 255, 255, 0.02) 0%, transparent 40%);
        }

        .portal-container {
          width: 100%;
          max-width: 680px;
          display: flex;
          flex-direction: column;
          gap: 1.8rem;
          z-index: 10;
        }

        .bw-header {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.9rem;
        }

        .bw-live-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.35rem 0.9rem;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--bw-border);
          font-size: 0.78rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #ffffff;
        }

        .bw-pulse {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ffffff;
          box-shadow: 0 0 10px #ffffff;
        }

        .bw-logo-icon {
          width: 76px;
          height: 76px;
          border-radius: 20px;
          background: linear-gradient(135deg, #1c1c20 0%, #0c0c0e 100%);
          border: 1px solid rgba(255, 255, 255, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.9);
        }

        .bw-title {
          font-family: 'Outfit', sans-serif;
          font-size: 2.2rem;
          font-weight: 900;
          letter-spacing: -0.02em;
          color: #ffffff;
          margin: 0;
        }

        .bw-desc {
          font-size: 0.92rem;
          color: var(--bw-muted);
          line-height: 1.55;
          max-width: 520px;
          margin: 0;
        }

        .bw-nav-bar {
          display: flex;
          justify-content: center;
          gap: 0.4rem;
          background: rgba(255, 255, 255, 0.04);
          padding: 0.3rem;
          border-radius: 9999px;
          border: 1px solid var(--bw-border);
        }

        .bw-nav-btn {
          padding: 0.5rem 1.25rem;
          font-size: 0.82rem;
          font-weight: 700;
          border-radius: 9999px;
          cursor: pointer;
          color: var(--bw-muted);
          background: transparent;
          border: none;
          transition: all 0.2s;
        }

        .bw-nav-btn.active {
          color: #000000;
          background: #ffffff;
          box-shadow: 0 2px 10px rgba(255, 255, 255, 0.2);
        }

        .bw-card {
          background: var(--bw-card);
          border: 1px solid var(--bw-border);
          border-radius: 20px;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.2rem;
          backdrop-filter: blur(16px);
          box-shadow: 0 10px 35px rgba(0, 0, 0, 0.7);
        }

        .bw-card-title {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          font-family: 'Outfit', sans-serif;
          font-weight: 700;
          font-size: 1rem;
          color: #ffffff;
        }

        .bw-channel-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.2rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--bw-border);
          border-radius: 14px;
          text-decoration: none;
          color: inherit;
          transition: all 0.2s ease;
        }

        .bw-channel-card:hover {
          background: rgba(255, 255, 255, 0.07);
          border-color: var(--bw-border-hover);
          transform: translateY(-2px);
        }

        .bw-btn-white {
          background: #ffffff;
          color: #000000;
          font-weight: 800;
          padding: 0.55rem 1.2rem;
          border-radius: 9999px;
          border: none;
          font-size: 0.82rem;
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.2s;
        }

        .bw-btn-white:hover {
          background: #e4e4e7;
          transform: scale(1.03);
        }

        .bw-input {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--bw-border);
          border-radius: 10px;
          padding: 0.75rem 1rem;
          color: #ffffff;
          font-size: 0.9rem;
          outline: none;
          width: 100%;
          transition: all 0.2s;
        }

        .bw-input:focus {
          border-color: rgba(255, 255, 255, 0.4);
          background: rgba(255, 255, 255, 0.06);
        }

        .bw-label {
          font-size: 0.78rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--bw-muted);
          margin-bottom: 0.3rem;
          display: block;
        }

        .bw-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
        }

        .bw-table th {
          text-align: left;
          padding: 0.6rem 0.8rem;
          color: var(--bw-dim);
          font-weight: 700;
          border-bottom: 1px solid var(--bw-border);
        }

        .bw-table td {
          padding: 0.8rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .bw-badge {
          display: inline-block;
          padding: 0.2rem 0.6rem;
          border-radius: 9999px;
          font-size: 0.72rem;
          font-weight: 800;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #ffffff;
        }

        .bw-btn-danger {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #f87171;
          padding: 0.35rem 0.7rem;
          border-radius: 8px;
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
        }

        .bw-btn-danger:hover {
          background: #ef4444;
          color: #ffffff;
        }
      `}</style>

      <div className="portal-container">
        {notification && (
          <div
            style={{
              padding: '0.8rem 1.2rem',
              borderRadius: '12px',
              fontSize: '0.85rem',
              fontWeight: 600,
              background: notification.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.1)',
              border: `1px solid ${notification.type === 'error' ? '#ef4444' : '#ffffff'}`,
              color: '#ffffff',
              textAlign: 'center',
            }}
          >
            {notification.msg}
          </div>
        )}

        {/* ── Header Monocromático ── */}
        <header className="bw-header">
          <div className="bw-live-badge">
            <span className="bw-pulse"></span>
            <span>{portalData?.bot_username ? `@${portalData.bot_username.replace(/^@/, '')}` : 'Comunidad Oficial'}</span>
          </div>

          <div className="bw-logo-icon">
            <IconBot size={38} color="#ffffff" />
          </div>

          <h1 className="bw-title">{portalData?.community_name || 'Comunidad Afiliada'}</h1>
          <p className="bw-desc">
            {portalData?.welcome_message ||
              'Por normativas de seguridad y control perimetral, debes ingresar a los canales oficiales para habilitar tus permisos de escritura en el grupo.'}
          </p>
        </header>

        {/* ── Barra de Navegación ── */}
        <div className="bw-nav-bar">
          <button className={`bw-nav-btn ${view === 'public' ? 'active' : ''}`} onClick={() => setView('public')}>
            ACCESO PÚBLICO
          </button>
          <button className={`bw-nav-btn ${view === 'admin' ? 'active' : ''}`} onClick={() => setView('admin')}>
            ADMINISTRACIÓN STAFF
          </button>
        </div>

        {/* ════ VISTA 1: PÚBLICA (CANALES OBLIGATORIOS) ════ */}
        {view === 'public' && (
          <>
            {/* Instrucciones */}
            <div className="bw-card">
              <div className="bw-card-title">
                <IconShield size={18} color="#ffffff" />
                <span>Instrucciones de Desbloqueo</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.88rem', color: 'var(--bw-muted)' }}>
                <div style={{ display: 'flex', gap: '0.7rem' }}>
                  <span style={{ fontWeight: 800, color: '#ffffff' }}>1.</span>
                  <div>
                    Únete a los <strong>canales oficiales obligatorios</strong> listados aquí abajo.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.7rem' }}>
                  <span style={{ fontWeight: 800, color: '#ffffff' }}>2.</span>
                  <div>Regresa al chat grupal de Telegram de la comunidad.</div>
                </div>
                <div style={{ display: 'flex', gap: '0.7rem' }}>
                  <span style={{ fontWeight: 800, color: '#ffffff' }}>3.</span>
                  <div>
                    Pulsa el botón <strong>[ VERIFICAR ]</strong> en el mensaje del Bot para quitar el silencio de inmediato.
                  </div>
                </div>
              </div>
            </div>

            {/* Listado de Canales */}
            <div className="bw-card">
              <div className="bw-card-title">
                <IconUsers size={18} color="#ffffff" />
                <span>Canales Oficiales Obligatorios</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--bw-dim)' }}>Cargando canales...</div>
                ) : error ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: '#f87171' }}>{error}</div>
                ) : !portalData?.channels || portalData.channels.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--bw-muted)', fontSize: '0.9rem' }}>
                    ✓ No hay canales obligatorios pendientes para verificar en este momento.
                  </div>
                ) : (
                  portalData.channels.map((ch, idx) => (
                    <a key={idx} href={ch.url} target="_blank" rel="noreferrer" className="bw-channel-card">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: '#18181b',
                            border: '1px solid var(--bw-border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            color: '#ffffff',
                          }}
                        >
                          {idx + 1}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>{ch.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--bw-dim)' }}>Canal Oficial Requerido</div>
                        </div>
                      </div>
                      <button className="bw-btn-white" type="button">
                        <span>Unirme</span>
                        <IconArrowRight size={14} />
                      </button>
                    </a>
                  ))
                )}

                {/* Carpeta Oficial */}
                {portalData?.groups_folder_link && (
                  <a href={portalData.groups_folder_link} target="_blank" rel="noreferrer" className="bw-channel-card" style={{ borderColor: 'rgba(255, 255, 255, 0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          background: '#18181b',
                          border: '1px solid rgba(255,255,255,0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.2rem',
                        }}
                      >
                        📁
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>Carpeta Oficial de Grupos</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--bw-dim)' }}>Añade todos los grupos oficiales a tu Telegram</div>
                      </div>
                    </div>
                    <button className="bw-btn-white" type="button">
                      <span>Abrir Carpeta</span>
                    </button>
                  </a>
                )}
              </div>
            </div>

            {/* Botón Volver a Telegram */}
            <a
              href={portalData?.bot_username ? `https://t.me/${portalData.bot_username.replace(/^@/, '')}` : 'https://t.me'}
              target="_blank"
              rel="noreferrer"
              className="bw-btn-white"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '1rem',
                fontSize: '0.95rem',
                boxShadow: '0 4px 20px rgba(255, 255, 255, 0.2)',
              }}
            >
              <span>Abrir Bot en Telegram</span>
              <IconArrowRight size={16} />
            </a>
          </>
        )}

        {/* ════ VISTA 2: ADMINISTRACIÓN (OWNER DEL SUB-BOT) ════ */}
        {view === 'admin' && (
          <>
            {/* Sub-Tabs de Administración */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--bw-border)', paddingBottom: '0.5rem' }}>
              <button
                className={`bw-nav-btn ${adminTab === 'staff' ? 'active' : ''}`}
                style={{ padding: '0.4rem 1rem' }}
                onClick={() => setAdminTab('staff')}
              >
                Equipo de Staff
              </button>
              <button
                className={`bw-nav-btn ${adminTab === 'enlaces' ? 'active' : ''}`}
                style={{ padding: '0.4rem 1rem' }}
                onClick={() => setAdminTab('enlaces')}
              >
                Canales & Enlaces
              </button>
              <button
                className={`bw-nav-btn ${adminTab === 'ajustes' ? 'active' : ''}`}
                style={{ padding: '0.4rem 1rem' }}
                onClick={() => setAdminTab('ajustes')}
              >
                Ajustes Generales
              </button>
            </div>

            {/* Tab Admin 1: Staff */}
            {adminTab === 'staff' && (
              <div className="bw-card">
                <div className="bw-card-title">
                  <IconUsers size={18} color="#ffffff" />
                  <span>Equipo de Staff Oficial ({adminData?.staff?.length || 0})</span>
                </div>

                <table className="bw-table">
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Jerarquía</th>
                      <th>Tag en Grupos</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!adminData?.staff || adminData.staff.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--bw-dim)', padding: '1.5rem' }}>
                          No hay miembros registrados en el staff de este sub-bot.
                        </td>
                      </tr>
                    ) : (
                      adminData.staff.map((s) => (
                        <tr key={s.user_id}>
                          <td>
                            <strong>{s.username ? `@${s.username}` : (s.first_name || s.user_id)}</strong>
                            <br />
                            <small style={{ color: 'var(--bw-dim)' }}>{s.user_id}</small>
                          </td>
                          <td>
                            <span className="bw-badge">{s.role}</span>
                          </td>
                          <td>
                            <code style={{ fontSize: '0.8rem', color: '#ffffff' }}>{s.custom_title || 'Staff'}</code>
                          </td>
                          <td>
                            <button className="bw-btn-danger" onClick={() => handleRemoveStaff(s.user_id)}>
                              Quitar
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Formulario Añadir Staff */}
                <form onSubmit={handleAddStaff} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--bw-border)' }}>
                  <span className="bw-label" style={{ fontSize: '0.85rem' }}>+ Añadir Miembro al Staff</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.6rem' }}>
                    <input
                      type="text"
                      className="bw-input"
                      placeholder="ID Numérico o @username *"
                      required
                      value={newStaff.userId}
                      onChange={(e) => setNewStaff({ ...newStaff, userId: e.target.value })}
                    />
                    <select
                      className="bw-input"
                      value={newStaff.role}
                      onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="CO-OWNER">CO-OWNER</option>
                      <option value="TRATO ADMIN">TRATO ADMIN</option>
                      <option value="OWNER">OWNER</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    className="bw-input"
                    placeholder="Tag Oficial en Grupos (Ej: Staff Oficial o Mediador)"
                    value={newStaff.customTitle}
                    onChange={(e) => setNewStaff({ ...newStaff, customTitle: e.target.value })}
                  />
                  <button type="submit" className="bw-btn-white" style={{ justifyContent: 'center', padding: '0.75rem' }} disabled={addingStaff}>
                    {addingStaff ? 'Registrando...' : 'Registrar en Staff'}
                  </button>
                </form>
              </div>
            )}

            {/* Tab Admin 2: Canales & Enlaces */}
            {adminTab === 'enlaces' && (
              <form onSubmit={handleSaveSettings} className="bw-card">
                <div className="bw-card-title">
                  <IconShield size={18} color="#ffffff" />
                  <span>Configuración de Enlaces y Canales</span>
                </div>

                <div>
                  <label className="bw-label">Enlace de Invitación al Grupo de Staff (Telegram)</label>
                  <input
                    type="url"
                    className="bw-input"
                    placeholder="https://t.me/+IEooR3P..."
                    value={settingsForm.staff_invite_link}
                    onChange={(e) => setSettingsForm({ ...settingsForm, staff_invite_link: e.target.value })}
                  />
                  <small style={{ fontSize: '0.75rem', color: 'var(--bw-dim)' }}>
                    Este es el enlace que se le envía en mensaje privado al nuevo miembro cuando el Owner use /promote.
                  </small>
                </div>

                <div>
                  <label className="bw-label">Canales Obligatorios de Verificación</label>
                  <textarea
                    className="bw-input"
                    rows={4}
                    placeholder="@canal1&#10;@canal2&#10;https://t.me/canal3"
                    value={settingsForm.channels_to_verify}
                    onChange={(e) => setSettingsForm({ ...settingsForm, channels_to_verify: e.target.value })}
                  />
                  <small style={{ fontSize: '0.75rem', color: 'var(--bw-dim)' }}>
                    Un canal por línea. <strong>Importante:</strong> Si dejas este campo vacío, el bot NO muteará a los usuarios nuevos.
                  </small>
                </div>

                <div>
                  <label className="bw-label">Enlace de Carpeta Oficial de Grupos (Folder Link)</label>
                  <input
                    type="url"
                    className="bw-input"
                    placeholder="https://t.me/addlist/..."
                    value={settingsForm.groups_folder_link}
                    onChange={(e) => setSettingsForm({ ...settingsForm, groups_folder_link: e.target.value })}
                  />
                </div>

                <button type="submit" className="bw-btn-white" style={{ width: '100%', justifyContent: 'center', padding: '0.85rem' }} disabled={savingSettings}>
                  {savingSettings ? 'Guardando...' : 'Guardar Enlaces'}
                </button>
              </form>
            )}

            {/* Tab Admin 3: Ajustes Generales */}
            {adminTab === 'ajustes' && (
              <form onSubmit={handleSaveSettings} className="bw-card">
                <div className="bw-card-title">
                  <IconBot size={18} color="#ffffff" />
                  <span>Ajustes Generales de la Comunidad</span>
                </div>

                <div>
                  <label className="bw-label">Nombre de la Comunidad</label>
                  <input
                    type="text"
                    className="bw-input"
                    value={settingsForm.community_name}
                    onChange={(e) => setSettingsForm({ ...settingsForm, community_name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="bw-label">Mensaje de Bienvenida / Aviso de Verificación</label>
                  <textarea
                    className="bw-input"
                    rows={3}
                    value={settingsForm.welcome_message}
                    onChange={(e) => setSettingsForm({ ...settingsForm, welcome_message: e.target.value })}
                  />
                </div>

                <button type="submit" className="bw-btn-white" style={{ width: '100%', justifyContent: 'center', padding: '0.85rem' }} disabled={savingSettings}>
                  {savingSettings ? 'Guardando...' : 'Guardar Ajustes'}
                </button>
              </form>
            )}
          </>
        )}

        {/* Footer */}
        <footer style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--bw-dim)' }}>
          © 2026 Red Descentralizada de Comunidades Oficiales • Monocromático
        </footer>
      </div>
    </div>
  );
}
