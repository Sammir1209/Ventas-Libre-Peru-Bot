'use client';

import { useState } from 'react';
import {
  IconShield,
  IconCheck,
  IconExternalLink,
  IconBot,
  IconAlertTriangle,
} from '../common/Icons';

export default function ChannelsVerificationSection({
  settings,
  onSaveSettings,
  saving,
  onPreviewLanding,
}) {
  const [form, setForm] = useState({
    staff_invite_link: settings?.staff_invite_link || '',
    channels_to_verify: settings?.channels_to_verify || '',
    groups_folder_link: settings?.groups_folder_link || '',
    community_name: settings?.community_name || '',
    welcome_message: settings?.welcome_message || '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveSettings(form);
  };

  const channelCount = form.channels_to_verify
    ? form.channels_to_verify.split('\n').map((s) => s.trim()).filter(Boolean).length
    : 0;

  return (
    <div>
      <div className="section-header">
        <div>
          <h2>Canales de Verificación & Enlaces Oficiales</h2>
          <p>Control de canales obligatorios de entrada, carpeta de grupos e invitación al equipo de Staff</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {onPreviewLanding && (
            <button className="btn btn-secondary btn-sm" onClick={onPreviewLanding}>
              <IconExternalLink size={14} />
              <span>Previsualizar Landing Pública</span>
            </button>
          )}
        </div>
      </div>

      {/* Alerta Destacada sobre el Sistema de Mute */}
      <div
        className="panel-card"
        style={{
          padding: '18px 24px',
          marginBottom: '24px',
          borderLeft: `4px solid ${channelCount > 0 ? '#22c55e' : '#f59e0b'}`,
          background: 'rgba(24, 24, 27, 0.6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '6px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.05)' }}>
            {channelCount > 0 ? (
              <IconCheck size={20} color="#22c55e" />
            ) : (
              <IconAlertTriangle size={20} color="#f59e0b" />
            )}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px', color: '#ffffff', marginBottom: '2px' }}>
              {channelCount > 0
                ? `Sistema de Verificación Activo (${channelCount} ${channelCount === 1 ? 'canal' : 'canales'} requeridos)`
                : 'Modo Acceso Libre (Sin canales configurados)'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {channelCount > 0
                ? 'El bot silenciará automáticamente a cualquier usuario nuevo y le exigirá entrar a estos canales para desbloquearse.'
                : 'Al no tener canales configurados, el bot NO muteará a los miembros nuevos que ingresen a los grupos.'}
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Canales Requeridos */}
        <div className="panel-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px', color: '#ffffff' }}>
            Canales Obligatorios para Nuevos Miembros
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Escribe un canal por línea. Puedes colocar su @alias (ej: <code>@canalsoficial</code>), enlace (ej: <code>https://t.me/canal</code>) o ID numérico.
          </p>

          <textarea
            className="input-field"
            rows={5}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: '13px' }}
            placeholder="@canal_comunidad&#10;@canal_respaldo&#10;https://t.me/avisos"
            value={form.channels_to_verify}
            onChange={(e) => setForm({ ...form, channels_to_verify: e.target.value })}
          />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
            {channelCount} {channelCount === 1 ? 'canal detectado' : 'canales detectados'}. Si dejas este campo completamente vacío, ningún miembro será silenciado.
          </span>
        </div>

        {/* Enlace de Staff */}
        <div className="panel-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px', color: '#ffffff' }}>
            Enlace de Invitación al Grupo de Staff
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Este es el enlace privado que el bot le enviará en mensaje directo al administrador cuando uses <code>/promote</code> en Telegram.
          </p>

          <input
            type="url"
            className="input-field"
            style={{ width: '100%' }}
            placeholder="https://t.me/+IEooR3P..."
            value={form.staff_invite_link}
            onChange={(e) => setForm({ ...form, staff_invite_link: e.target.value })}
          />
        </div>

        {/* Carpeta Oficial de Grupos */}
        <div className="panel-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px', color: '#ffffff' }}>
            Carpeta Oficial de Grupos (Folder Link)
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Enlace de carpeta compartida de Telegram (ej: <code>https://t.me/addlist/...</code>) que permite a los usuarios unirse a todos los grupos de la comunidad en un solo paso.
          </p>

          <input
            type="url"
            className="input-field"
            style={{ width: '100%' }}
            placeholder="https://t.me/addlist/AbCdEf123..."
            value={form.groups_folder_link}
            onChange={(e) => setForm({ ...form, groups_folder_link: e.target.value })}
          />
        </div>

        {/* Personalización de Comunidad */}
        <div className="panel-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px', color: '#ffffff' }}>
            Branding de la Comunidad
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '14px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Nombre de la Comunidad
              </label>
              <input
                type="text"
                className="input-field"
                style={{ width: '100%' }}
                value={form.community_name}
                onChange={(e) => setForm({ ...form, community_name: e.target.value })}
              />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Mensaje de Aviso / Verificación
              </label>
              <input
                type="text"
                className="input-field"
                style={{ width: '100%' }}
                value={form.welcome_message}
                onChange={(e) => setForm({ ...form, welcome_message: e.target.value })}
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', padding: '14px', fontSize: '15px', fontWeight: 700 }}
          disabled={saving}
        >
          {saving ? 'Guardando Ajustes...' : 'Guardar y Aplicar Ajustes'}
        </button>
      </form>
    </div>
  );
}
