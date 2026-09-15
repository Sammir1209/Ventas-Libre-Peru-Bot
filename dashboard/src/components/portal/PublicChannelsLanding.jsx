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
  IconActivity,
  IconLock,
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
    <div className="heroui-landing-container">
      <style jsx>{`
        .heroui-landing-container {
          min-height: 100vh;
          background: #000000;
          color: #f4f4f5;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          overflow-x: hidden;
          padding: 0 1.25rem 3.5rem;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }

        /* HeroUI Ambient Orbs & Grids */
        .heroui-landing-container::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: 
            radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px);
          background-size: 28px 28px;
          pointer-events: none;
          z-index: 0;
        }

        .ambient-glow-primary {
          position: absolute;
          top: -100px;
          left: 50%;
          transform: translateX(-50%);
          width: 700px;
          height: 400px;
          background: radial-gradient(circle, rgba(0, 111, 238, 0.22) 0%, rgba(120, 40, 200, 0.12) 50%, transparent 75%);
          filter: blur(80px);
          border-radius: 50%;
          pointer-events: none;
          z-index: 0;
        }

        /* HeroUI Sticky Frosted Navbar */
        .heroui-navbar {
          width: 100%;
          max-width: 680px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.2rem 0;
          margin-bottom: 1.5rem;
          position: relative;
          z-index: 10;
        }

        .heroui-nav-brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .heroui-brand-avatar {
          width: 38px;
          height: 38px;
          border-radius: 9999px;
          background: linear-gradient(135deg, #006FEE 0%, #7828c8 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          box-shadow: 0 0 16px rgba(0, 111, 238, 0.4);
        }

        .heroui-brand-name {
          font-weight: 800;
          font-size: 1.05rem;
          letter-spacing: -0.02em;
          color: #ffffff;
        }

        .heroui-nav-cta {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.45rem 0.95rem;
          border-radius: 9999px;
          background: rgba(39, 39, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #d4d4d8;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          backdrop-filter: blur(12px);
          transition: all 0.2s ease;
        }

        .heroui-nav-cta:hover {
          background: rgba(63, 63, 70, 0.8);
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.25);
        }

        /* Contenido Central */
        .landing-content {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 680px;
          display: flex;
          flex-direction: column;
          gap: 1.6rem;
        }

        /* HeroUI Card Principal */
        .heroui-hero-card {
          background: rgba(24, 24, 27, 0.75);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 28px;
          padding: 2.4rem 2rem;
          text-align: center;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.12);
          position: relative;
          overflow: hidden;
        }

        .heroui-hero-card::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent 0%, rgba(0, 111, 238, 0.6) 50%, transparent 100%);
        }

        /* HeroUI Chip Badge */
        .heroui-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.35rem 0.9rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          background: rgba(0, 111, 238, 0.15);
          border: 1px solid rgba(0, 111, 238, 0.35);
          color: #006FEE;
          margin-bottom: 1.2rem;
        }

        .heroui-pulse-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #17c964;
          box-shadow: 0 0 10px #17c964;
          animation: herouiPulse 2s infinite;
        }

        @keyframes herouiPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.6; }
        }

        .hero-title {
          font-size: 2.3rem;
          font-weight: 900;
          letter-spacing: -0.04em;
          margin: 0 0 0.85rem 0;
          background: linear-gradient(180deg, #ffffff 30%, #a1a1aa 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          line-height: 1.15;
        }

        .hero-subtitle {
          font-size: 0.96rem;
          line-height: 1.6;
          color: #a1a1aa;
          margin: 0 auto;
          max-width: 520px;
        }

        /* HeroUI Progress Card */
        .heroui-progress-card {
          background: rgba(24, 24, 27, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 1.1rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.7rem;
          backdrop-filter: blur(16px);
        }

        .progress-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.82rem;
        }

        .progress-track {
          width: 100%;
          height: 8px;
          border-radius: 9999px;
          background: rgba(39, 39, 42, 0.8);
          overflow: hidden;
          position: relative;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #006FEE 0%, #17c964 100%);
          transition: width 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          border-radius: 9999px;
          box-shadow: 0 0 12px rgba(23, 201, 100, 0.5);
        }

        /* HeroUI Channel Interactive Card */
        .heroui-channel-card {
          background: rgba(24, 24, 27, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 20px;
          padding: 1.2rem 1.4rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          text-decoration: none;
          color: inherit;
          backdrop-filter: blur(16px);
        }

        .heroui-channel-card:hover {
          border-color: rgba(0, 111, 238, 0.45);
          background: rgba(39, 39, 42, 0.65);
          transform: translateY(-2px);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(0, 111, 238, 0.15);
        }

        .channel-left {
          display: flex;
          align-items: center;
          gap: 1.1rem;
        }

        .channel-avatar {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: rgba(39, 39, 42, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.12);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 1.1rem;
          color: #f4f4f5;
          flex-shrink: 0;
        }

        .channel-name {
          font-weight: 700;
          font-size: 1.05rem;
          color: #ffffff;
          margin-bottom: 0.2rem;
        }

        .channel-sub {
          font-size: 0.78rem;
          color: #a1a1aa;
          display: flex;
          align-items: center;
          gap: 0.45rem;
        }

        /* HeroUI Pill Button */
        .heroui-btn-pill {
          padding: 0.65rem 1.3rem;
          border-radius: 9999px;
          font-weight: 700;
          font-size: 0.85rem;
          background: #ffffff;
          color: #000000;
          border: none;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          flex-shrink: 0;
          user-select: none;
        }

        .heroui-btn-pill:active {
          transform: scale(0.96);
        }

        .heroui-btn-pill:hover {
          background: #e4e4e7;
          box-shadow: 0 0 16px rgba(255, 255, 255, 0.3);
        }

        .heroui-btn-visited {
          background: rgba(23, 201, 100, 0.15);
          color: #17c964;
          border: 1px solid rgba(23, 201, 100, 0.35);
        }

        .heroui-btn-visited:hover {
          background: rgba(23, 201, 100, 0.25);
          box-shadow: 0 0 16px rgba(23, 201, 100, 0.3);
        }

        /* HeroUI Big Master Unlock Button */
        .heroui-master-cta {
          width: 100%;
          padding: 1.25rem;
          border-radius: 9999px;
          background: linear-gradient(135deg, #006FEE 0%, #7828c8 100%);
          color: #ffffff;
          font-weight: 800;
          font-size: 1.05rem;
          border: 1px solid rgba(255, 255, 255, 0.2);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.8rem;
          box-shadow: 0 10px 35px -5px rgba(0, 111, 238, 0.5);
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          text-decoration: none;
          user-select: none;
        }

        .heroui-master-cta:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 45px -5px rgba(0, 111, 238, 0.65);
        }

        .heroui-master-cta:active {
          transform: scale(0.98);
        }

        /* HeroUI Footer */
        .heroui-footer {
          margin-top: 2.5rem;
          text-align: center;
          font-size: 0.8rem;
          color: #71717a;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .heroui-footer-link {
          color: #a1a1aa;
          text-decoration: none;
          font-weight: 600;
          cursor: pointer;
          transition: color 0.2s ease;
        }

        .heroui-footer-link:hover {
          color: #006FEE;
        }
      `}</style>

      <div className="ambient-glow-primary" />

      {/* HeroUI Frosted Top Bar */}
      <div className="heroui-navbar">
        <div className="heroui-nav-brand">
          <div className="heroui-brand-avatar">
            <IconShield size={18} />
          </div>
          <span className="heroui-brand-name">{communityName}</span>
        </div>

        {onGoToAdmin && (
          <button type="button" onClick={onGoToAdmin} className="heroui-nav-cta">
            <IconLock size={12} />
            <span>Panel Admin</span>
          </button>
        )}
      </div>

      <div className="landing-content">
        {/* HeroUI Hero Card */}
        <div className="heroui-hero-card">
          <div className="heroui-chip">
            <span className="heroui-pulse-dot"></span>
            <span>{botUsername ? `@${botUsername}` : 'Sistema de Verificación'}</span>
          </div>

          <h1 className="hero-title">{communityName}</h1>
          <p className="hero-subtitle">
            {portalData?.welcome_message ||
              'Por directiva de seguridad y control perimetral, debes estar unido a los canales oficiales obligatorios para habilitar tus privilegios de chat en los grupos.'}
          </p>
        </div>

        {/* Estado de Carga o Error */}
        {loading && (
          <div className="heroui-hero-card" style={{ padding: '2rem' }}>
            <p style={{ color: '#a1a1aa', margin: 0 }}>Cargando especificaciones de la comunidad...</p>
          </div>
        )}

        {error && (
          <div className="heroui-hero-card" style={{ borderColor: '#f31260' }}>
            <p style={{ color: '#f31260', margin: 0 }}>{error}</p>
          </div>
        )}

        {/* ── CASO A: TIENE CANALES OBLIGATORIOS ── */}
        {!loading && !error && totalChannels > 0 && (
          <>
            {/* HeroUI Barra de Progreso */}
            <div className="heroui-progress-card">
              <div className="progress-meta">
                <span style={{ color: '#a1a1aa', fontWeight: 600 }}>Pasos Completados:</span>
                <span style={{ fontWeight: 800, color: '#f4f4f5' }}>
                  {completedCount} de {totalChannels} canales completados
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${(completedCount / totalChannels) * 100}%` }}
                />
              </div>
            </div>

            {/* Lista de Canales Estilo HeroUI */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              {channels.map((ch, idx) => {
                const isVisited = visitedChannels[idx];
                return (
                  <a
                    key={idx}
                    href={ch.url}
                    target="_blank"
                    rel="noreferrer"
                    className="heroui-channel-card"
                    onClick={() => toggleChannelVisited(idx)}
                  >
                    <div className="channel-left">
                      <div className="channel-avatar">{idx + 1}</div>
                      <div>
                        <div className="channel-name">{ch.name}</div>
                        <div className="channel-sub">
                          <span>Canal Oficial Requerido</span>
                          {isVisited && (
                            <span style={{ color: '#17c964', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 700 }}>
                              • <IconCheck size={12} /> Listo
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`heroui-btn-pill ${isVisited ? 'heroui-btn-visited' : ''}`}
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
                  className="heroui-channel-card"
                  style={{ borderColor: 'rgba(0, 111, 238, 0.3)', background: 'rgba(0, 111, 238, 0.06)' }}
                >
                  <div className="channel-left">
                    <div className="channel-avatar" style={{ background: 'rgba(0, 111, 238, 0.2)', color: '#006FEE' }}>
                      <IconFolder size={20} />
                    </div>
                    <div>
                      <div className="channel-name">Carpeta Oficial de Grupos</div>
                      <div className="channel-sub">Añade toda la red de chats a tu Telegram con 1 solo toque</div>
                    </div>
                  </div>

                  <button type="button" className="heroui-btn-pill" style={{ background: '#006FEE', color: '#ffffff' }}>
                    <span>Añadir Carpeta</span>
                    <IconArrowRight size={14} />
                  </button>
                </a>
              )}
            </div>

            {/* HeroUI CTA Maestro: Retorno a Telegram */}
            <a
              href={botUsername ? `https://t.me/${botUsername}` : 'https://t.me'}
              target="_blank"
              rel="noreferrer"
              className="heroui-master-cta"
            >
              <span>Regresar al Bot y Desbloquearme</span>
              <IconArrowRight size={18} />
            </a>
          </>
        )}

        {/* ── CASO B: NO TIENE CANALES OBLIGATORIOS (ACCESO LIBRE) ── */}
        {!loading && !error && totalChannels === 0 && (
          <div className="heroui-hero-card" style={{ padding: '3.5rem 2rem' }}>
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '9999px',
                background: 'rgba(23, 201, 100, 0.15)',
                border: '1px solid rgba(23, 201, 100, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem auto',
                boxShadow: '0 0 20px rgba(23, 201, 100, 0.3)',
              }}
            >
              <IconCheck size={32} color="#17c964" />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.6rem 0', color: '#ffffff' }}>
              Acceso Inmediato y Libre
            </h2>
            <p style={{ color: '#a1a1aa', fontSize: '0.92rem', lineHeight: 1.6, margin: '0 0 2rem 0', maxWidth: '440px', marginLeft: 'auto', marginRight: 'auto' }}>
              Esta comunidad no requiere canales obligatorios de verificación en este momento. Puedes participar y escribir libremente en el chat grupal.
            </p>

            <a
              href={botUsername ? `https://t.me/${botUsername}` : 'https://t.me'}
              target="_blank"
              rel="noreferrer"
              className="heroui-master-cta"
              style={{ maxWidth: '340px', margin: '0 auto' }}
            >
              <span>Abrir Chat Grupal</span>
              <IconArrowRight size={16} />
            </a>
          </div>
        )}

        {/* HeroUI Footer */}
        <div className="heroui-footer">
          <div>© 2026 Red Descentralizada de Comunidades Oficiales • Protocolo Enterprise</div>
          {onGoToAdmin && (
            <div>
              <button
                type="button"
                onClick={onGoToAdmin}
                className="heroui-footer-link"
                style={{ background: 'none', border: 'none' }}
              >
                Acceso de Gestión para Administradores de {communityName}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
