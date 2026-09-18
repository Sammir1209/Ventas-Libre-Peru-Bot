'use client';

import { useState, useEffect } from 'react';
import {
  IconShield,
  IconCheck,
  IconExternalLink,
  IconBot,
  IconAlertTriangle,
  IconRefresh,
} from '../common/Icons';
import ChatSelectorDropdown from '../common/ChatSelectorDropdown';

export default function ChannelsVerificationSection({
  settings,
  onSaveSettings,
  saving,
  onPreviewLanding,
  slug,
  adminToken,
  adminKey,
}) {
  const [form, setForm] = useState({
    staff_invite_link: settings?.staff_invite_link || '',
    channels_to_verify: settings?.channels_to_verify || '',
    groups_folder_link: settings?.groups_folder_link || '',
    community_name: settings?.community_name || '',
    welcome_message: settings?.welcome_message || '',
  });

  const [availableChats, setAvailableChats] = useState([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [primaryGroup, setPrimaryGroup] = useState('');

  // Sincronizar formulario si settings cambia
  useEffect(() => {
    if (settings) {
      setForm({
        staff_invite_link: settings.staff_invite_link || '',
        channels_to_verify: settings.channels_to_verify || '',
        groups_folder_link: settings.groups_folder_link || '',
        community_name: settings.community_name || '',
        welcome_message: settings.welcome_message || '',
      });
    }
  }, [settings]);

  // Cargar chats donde el sub-bot es miembro o admin y el grupo principal actual
  const loadAvailableChats = async () => {
    if (!slug) return;
    setLoadingChats(true);
    try {
      const queryParams = new URLSearchParams();
      if (adminToken) queryParams.set('token', adminToken);
      if (adminKey) queryParams.set('key', adminKey);

      const [chatsRes, primRes] = await Promise.all([
        fetch(`/api/portal/${encodeURIComponent(slug)}/admin/available-chats?${queryParams.toString()}`).then((r) => r.json()),
        fetch(`/api/portal/${encodeURIComponent(slug)}/admin/primary-group?${queryParams.toString()}`).then((r) => r.json()).catch(() => ({ ok: false })),
      ]);

      if (chatsRes.ok && Array.isArray(chatsRes.chats)) {
        setAvailableChats(chatsRes.chats);
      }
      if (primRes.ok && primRes.primaryChatId) {
        setPrimaryGroup(String(primRes.primaryChatId));
      }
    } catch (err) {
      console.warn('Error cargando chats disponibles del sub-bot:', err);
    } finally {
      setLoadingChats(false);
    }
  };

  useEffect(() => {
    loadAvailableChats();
  }, [slug, adminToken, adminKey]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveSettings(form);
  };

  const channelCount = form.channels_to_verify
    ? form.channels_to_verify.split('\n').map((s) => s.trim()).filter(Boolean).length
    : 0;

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Encabezado Estilo HeroUI */}
      <div className="section-header" style={{ marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '9999px',
                background: 'rgba(0, 111, 238, 0.12)',
                border: '1px solid rgba(0, 111, 238, 0.3)',
                color: '#006FEE',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              <IconShield size={12} />
              Seguridad Perimetral
            </span>
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#f4f4f5', letterSpacing: '-0.02em' }}>
            Canales de Verificación & Enlaces Oficiales
          </h2>
          <p style={{ color: '#a1a1aa', fontSize: '14px', marginTop: '4px' }}>
            Gestiona los canales obligatorios mediante el menú inteligente con detección de administrador en tiempo real.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={loadAvailableChats}
            disabled={loadingChats}
            title="Refrescar chats detectados"
          >
            <IconRefresh size={14} className={loadingChats ? 'animate-spin' : ''} />
            <span>Refrescar Chats</span>
          </button>
          {onPreviewLanding && (
            <button className="btn btn-primary btn-sm" onClick={onPreviewLanding}>
              <IconExternalLink size={14} />
              <span>Ver Landing Pública</span>
            </button>
          )}
        </div>
      </div>

      {/* HeroUI Banner Status Card */}
      <div
        className="panel-card"
        style={{
          padding: '20px 24px',
          marginBottom: '24px',
          borderRadius: '20px',
          background: channelCount > 0 
            ? 'linear-gradient(135deg, rgba(23, 201, 100, 0.08) 0%, rgba(24, 24, 27, 0.8) 100%)' 
            : 'linear-gradient(135deg, rgba(245, 165, 36, 0.08) 0%, rgba(24, 24, 27, 0.8) 100%)',
          border: `1px solid ${channelCount > 0 ? 'rgba(23, 201, 100, 0.25)' : 'rgba(245, 165, 36, 0.25)'}`,
          backdropFilter: 'blur(20px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '9999px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: channelCount > 0 ? 'rgba(23, 201, 100, 0.15)' : 'rgba(245, 165, 36, 0.15)',
              border: `1px solid ${channelCount > 0 ? 'rgba(23, 201, 100, 0.4)' : 'rgba(245, 165, 36, 0.4)'}`,
              flexShrink: 0,
            }}
          >
            {channelCount > 0 ? (
              <IconCheck size={22} color="#17c964" />
            ) : (
              <IconAlertTriangle size={22} color="#f5a524" />
            )}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <span style={{ fontWeight: 700, fontSize: '16px', color: '#f4f4f5' }}>
                {channelCount > 0
                  ? `Verificación Automática Activa (${channelCount} ${channelCount === 1 ? 'canal obligatorio' : 'canales obligatorios'})`
                  : 'Modo Acceso Libre — Sin canales configurados'}
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: channelCount > 0 ? 'rgba(23, 201, 100, 0.2)' : 'rgba(245, 165, 36, 0.2)',
                  color: channelCount > 0 ? '#17c964' : '#f5a524',
                }}
              >
                {channelCount > 0 ? 'Mute Activo' : 'Mute Desactivado'}
              </span>
            </div>
            <div style={{ fontSize: '13px', color: '#a1a1aa' }}>
              {channelCount > 0
                ? 'Los nuevos usuarios serán silenciados de inmediato en todos los grupos hasta que se unan a estos canales.'
                : 'Al no tener canales configurados, el sub-bot permitirá el chat inmediato a los nuevos miembros sin restricciones.'}
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        {/* Selector Inteligente del Grupo Principal de Verificación */}
        <div className="panel-card" style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(0, 111, 238, 0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🛡️</span>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f4f4f5', margin: 0 }}>
                Grupo Principal de Verificación
              </h3>
            </div>
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '9999px', background: 'rgba(0, 111, 238, 0.15)', color: '#006FEE', fontWeight: 700 }}>
              S_WICK CORE
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#a1a1aa', marginBottom: '14px' }}>
            Elige el grupo oficial principal donde este sub-bot silenciará a los miembros que aún no se hayan verificado.
          </p>
          <select
            className="input-field"
            style={{
              width: '100%',
              borderRadius: '12px',
              fontSize: '13px',
              background: 'rgba(24, 24, 27, 0.9)',
              color: '#f4f4f5',
              padding: '10px 14px',
              cursor: 'pointer',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
            value={primaryGroup}
            onChange={async (e) => {
              const val = e.target.value;
              setPrimaryGroup(val);
              try {
                const queryParams = new URLSearchParams();
                if (adminToken) queryParams.set('token', adminToken);
                if (adminKey) queryParams.set('key', adminKey);
                await fetch(`/api/portal/${encodeURIComponent(slug)}/admin/primary-group?${queryParams.toString()}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ chatId: val }),
                });
              } catch (err) {
                console.warn('Error guardando grupo principal:', err);
              }
            }}
          >
            <option value="">-- Sin Grupo Principal Designado (Verificación en todos los grupos) --</option>
            {availableChats
              .filter((c) => c.type !== 'channel')
              .map((c) => (
                <option key={c.chatId} value={c.chatId}>
                  👥 {c.title} ({c.chatId}) — {c.isAdmin ? '🛡️ Admin Completo' : '⚠️ No Admin'}
                </option>
              ))}
          </select>
        </div>

        {/* Selector Inteligente de Canales Desplegable */}
        <div className="panel-card" style={{ padding: '24px', borderRadius: '20px' }}>
          <ChatSelectorDropdown
            label="Canales Requeridos para Verificación"
            value={form.channels_to_verify}
            onChange={(val) => setForm({ ...form, channels_to_verify: val })}
            chats={availableChats}
            isMulti={true}
            loading={loadingChats}
            placeholder="Haz clic para seleccionar canales donde el bot sea Administrador..."
            hint="Selecciona desde la lista desplegable. Los canales donde el bot es 🛡️ Admin permitirán verificar la membresía automáticamente sin fallos."
          />
        </div>

        {/* HeroUI Card: Enlace de Staff */}
        <div className="panel-card" style={{ padding: '24px', borderRadius: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px', color: '#f4f4f5' }}>
            Enlace de Invitación al Grupo de Staff
          </h3>
          <p style={{ fontSize: '13px', color: '#a1a1aa', marginBottom: '16px' }}>
            Enlace privado de Telegram que el sub-bot enviará automáticamente por mensaje directo al promover a un miembro con <code>/promote</code>.
          </p>

          <input
            type="url"
            className="input-field"
            style={{ width: '100%', borderRadius: '14px' }}
            placeholder="https://t.me/+IEooR3P..."
            value={form.staff_invite_link}
            onChange={(e) => setForm({ ...form, staff_invite_link: e.target.value })}
          />
        </div>

        {/* HeroUI Card: Carpeta Oficial de Grupos */}
        <div className="panel-card" style={{ padding: '24px', borderRadius: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px', color: '#f4f4f5' }}>
            Carpeta Oficial de Grupos (Telegram Chat Folder)
          </h3>
          <p style={{ fontSize: '13px', color: '#a1a1aa', marginBottom: '16px' }}>
            Enlace de carpeta compartida (ej: <code>https://t.me/addlist/...</code>) para que los miembros se unan a todos tus grupos en un solo toque.
          </p>

          <input
            type="url"
            className="input-field"
            style={{ width: '100%', borderRadius: '14px' }}
            placeholder="https://t.me/addlist/..."
            value={form.groups_folder_link}
            onChange={(e) => setForm({ ...form, groups_folder_link: e.target.value })}
          />
        </div>

        {/* HeroUI Card: Personalización de Comunidad */}
        <div className="panel-card" style={{ padding: '24px', borderRadius: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px', color: '#f4f4f5' }}>
            Identidad & Mensajería de la Comunidad
          </h3>
          <p style={{ fontSize: '13px', color: '#a1a1aa', marginBottom: '16px' }}>
            Elige el nombre de tu comunidad a partir del nombre de tu grupo oficial en tiempo real, o personalízalo manualmente.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '14px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#d4d4d8' }}>
                  Nombre Visible de la Comunidad
                </label>
                {availableChats.length > 0 && (
                  <span style={{ fontSize: '11px', color: '#006FEE', fontWeight: 600 }}>
                    💡 Seleccionar de grupo oficial
                  </span>
                )}
              </div>

              {availableChats.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <select
                    className="input-field"
                    style={{ width: '100%', borderRadius: '12px', fontSize: '12px', background: 'rgba(24, 24, 27, 0.9)', color: '#f4f4f5', padding: '8px 12px', cursor: 'pointer' }}
                    onChange={(e) => {
                      if (e.target.value) {
                        setForm({ ...form, community_name: e.target.value });
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>Seleccionar nombre desde tus grupos oficiales...</option>
                    {availableChats.map((c) => (
                      <option key={c.chatId} value={c.title}>
                        {c.type === 'channel' ? '📢' : '👥'} {c.title} ({c.type})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <input
                type="text"
                className="input-field"
                style={{ width: '100%', borderRadius: '14px' }}
                value={form.community_name}
                onChange={(e) => setForm({ ...form, community_name: e.target.value })}
                placeholder="Ej: Ventas Libres Perú o nombre de tu comunidad"
              />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#d4d4d8', display: 'block', marginBottom: '6px' }}>
                Mensaje de Verificación Personalizado
              </label>
              <input
                type="text"
                className="input-field"
                style={{ width: '100%', borderRadius: '14px' }}
                value={form.welcome_message}
                onChange={(e) => setForm({ ...form, welcome_message: e.target.value })}
                placeholder="¡Bienvenido! Únete a los canales para hablar."
              />
            </div>
          </div>
        </div>

        {/* HeroUI Pill Action Button */}
        <button
          type="submit"
          className="btn btn-primary"
          style={{
            width: '100%',
            padding: '16px',
            fontSize: '15px',
            fontWeight: 700,
            borderRadius: '9999px',
            background: 'linear-gradient(135deg, #006FEE 0%, #7828c8 100%)',
            boxShadow: '0 8px 25px -5px rgba(0, 111, 238, 0.4)',
            transition: 'all 0.25s ease',
          }}
          disabled={saving}
        >
          {saving ? 'Guardando Ajustes en la Nube...' : 'Guardar y Sincronizar Cambios'}
        </button>
      </form>
    </div>
  );
}
