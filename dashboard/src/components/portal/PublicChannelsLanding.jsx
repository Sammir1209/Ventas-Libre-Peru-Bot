'use client';

import { useState } from 'react';
import {
  IconBot,
  IconShield,
  IconUsers,
  IconArrowRight,
  IconExternalLink,
  IconCheck,
  IconFolder,
} from '../common/Icons';

export default function PublicChannelsLanding({ portalData, loading, error, onGoToAdmin }) {
  const [visitedChannels, setVisitedChannels] = useState({});

  const toggleChannelVisited = (index) => {
    setVisitedChannels((prev) => ({
      ...prev,
      [index]: true,
    }));
  };

  const channels = portalData?.channels || [];
  const totalChannels = channels.length;
  const completedCount = Object.keys(visitedChannels).length;
  const botUsername = portalData?.bot_username ? portalData.bot_username.replace(/^@/, '') : '';
  const communityName = portalData?.community_name || 'Comunidad Oficial';

  return (
    <div className="landing-ultra-wrapper">
      <style jsx>{`
        .landing-ultra-wrapper {
          min-height: 100vh;
          background: #000000;
          color: #ffffff;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          overflow-x: hidden;
          padding: 2.5rem 1.2rem;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }

        /* Rejilla de Fondo Cyberpunk Obsidian */
        .landing-ultra-wrapper::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: 
            linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
          background-size: 36px 36px;
          pointer-events: none;
        }

        /* Halo de Luz Superior */
        .ambient-glow {
          position: absolute;
          top: -120px;
          width: 550px;
          height: 350px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.12) 0%, rgba(0, 0, 0, 0) 70%);
          border-radius: 50%;
          pointer-events: none;
          z-index: 0;
        }

        .landing-content {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 680px;
          display: flex;
          flex-direction: column;
          gap: 1.8rem;
        }

        /* Header Card */
        .hero-card {
          background: rgba(18, 18, 20, 0.7);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 20px;
          padding: 2.2rem 1.8rem;
          text-align: center;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }

        .live-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.35rem 0.85rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #ffffff;
          margin-bottom: 1.2rem;
        }

        .pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 10px #22c55e;
        }

        .hero-title {
          font-size: 2.1rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          margin: 0 0 0.8rem 0;
          color: #ffffff;
          line-height: 1.2;
        }

        .hero-subtitle {
          font-size: 0.95rem;
          line-height: 1.6;
          color: #a1a1aa;
          margin: 0;
          max-width: 540px;
          margin-left: auto;
          margin-right: auto;
        }

        /* Barra de Progreso */
        .progress-card {
          background: rgba(24, 24, 27, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 1rem 1.4rem;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .progress-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.82rem;
        }

        .progress-track {
          width: 100%;
          height: 6px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.1);
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: #ffffff;
          transition: width 0.4s ease;
          border-radius: 9999px;
        }

        /* Tarjeta de Canal */
        .channel-item {
          background: rgba(18, 18, 20, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 1.1rem 1.4rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          text-decoration: none;
          color: inherit;
        }

        .channel-item:hover {
          border-color: rgba(255, 255, 255, 0.35);
          background: rgba(28, 28, 32, 0.95);
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
        }

        .channel-left {
          display: flex;
          align-items: center;
          gap: 1.1rem;
        }

        .channel-badge-num {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: #18181b;
          border: 1px solid rgba(255, 255, 255, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 1.1rem;
          color: #ffffff;
        }

        .channel-name {
          font-weight: 700;
          font-size: 1.05rem;
          color: #ffffff;
          margin-bottom: 0.2rem;
        }

        .channel-tag {
          font-size: 0.78rem;
          color: #71717a;
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .btn-join {
          padding: 0.6rem 1.2rem;
          border-radius: 10px;
          font-weight: 700;
          font-size: 0.85rem;
          background: #ffffff;
          color: #000000;
          border: none;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.2s ease;
        }

        .btn-join:hover {
          background: #e4e4e7;
          transform: scale(1.03);
        }

        .btn-joined {
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.25);
        }

        /* Botón Maestro de Validación */
        .master-unlock-btn {
          width: 100%;
          padding: 1.2rem;
          border-radius: 16px;
          background: #ffffff;
          color: #000000;
          font-weight: 800;
          font-size: 1.05rem;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.8rem;
          box-shadow: 0 0 30px rgba(255, 255, 255, 0.25);
          transition: all 0.3s ease;
          text-decoration: none;
        }

        .master-unlock-btn:hover {
          background: #f4f4f5;
          transform: translateY(-2px);
          box-shadow: 0 0 45px rgba(255, 255, 255, 0.4);
        }

        /* Footer */
        .landing-footer {
          margin-top: 2rem;
          text-align: center;
          font-size: 0.8rem;
          color: #52525b;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .admin-link {
          color: #a1a1aa;
          text-decoration: none;
          font-weight: 600;
          cursor: pointer;
          transition: color 0.2s ease;
        }

        .admin-link:hover {
          color: #ffffff;
        }
      `}</style>

      <div className="ambient-glow" />

      <div className="landing-content">
        {/* Cabecera Ultra-Premium */}
        <div className="hero-card">
          <div className="live-tag">
            <span className="pulse-dot"></span>
            <span>{botUsername ? `@${botUsername}` : 'Bot Activo 24/7'}</span>
          </div>

          <h1 className="hero-title">{communityName}</h1>
          <p className="hero-subtitle">
            {portalData?.welcome_message ||
              'Por directiva de seguridad y control perimetral, debes estar unido a los canales oficiales obligatorios para habilitar tus privilegios de chat en los grupos.'}
          </p>
        </div>

        {/* Estado de Carga o Error */}
        {loading && (
          <div className="hero-card" style={{ padding: '2rem' }}>
            <p style={{ color: '#a1a1aa', margin: 0 }}>Cargando especificaciones de la comunidad...</p>
          </div>
        )}

        {error && (
          <div className="hero-card" style={{ borderColor: '#ef4444' }}>
            <p style={{ color: '#ef4444', margin: 0 }}>{error}</p>
          </div>
        )}

        {/* ── CASO A: TIENE CANALES OBLIGATORIOS ── */}
        {!loading && !error && totalChannels > 0 && (
          <>
            {/* Barra de Progreso */}
            <div className="progress-card">
              <div className="progress-meta">
                <span style={{ color: '#a1a1aa', fontWeight: 600 }}>Pasos Completados:</span>
                <span style={{ fontWeight: 800, color: '#ffffff' }}>
                  {completedCount} de {totalChannels} canales
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${(completedCount / totalChannels) * 100}%` }}
                />
              </div>
            </div>

            {/* Lista de Canales */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              {channels.map((ch, idx) => {
                const isVisited = visitedChannels[idx];
                return (
                  <a
                    key={idx}
                    href={ch.url}
                    target="_blank"
                    rel="noreferrer"
                    className="channel-item"
                    onClick={() => toggleChannelVisited(idx)}
                  >
                    <div className="channel-left">
                      <div className="channel-badge-num">{idx + 1}</div>
                      <div>
                        <div className="channel-name">{ch.name}</div>
                        <div className="channel-tag">
                          <span>Canal Oficial Obligatorio</span>
                          {isVisited && (
                            <span style={{ color: '#22c55e', display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: 700 }}>
                              • <IconCheck size={12} /> Listo
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`btn-join ${isVisited ? 'btn-joined' : ''}`}
                    >
                      <span>{isVisited ? 'Unido' : 'Unirme'}</span>
                      <IconExternalLink size={14} />
                    </button>
                  </a>
                );
              })}

              {/* Carpeta Oficial si existe */}
              {portalData?.groups_folder_link && (
                <a
                  href={portalData.groups_folder_link}
                  target="_blank"
                  rel="noreferrer"
                  className="channel-item"
                  style={{ borderColor: 'rgba(255, 255, 255, 0.25)', background: 'rgba(28, 28, 32, 0.8)' }}
                >
                  <div className="channel-left">
                    <div className="channel-badge-num" style={{ background: '#27272a' }}>
                      <IconFolder size={20} />
                    </div>
                    <div>
                      <div className="channel-name">Carpeta Oficial de Grupos</div>
                      <div className="channel-tag">Añade toda la red de chats a tu Telegram con 1 clic</div>
                    </div>
                  </div>

                  <button type="button" className="btn-join">
                    <span>Añadir Carpeta</span>
                    <IconArrowRight size={14} />
                  </button>
                </a>
              )}
            </div>

            {/* Botón Principal de Retorno a Telegram */}
            <a
              href={botUsername ? `https://t.me/${botUsername}` : 'https://t.me'}
              target="_blank"
              rel="noreferrer"
              className="master-unlock-btn"
            >
              <span>Regresar al Bot y Desbloquearme</span>
              <IconArrowRight size={18} />
            </a>
          </>
        )}

        {/* ── CASO B: NO TIENE CANALES OBLIGATORIOS (ACCESO LIBRE) ── */}
        {!loading && !error && totalChannels === 0 && (
          <div className="hero-card" style={{ padding: '3rem 2rem' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem auto',
              }}
            >
              <IconCheck size={32} color="#22c55e" />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 0.6rem 0', color: '#ffffff' }}>
              Acceso Directo y Libre
            </h2>
            <p style={{ color: '#a1a1aa', fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 1.8rem 0' }}>
              Esta comunidad no requiere canales obligatorios de verificación en este momento. Puedes participar y escribir libremente en el chat grupal.
            </p>

            <a
              href={botUsername ? `https://t.me/${botUsername}` : 'https://t.me'}
              target="_blank"
              rel="noreferrer"
              className="master-unlock-btn"
              style={{ maxWidth: '320px', margin: '0 auto' }}
            >
              <span>Abrir Chat Grupal</span>
              <IconArrowRight size={16} />
            </a>
          </div>
        )}

        {/* Footer */}
        <div className="landing-footer">
          <div>© 2026 Red Descentralizada de Comunidades Oficiales • Enterprise Security</div>
          {onGoToAdmin && (
            <div>
              <button onClick={onGoToAdmin} className="admin-link" style={{ background: 'none', border: 'none' }}>
                Acceso para Administradores de {communityName}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
