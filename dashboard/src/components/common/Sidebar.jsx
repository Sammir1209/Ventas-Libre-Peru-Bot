'use client';

import {
  IconActivity,
  IconUsers,
  IconScale,
  IconAlertTriangle,
  IconBot,
  IconShield,
  IconBook,
} from './Icons';

export default function Sidebar({
  activeTab,
  setActiveTab,
  isSubBot = false,
  communityName = 'VENTAS LIBRES',
  subtitle = 'COMMAND CENTER',
}) {
  const baseNavItems = [
    { id: 'stats', label: 'Centro de Mando', icon: IconActivity },
    { id: 'channels', label: 'Canales & Enlaces', icon: IconShield },
    { id: 'groups', label: 'Grupos & Seguridad', icon: IconShield },
    { id: 'staff', label: 'Gestión de Staff', icon: IconUsers },
    { id: 'deals', label: 'Tratos & Escrow', icon: IconScale },
    { id: 'gban', label: 'Lista Negra (Sanciones)', icon: IconAlertTriangle },
    ...(!isSubBot ? [{ id: 'subbots', label: 'Instancias Sub-Bots', icon: IconBot }] : []),
    { id: 'docs', label: 'Guía de Comandos', icon: IconBook },
  ];

  return (
    <aside className="app-sidebar">
      <div className="brand-section">
        <div className="brand-badge-icon">⟡</div>
        <div className="brand-title-wrap">
          <h2 style={{ fontSize: '14px', textTransform: 'uppercase' }}>{communityName}</h2>
          <span>{subtitle}</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {baseNavItems.map((item) => {
          const IconComp = item.icon;
          return (
            <button
              key={item.id}
              className={`nav-btn ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <IconComp size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <div className="status-pill">
          <span className="pulse-dot"></span>
          <span>Red Telegram Activa</span>
        </div>
      </div>
    </aside>
  );
}
