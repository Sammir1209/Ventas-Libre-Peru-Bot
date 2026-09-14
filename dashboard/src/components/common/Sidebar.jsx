'use client';

export default function Sidebar({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'stats', label: 'Centro de Mando', icon: '📊' },
    { id: 'staff', label: 'Gestión de Staff', icon: '👑' },
    { id: 'deals', label: 'Tratos & Escrow', icon: '🤝' },
    { id: 'gban', label: 'Lista Negra (GBan)', icon: '🚨' },
    { id: 'subbots', label: 'Instancias Sub-Bots', icon: '🤖' },
    { id: 'groups', label: 'Grupos & Seguridad', icon: '🛡️' },
  ];

  return (
    <aside class="app-sidebar">
      <div class="brand-section">
        <div class="brand-badge-icon">⟡</div>
        <div class="brand-title-wrap">
          <h2>VENTAS LIBRES</h2>
          <span>COMMAND CENTER</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            class={`nav-btn ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
          >
            <span style={{ fontSize: '18px' }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div class="sidebar-bottom">
        <div class="status-pill">
          <span class="pulse-dot"></span>
          <span>Red Telegram Activa</span>
        </div>
      </div>
    </aside>
  );
}
