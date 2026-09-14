'use client';

import { useState } from 'react';
import {
  IconShield,
  IconScale,
  IconAlertTriangle,
  IconSearch,
  IconCheck,
  IconX,
  IconArrowRight,
  IconExternalLink,
  IconBot,
  IconUsers,
  IconLock,
} from '../common/Icons';

export default function LandingPage({ onGoToAdmin, stats }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);

  const handleSearchScammer = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchResult(null);

    try {
      const q = encodeURIComponent(searchQuery.trim().replace('@', ''));
      const res = await fetch(`/api/gban`);
      const data = await res.json();
      
      if (data.ok && Array.isArray(data.burned)) {
        const match = data.burned.find(
          (b) => String(b.user_id) === q || (b.username && b.username.toLowerCase() === q.toLowerCase())
        );

        if (match) {
          setSearchResult({
            found: true,
            user: match,
          });
        } else {
          setSearchResult({
            found: false,
            query: searchQuery,
          });
        }
      } else {
        setSearchResult({ found: false, query: searchQuery });
      }
    } catch {
      setSearchResult({ found: false, query: searchQuery });
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="landing-wrapper">
      {/* ── Top Navbar ── */}
      <nav className="landing-nav">
        <div className="nav-container">
          <div className="brand-logo-area">
            <span className="brand-gem">⟡</span>
            <div className="brand-names">
              <span className="brand-title">VENTAS LIBRES PERÚ</span>
              <span className="brand-sub">PLATAFORMA OFICIAL</span>
            </div>
          </div>

          <div className="nav-links">
            <a href="#escrow">Intermediación</a>
            <a href="#radar">Radar GBan</a>
            <a href="#security">Seguridad</a>
            <a href="#directory">Comunidad</a>
            <button className="btn btn-primary btn-sm" onClick={onGoToAdmin}>
              <IconLock size={13} />
              <span>Acceso Command Center</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <header className="landing-hero">
        <div className="hero-container">
          <div className="hero-badge">
            <IconShield size={14} color="var(--cyan-primary)" />
            <span>INFRAESTRUCTURA DE SEGURIDAD & ESCROW P2P</span>
          </div>

          <h1 className="hero-title">
            Comercio Seguro y Defensa Comunitaria en <span className="gradient-text">Telegram</span>
          </h1>

          <p className="hero-description">
            La plataforma líder del Perú en intermediación comercial transparente, detección temprana de estafadores con base de datos unificada y blindaje perimetral automático 24/7.
          </p>

          <div className="hero-actions">
            <a
              href="https://t.me/VentasLibresPeruOficial"
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
              style={{ padding: '14px 28px', fontSize: '15px' }}
            >
              <span>Acceder a la Comunidad Oficial</span>
              <IconArrowRight size={16} />
            </a>
            <a href="#radar" className="btn btn-secondary" style={{ padding: '14px 28px', fontSize: '15px' }}>
              <IconSearch size={16} />
              <span>Verificar Antecedentes</span>
            </a>
          </div>

          {/* ── Metrics Bar ── */}
          <div className="hero-metrics-grid">
            <div className="metric-box">
              <div className="metric-val">{stats ? stats.totalDeals : '1,250+'}</div>
              <div className="metric-lbl">Tratos Intermediados</div>
            </div>
            <div className="metric-box">
              <div className="metric-val">{stats ? stats.totalBurned : '480+'}</div>
              <div className="metric-lbl">Estafadores Neutralizados</div>
            </div>
            <div className="metric-box">
              <div className="metric-val">{stats ? stats.totalGroups : '25+'}</div>
              <div className="metric-lbl">Grupos Oficiales Blindados</div>
            </div>
            <div className="metric-box">
              <div className="metric-val">99.9%</div>
              <div className="metric-lbl">Disponibilidad en Red</div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Public GBan Radar Widget ── */}
      <section id="radar" className="landing-section">
        <div className="section-container">
          <div className="section-header-center">
            <div className="sub-badge">RADAR DE ANTECEDENTES EN VIVO</div>
            <h2>Consulta Pública de Lista Negra (GBan)</h2>
            <p>Antes de concretar una compra o venta, ingresa el ID de Telegram o @username de tu contraparte para comprobar si registra denuncias.</p>
          </div>

          <div className="radar-widget-card">
            <form onSubmit={handleSearchScammer} className="radar-search-form">
              <div className="search-input-wrap">
                <IconSearch size={18} color="var(--text-subtle)" />
                <input
                  type="text"
                  placeholder="Ingresa @usuario o ID numérico (ej. 7794982496)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="radar-input"
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={searching}>
                {searching ? 'Consultando...' : 'Verificar Usuario'}
              </button>
            </form>

            {searchResult && (
              <div className="radar-result-area">
                {searchResult.found ? (
                  <div className="result-card alert">
                    <div className="result-header">
                      <div className="result-icon-alert">
                        <IconAlertTriangle size={20} color="var(--rose-danger)" />
                      </div>
                      <div>
                        <h4>ALERTA: USUARIO REGISTRADO EN LISTA NEGRA</h4>
                        <span className="result-id">ID: {searchResult.user.user_id} — @{searchResult.user.username || 'Sin alias'}</span>
                      </div>
                    </div>
                    <p className="result-details">
                      <strong>Motivo:</strong> {searchResult.user.context || 'Reporte de estafa confirmado'}
                    </p>
                    <div className="result-footer-note">
                      Advertencia: No transfieras dinero ni entregues productos a esta persona bajo ninguna circunstancia.
                    </div>
                  </div>
                ) : (
                  <div className="result-card safe">
                    <div className="result-header">
                      <div className="result-icon-safe">
                        <IconCheck size={20} color="var(--emerald-success)" />
                      </div>
                      <div>
                        <h4>REGISTRO LIMPIO: SIN SANCIONES</h4>
                        <span className="result-id">Búsqueda: {searchResult.query}</span>
                      </div>
                    </div>
                    <p className="result-details">
                      No se encontraron denuncias de estafa registradas para este identificador en la base de datos oficial.
                    </p>
                    <div className="result-footer-note" style={{ color: 'var(--emerald-success)' }}>
                      Recomendación: Para máxima seguridad en transacciones grandes, exige siempre un Trato Admin oficial.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Escrow Simulator / Flow ── */}
      <section id="escrow" className="landing-section alt-bg">
        <div className="section-container">
          <div className="section-header-center">
            <div className="sub-badge">SISTEMA P2P PROTEGIDO</div>
            <h2>¿Cómo Funciona el Trato Admin (Escrow)?</h2>
            <p>Un flujo de 4 pasos blindados que elimina el riesgo de estafas en operaciones entre particulares.</p>
          </div>

          <div className="flow-steps-grid">
            <div className="flow-step-card">
              <div className="step-num">01</div>
              <div className="step-icon-wrap">
                <IconScale size={24} color="var(--cyan-primary)" />
              </div>
              <h3>Apertura de Trato</h3>
              <p>El comprador o vendedor inicia la solicitud en Telegram mediante <code>/trato</code> indicando el monto y las condiciones de la transacción.</p>
            </div>

            <div className="flow-step-card">
              <div className="step-num">02</div>
              <div className="step-icon-wrap">
                <IconUsers size={24} color="var(--purple-royal)" />
              </div>
              <h3>Asignación de Mediador</h3>
              <p>Un Trato Admin certificado por la comunidad toma el caso y abre de inmediato una sala privada exclusiva para ambas partes.</p>
            </div>

            <div className="flow-step-card">
              <div className="step-num">03</div>
              <div className="step-icon-wrap">
                <IconLock size={24} color="var(--amber-warning)" />
              </div>
              <h3>Custodia en Garantía</h3>
              <p>El comprador deposita los fondos bajo custodia del mediador oficial. El vendedor procede a entregar el producto o servicio acordado.</p>
            </div>

            <div className="flow-step-card">
              <div className="step-num">04</div>
              <div className="step-icon-wrap">
                <IconCheck size={24} color="var(--emerald-success)" />
              </div>
              <h3>Conformidad & Liberación</h3>
              <p>Una vez que el comprador valida la entrega a entera satisfacción, el mediador libera los fondos y se habilita la calificación del trato.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Security & Multi-Tenant Pillars ── */}
      <section id="security" className="landing-section">
        <div className="section-container">
          <div className="section-header-center">
            <div className="sub-badge">DEFENSA PERIMETRAL ACTIVA</div>
            <h2>Arquitectura Tecnológica del Ecosistema</h2>
            <p>Herramientas automáticas desarrolladas para mantener la integridad de nuestros grupos las 24 horas.</p>
          </div>

          <div className="pillars-grid">
            <div className="pillar-card">
              <div className="pillar-icon">
                <IconShield size={22} color="var(--cyan-primary)" />
              </div>
              <h3>Modo Pánico & Anti-Raid DEFCON 1</h3>
              <p>Vigila ráfagas repentinas de usuarios maliciosos. Ante un ataque coordinado, silencia a los atacantes en milisegundos y bloquea el chat para proteger a los miembros.</p>
            </div>

            <div className="pillar-card">
              <div className="pillar-icon">
                <IconAlertTriangle size={22} color="var(--rose-danger)" />
              </div>
              <h3>GBan Sincronizado en Red</h3>
              <p>Cuando un estafador es sancionado, el sistema ejecuta la expulsión automática de todos los grupos y canales oficiales donde el bot opera como administrador.</p>
            </div>

            <div className="pillar-card">
              <div className="pillar-icon">
                <IconBot size={22} color="var(--purple-royal)" />
              </div>
              <h3>Motor SaaS de Sub-Bots</h3>
              <p>Permite a comunidades afiliadas lanzar su propio bot con marca personalizada, compartiendo la base de datos de seguridad y la lista negra común.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Official Directory ── */}
      <section id="directory" className="landing-section alt-bg">
        <div className="section-container">
          <div className="section-header-center">
            <div className="sub-badge">ACCESOS VERIFICADOS</div>
            <h2>Directorio Oficial de Canales y Grupos</h2>
            <p>Accede exclusivamente a través de los enlaces certificados para evitar imitaciones o clones fraudulentos.</p>
          </div>

          <div className="directory-grid">
            <div className="dir-card">
              <h3>Comunidad Central de Comercio</h3>
              <p>Punto de encuentro para comerciantes, venta de insumos, servicios y productos verificados.</p>
              <a
                href="https://t.me/VentasLibresPeruOficial"
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary btn-sm"
              >
                <span>Unirse al Grupo</span>
                <IconExternalLink size={13} />
              </a>
            </div>

            <div className="dir-card">
              <h3>Canal Público de Estafadores Quemados</h3>
              <p>Registro público inmutable de todas las denuncias comprobadas con enlaces y capturas de prueba.</p>
              <a
                href="https://t.me/quemando_ventaslibreperu"
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary btn-sm"
              >
                <span>Ver Canal de Quemados</span>
                <IconExternalLink size={13} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="footer-container">
          <div className="footer-left">
            <div className="brand-logo-area">
              <span className="brand-gem">⟡</span>
              <span className="brand-title">VENTAS LIBRES PERÚ</span>
            </div>
            <p>Plataforma de Intermediación, Inteligencia de Seguridad y Protección de Comunidades en Telegram.</p>
          </div>

          <div className="footer-right">
            <button className="btn btn-secondary btn-sm" onClick={onGoToAdmin}>
              <IconLock size={12} />
              <span>Consola Administrativa</span>
            </button>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Ventas Libres Perú. Todos los derechos reservados. Arquitectura Enterprise.</span>
        </div>
      </footer>
    </div>
  );
}
