'use client';

import {
  IconActivity,
  IconUsers,
  IconScale,
  IconAlertTriangle,
  IconBot,
  IconShield,
} from './Icons';

export default function Sidebar({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'stats', label: 'Centro de Mando', icon: IconActivity },
    { id: 'staff', label: 'Gestión de Staff', icon: IconUsers },
    { id: 'deals', label: 'Tratos & Escrow', icon: IconScale },
    { id: 'gban', label: 'Lista Negra (GBan)', icon: IconAlertTriangle },
    { id: 'subbots', label: 'Instancias Sub-Bots', icon: IconBot },
    { id: 'groups', label: 'Grupos & Seguridad', icon: IconShield },
  ];

  return (
    <aside className="app-sidebar">
      <div className="brand-section">
        <div className="brand-badge-icon">⟡</div>
        <div className="brand-title-wrap">
          <h2>VENTAS LIBRES</h2>
          <span>COMMAND CENTER</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
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
