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
    <div className="landing-container">
      <style jsx>{`
        .landing-container {
          min-height: 100vh;
          background-color: #050508;
          color: #f8fafc;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          overflow-x: hidden;
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
          line-height: 1.5;
        }

        /* Malla de Fondo Cyberpunk */
        .landing-container::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background-image: 
            linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
          background-size: 32px 32px;
          pointer-events: none;
          z-index: 0;
        }

        /* Halo de Iluminación Ambiental */
        .ambient-aura {
          position: fixed;
          top: -160px;
          left: 50%;
          transform: translateX(-50%);
          width: 650px;
          height: 420px;
          background: radial-gradient(circle, rgba(255, 107, 0, 0.22) 0%, rgba(255, 59, 0, 0.05) 50%, transparent 75%);
          filter: blur(70px);
          border-radius: 50%;
          pointer-events: none;
          z-index: 0;
        }

        .container {
          width: 100%;
          max-width: 640px;
          padding: 2.8rem 1.25rem 4rem;
          z-index: 10;
          display: flex;
          flex-direction: column;
          gap: 1.8rem;
        }

        /* Header */
        .header {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.85rem;
        }

        .live-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.55rem;
          padding: 0.4rem 0.95rem;
          border-radius: 9999px;
          font-size: 0.76rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          background: rgba(255, 107, 0, 0.08);
          border: 1px solid rgba(255, 107, 0, 0.3);
          color: #ff9d42;
          box-shadow: 0 0 15px rgba(255, 107, 0, 0.15);
        }

        .pulse-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 8px #22c55e;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.2); }
        }

        .logo-badge {
          width: 84px;
          height: 84px;
          border-radius: 24px;
          background: linear-gradient(135deg, rgba(28, 34, 50, 0.9) 0%, rgba(12, 14, 20, 0.95) 100%);
          border: 1px solid rgba(255, 107, 0, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6), 0 0 25px rgba(255, 107, 0, 0.2);
          margin-top: 0.4rem;
          position: relative;
        }

        .logo-badge::after {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: 24px;
          background: linear-gradient(135deg, rgba(255, 107, 0, 0.5), transparent);
          z-index: -1;
        }

        .logo-badge svg {
          width: 44px;
          height: 44px;
          fill: none;
          stroke: #ff6b00;
          stroke-width: 2.2;
        }

        .hero-title {
          font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 2.25rem;
          font-weight: 900;
          letter-spacing: -0.03em;
          color: #ffffff;
          line-height: 1.15;
          margin: 0;
        }

        .subtitle {
          font-size: 0.95rem;
          color: #94a3b8;
          line-height: 1.6;
          max-width: 520px;
          margin: 0;
        }

        /* Tarjeta de Pasos */
        .steps-card {
          background: rgba(18, 22, 32, 0.75);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 1.3rem 1.4rem;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          box-shadow: 0 15px 30px rgba(0, 0, 0, 0.5);
        }

        .steps-header {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          font-size: 0.86rem;
          font-weight: 700;
          color: #ff6b00;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .step-item {
          display: flex;
          align-items: flex-start;
          gap: 0.9rem;
          font-size: 0.88rem;
          color: #94a3b8;
          line-height: 1.45;
        }

        .step-num {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 800;
          color: #ffffff;
          flex-shrink: 0;
          margin-top: 1px;
        }

        /* Barra de Progreso Dinámica */
        .progress-box {
          background: rgba(12, 14, 20, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 0.9rem 1.2rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .progress-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.82rem;
        }

        .progress-bar-bg {
          width: 100%;
          height: 6px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.08);
          overflow: hidden;
        }

        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(135deg, #ff7a1a 0%, #ff3b00 100%);
          width: 0%;
          border-radius: 9999px;
          transition: width 0.35s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 0 10px rgba(255, 107, 0, 0.45);
        }

        /* Stack de Canales */
        .channels-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.85rem;
        }

        .channels-header h2 {
          font-size: 1.05rem;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: -0.01em;
          margin: 0;
        }

        .badge-count {
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.25rem 0.65rem;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #64748b;
        }

        .cards-stack {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .channel-card {
          background: rgba(18, 22, 32, 0.75);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 1.1rem 1.25rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          text-decoration: none;
          color: inherit;
          transition: all 0.26s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
        }

        .channel-card:hover {
          background: rgba(28, 34, 48, 0.9);
          border-color: rgba(255, 107, 0, 0.4);
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6), 0 0 20px rgba(255, 107, 0, 0.2);
        }

        .channel-left {
          display: flex;
          align-items: center;
          gap: 1rem;
          min-width: 0;
        }

        .channel-avatar {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: #141722;
          border: 1px solid rgba(255, 255, 255, 0.12);
          overflow: hidden;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-weight: 800;
          font-size: 1.2rem;
        }

        .channel-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .channel-meta {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          min-width: 0;
        }

        .channel-name {
          font-weight: 700;
          font-size: 0.98rem;
          color: #ffffff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .channel-desc {
          font-size: 0.78rem;
          color: #94a3b8;
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .badge-mandatory {
          font-size: 0.68rem;
          font-weight: 700;
          color: #ff9d42;
          background: rgba(255, 107, 0, 0.1);
          padding: 0.1rem 0.4rem;
          border-radius: 4px;
          border: 1px solid rgba(255, 107, 0, 0.2);
        }

        .badge-done {
          color: #10b981 !important;
          background: rgba(16, 185, 129, 0.1) !important;
          border-color: rgba(16, 185, 129, 0.2) !important;
        }

        .btn-action {
          padding: 0.65rem 1.25rem;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #ffffff;
          font-weight: 700;
          font-size: 0.82rem;
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          cursor: pointer;
          transition: all 0.26s cubic-bezier(0.16, 1, 0.3, 1);
          flex-shrink: 0;
          user-select: none;
        }

        .btn-action:active {
          transform: scale(0.96);
        }

        .channel-card:hover .btn-action {
          background: linear-gradient(135deg, #ff7a1a 0%, #ff3b00 100%);
          border-color: transparent;
          color: #ffffff;
          box-shadow: 0 0 20px rgba(255, 107, 0, 0.45);
        }

        .btn-action.done {
          background: rgba(16, 185, 129, 0.15);
          border-color: rgba(16, 185, 129, 0.3);
          color: #10b981;
        }

        .btn-action svg {
          width: 14px;
          height: 14px;
          stroke-width: 2.5;
        }

        /* Botón Maestro CTA hacia Telegram */
        .cta-box {
          margin-top: 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.9rem;
        }

        .btn-verify-guide {
          width: 100%;
          padding: 1.2rem;
          border-radius: 9999px;
          background: linear-gradient(135deg, #ff7a1a 0%, #ff3b00 100%);
          color: #ffffff;
          font-weight: 800;
          font-size: 1.05rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          text-decoration: none;
          box-shadow: 0 12px 35px rgba(255, 107, 0, 0.4);
          transition: all 0.26s cubic-bezier(0.16, 1, 0.3, 1);
          border: 1px solid rgba(255, 255, 255, 0.25);
          user-select: none;
        }

        .btn-verify-guide:active {
          transform: scale(0.98);
        }

        .btn-verify-guide:hover {
          transform: translateY(-2px);
          box-shadow: 0 18px 45px rgba(255, 107, 0, 0.55);
          filter: brightness(1.06);
        }

        .btn-verify-guide.completed {
          box-shadow: 0 0 30px rgba(16, 185, 129, 0.6);
        }

        /* Footer */
        .footer {
          text-align: center;
          font-size: 0.78rem;
          color: #64748b;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          margin-top: 1.5rem;
        }

        .footer-link {
          color: #ff6b00;
          background: none;
          border: none;
          text-decoration: none;
          font-weight: 600;
          cursor: pointer;
        }

        @media (max-width: 480px) {
          .container {
            padding: 1.8rem 1rem 3rem;
            gap: 1.4rem;
          }
          .hero-title {
            font-size: 1.85rem;
          }
          .logo-badge {
            width: 72px;
            height: 72px;
          }
          .channel-card {
            padding: 0.95rem 1rem;
          }
          .channel-name {
            font-size: 0.92rem;
          }
          .btn-action span {
            display: none;
          }
          .btn-action {
            padding: 0.55rem;
          }
        }
      `}</style>

      <div className="ambient-aura" />

      <div className="container">
        {/* Header */}
        <header className="header">
          <div className="live-badge">
            <span className="pulse-dot"></span>
            <span>Red Oficial Activa • MTProto 24/7</span>
          </div>

          <div className="logo-badge">
            <svg viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>

          <h1 className="hero-title">{communityName}</h1>
          <p className="subtitle">
            {portalData?.welcome_message ||
              'Por normativas de seguridad y defensa perimetral contra fraudes, debes ingresar a los canales oficiales para desbloquear tu escritura en el chat grupal.'}
          </p>
        </header>

        {/* Instrucciones Rápidas */}
        <section className="steps-card">
          <div className="steps-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>Protocolo de Acceso en 3 Pasos</span>
          </div>
          <div className="step-item">
            <span className="step-num">1</span>
            <div>Únete a los <strong>canales oficiales requeridos</strong> listados aquí abajo.</div>
          </div>
          <div className="step-item">
            <span className="step-num">2</span>
            <div>Regresa al chat grupal de Telegram donde recibiste el mensaje del Bot.</div>
          </div>
          <div className="step-item">
            <span className="step-num">3</span>
            <div>Presiona el botón <strong>[ VERIFICAR ]</strong> para quitar el silencio al instante.</div>
          </div>
        </section>

        {/* Estado de Carga o Error */}
        {loading && (
          <div className="steps-card" style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: '#94a3b8', margin: 0 }}>Cargando especificaciones de la comunidad...</p>
          </div>
        )}
        {error && (
          <div className="steps-card" style={{ borderColor: '#f31260', textAlign: 'center' }}>
            <p style={{ color: '#f31260', margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Canales y Grupos Requeridos */}
        {!loading && !error && totalChannels > 0 && (
          <>
            {/* Barra de Progreso Dinámica */}
            <div className="progress-box">
              <div className="progress-info">
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Progreso de Canales:</span>
                <span style={{ fontWeight: 800, color: '#ffffff' }}>
                  {completedCount} de {totalChannels} listos
                </span>
              </div>
              <div className="progress-bar-bg">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${(completedCount / totalChannels) * 100}%` }}
                />
              </div>
            </div>

            <section>
              <div className="channels-header">
                <h2>Canales Oficiales Obligatorios</h2>
                <span className="badge-count">{totalChannels} Canales Requeridos</span>
              </div>

              <div className="cards-stack">
                {channels.map((ch, idx) => {
                  const isVisited = visitedChannels[idx];
                  
                  // Intentamos mapear imagenes conocidas por el nombre original
                  // si no tiene, muestra el numero (podriamos usar initiales pero el diseño orignal tenia numeros o imagenes fijas)
                  let imgSrc = null;
                  const nameLower = ch.name.toLowerCase();
                  if (nameLower.includes('ventas libre per')) imgSrc = '/assets/channels/principal.jpg';
                  if (nameLower.includes('quemando')) imgSrc = '/assets/channels/quemando.jpg';
                  if (nameLower.includes('respaldo')) imgSrc = '/assets/channels/respaldo.svg';
                  if (nameLower.includes('madre')) imgSrc = '/assets/channels/madre_ventas.jpg';

                  return (
                    <a
                      key={idx}
                      href={ch.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="channel-card"
                      onClick={() => toggleChannelVisited(idx)}
                    >
                      <div className="channel-left">
                        <div className="channel-avatar">
                          {imgSrc ? (
                            <img src={imgSrc} alt={ch.name} loading="lazy" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = idx + 1; }} />
                          ) : (
                            idx + 1
                          )}
                        </div>
                        <div className="channel-meta">
                          <div className="channel-name">{ch.name}</div>
                          <div className="channel-desc">
                            <span className={`badge-mandatory ${isVisited ? 'badge-done' : ''}`}>
                              {isVisited ? '✓ Listo' : 'Obligatorio'}
                            </span>
                            <span>Canal Requerido</span>
                          </div>
                        </div>
                      </div>
                      <button type="button" className={`btn-action ${isVisited ? 'done' : ''}`}>
                        <span>{isVisited ? 'Listo' : 'Unirme'}</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </button>
                    </a>
                  );
                })}

                {/* Carpeta Oficial si existe */}
                {portalData?.groups_folder_link && (
                  <a
                    href={portalData.groups_folder_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="channel-card"
                    style={{ borderColor: 'rgba(255, 107, 0, 0.3)', background: 'rgba(255, 107, 0, 0.06)' }}
                  >
                    <div className="channel-left">
                      <div className="channel-avatar" style={{ background: 'rgba(255, 107, 0, 0.2)', color: '#ff6b00' }}>
                        <IconFolder size={20} />
                      </div>
                      <div className="channel-meta">
                        <div className="channel-name">Carpeta Oficial de Grupos</div>
                        <div className="channel-desc" style={{ marginTop: '2px' }}>Añade la red a tu Telegram en 1 toque</div>
                      </div>
                    </div>

                    <button type="button" className="btn-action" style={{ background: '#ff6b00', color: '#ffffff', borderColor: '#ff6b00' }}>
                      <span>Añadir</span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </button>
                  </a>
                )}
              </div>
            </section>

            {/* Botón Maestro CTA hacia Telegram */}
            <section className="cta-box">
              <a 
                href={botUsername ? `https://t.me/${botUsername}` : 'https://t.me'} 
                className={`btn-verify-guide ${completedCount === totalChannels ? 'completed' : ''}`}
                target="_blank"
                rel="noreferrer"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21.198 2.433a2.242 2.242 0 0 0-1.022.215l-16.5 6.75a2.25 2.25 0 0 0 .126 4.168l4.47 1.542 1.83 5.488a1.5 1.5 0 0 0 2.29.684l2.91-2.22 4.67 3.44a2.25 2.25 0 0 0 3.52-1.44l3-16.5a2.25 2.25 0 0 0-2.3-2.627z"/></svg>
                <span>Regresar al Bot y Verificarme</span>
              </a>
            </section>
          </>
        )}

        {/* CASO B: NO TIENE CANALES OBLIGATORIOS (ACCESO LIBRE) */}
        {!loading && !error && totalChannels === 0 && (
          <div className="steps-card" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '9999px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem auto',
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)',
              }}
            >
              <IconCheck size={32} color="#10b981" />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.6rem 0', color: '#ffffff' }}>
              Acceso Inmediato y Libre
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.6, margin: '0 0 2rem 0', maxWidth: '440px', marginLeft: 'auto', marginRight: 'auto' }}>
              Esta comunidad no requiere canales obligatorios de verificación en este momento. Puedes participar y escribir libremente en el chat grupal.
            </p>

            <a
              href={botUsername ? `https://t.me/${botUsername}` : 'https://t.me'}
              target="_blank"
              rel="noreferrer"
              className="btn-verify-guide"
              style={{ maxWidth: '340px', margin: '0 auto' }}
            >
              <span>Abrir Chat Grupal</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21.198 2.433a2.242 2.242 0 0 0-1.022.215l-16.5 6.75a2.25 2.25 0 0 0 .126 4.168l4.47 1.542 1.83 5.488a1.5 1.5 0 0 0 2.29.684l2.91-2.22 4.67 3.44a2.25 2.25 0 0 0 3.52-1.44l3-16.5a2.25 2.25 0 0 0-2.3-2.627z"/></svg>
            </a>
          </div>
        )}

        {/* Footer */}
        <footer className="footer">
          <div>© 2026 {communityName} — Sistema de Seguridad Perimetral</div>
          {onGoToAdmin && (
            <div>
              <button
                type="button"
                onClick={onGoToAdmin}
                className="footer-link"
              >
                Acceso Administrativo de la Comunidad
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}

