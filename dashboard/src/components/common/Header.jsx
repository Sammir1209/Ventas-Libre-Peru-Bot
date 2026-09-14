'use client';

import { IconRefresh } from './Icons';

export default function Header({ adminKey, setAdminKey, onRefresh }) {
  return (
    <header className="top-bar">
      <div className="page-title">
        <h1>Ventas Libres Perú — Consola Central</h1>
        <p>Control operativo de seguridad, mediaciones y ecosistema de bots</p>
      </div>

      <div className="top-actions">
        <input
          type="password"
          placeholder="Clave de Administrador (x-admin-key)"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          className="input-field"
          style={{ width: '260px' }}
        />
        <button className="btn btn-secondary btn-sm" onClick={onRefresh}>
          <IconRefresh size={14} />
          <span>Actualizar Datos</span>
        </button>
      </div>
    </header>
  );
}
