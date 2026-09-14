'use client';

export default function Header({ adminKey, setAdminKey, onRefresh }) {
  return (
    <header class="top-bar">
      <div class="page-title">
        <h1>Ventas Libres Perú — Consola Central</h1>
        <p>Control operativo de seguridad, mediaciones y ecosistema de bots</p>
      </div>

      <div class="top-actions">
        <input
          type="password"
          placeholder="Clave de Administrador (x-admin-key)"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          class="input-field"
          style={{ width: '260px' }}
        />
        <button class="btn btn-secondary btn-sm" onClick={onRefresh}>
          🔄 Actualizar Datos
        </button>
      </div>
    </header>
  );
}
