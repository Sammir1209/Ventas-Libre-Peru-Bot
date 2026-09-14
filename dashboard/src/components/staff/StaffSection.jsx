'use client';

import { useState } from 'react';
import { IconZap, IconEdit, IconTrash, IconPlus, IconAlertTriangle } from '../common/Icons';

export default function StaffSection({ staff, onSyncStaff, onUpdateStaff, onAddStaff, onDeleteStaff }) {
  const [editingMember, setEditingMember] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ userId: '', username: '', firstName: '', role: 'ADMIN', customTitle: '' });
  const [syncingId, setSyncingId] = useState(null);

  const handleSync = async (userId) => {
    setSyncingId(userId);
    await onSyncStaff(userId);
    setSyncingId(null);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingMember) return;
    await onUpdateStaff(editingMember.user_id, {
      username: editingMember.username,
      firstName: editingMember.first_name,
      role: editingMember.role,
      customTitle: editingMember.custom_title,
    });
    setEditingMember(null);
  };

  const handleSaveAdd = async (e) => {
    e.preventDefault();
    if (!addForm.userId) return;
    await onAddStaff(addForm);
    setShowAddModal(false);
    setAddForm({ userId: '', username: '', firstName: '', role: 'ADMIN', customTitle: '' });
  };

  const getRoleBadge = (role) => {
    const r = (role || '').toUpperCase();
    if (r.includes('OWNER')) return 'badge-owner';
    if (r.includes('TRATO')) return 'badge-escrow';
    return 'badge-admin';
  };

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div className="panel-header-left">
          <h3>Gestión Oficial de Staff & Mediadores</h3>
          <p>Supervisa administradores, sincroniza cambios de @ de Telegram en vivo y asigna rangos.</p>
        </div>
        <div className="panel-toolbar">
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
            <IconPlus size={14} />
            <span>Nuevo Staff</span>
          </button>
        </div>
      </div>

      <div className="table-responsive">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Usuario & Nombre</th>
              <th>ID Telegram</th>
              <th>@Username</th>
              <th>Rango / Rol</th>
              <th>Título Custom</th>
              <th>Acciones en Vivo</th>
            </tr>
          </thead>
          <tbody>
            {(!staff || staff.length === 0) ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-subtle)' }}>
                  No hay miembros de staff registrados.
                </td>
              </tr>
            ) : (
              staff.map((m) => (
                <tr key={m.user_id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '34px', height: '34px', borderRadius: '50%',
                        background: 'rgba(6, 182, 212, 0.15)', color: 'var(--cyan-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
                      }}>
                        {(m.first_name || 'S').charAt(0)}
                      </div>
                      <span style={{ fontWeight: 600 }}>{m.first_name || 'Sin nombre'}</span>
                    </div>
                  </td>
                  <td>
                    <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan-primary)' }}>
                      {m.user_id}
                    </code>
                  </td>
                  <td>
                    {m.username ? (
                      <a
                        href={`https://t.me/${m.username}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--cyan-primary)', textDecoration: 'none' }}
                      >
                        @{m.username}
                      </a>
                    ) : (
                      <span style={{ color: 'var(--amber-warning)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <IconAlertTriangle size={12} /> Sin @
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${getRoleBadge(m.role)}`}>
                      {m.role || 'STAFF'}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                      {m.custom_title || '—'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn btn-sync btn-sm"
                        title="Consultar en Telegram si cambió de @ o nombre"
                        onClick={() => handleSync(m.user_id)}
                        disabled={syncingId === m.user_id}
                      >
                        <IconZap size={13} />
                        <span>{syncingId === m.user_id ? 'Sincronizando...' : 'Sync @ Telegram'}</span>
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setEditingMember({ ...m })}
                      >
                        <IconEdit size={13} />
                        <span>Editar</span>
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => onDeleteStaff(m.user_id)}
                      >
                        <IconTrash size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Editar Staff */}
      {editingMember && (
        <div className="modal-overlay" onClick={() => setEditingMember(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Editar Staff: {editingMember.first_name || editingMember.user_id}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingMember(null)}>✕</button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="modal-body">
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                    ID de Telegram (Solo Lectura)
                  </label>
                  <input type="text" className="input-field" value={editingMember.user_id} disabled />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                    Nombre / Display Name
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={editingMember.first_name || ''}
                    onChange={(e) => setEditingMember({ ...editingMember, first_name: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                    @Username de Telegram
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="@usuario"
                    value={editingMember.username || ''}
                    onChange={(e) => setEditingMember({ ...editingMember, username: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                    Rol / Rango
                  </label>
                  <select
                    className="select-field"
                    value={editingMember.role || 'ADMIN'}
                    onChange={(e) => setEditingMember({ ...editingMember, role: e.target.value })}
                  >
                    <option value="OWNER">OWNER</option>
                    <option value="CO-OWNER">CO-OWNER</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="TRATO ADMIN">TRATO ADMIN (Mediador)</option>
                    <option value="MODERADOR">MODERADOR</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                    Título Personalizado
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Ej. Mediador Principal"
                    value={editingMember.custom_title || ''}
                    onChange={(e) => setEditingMember({ ...editingMember, custom_title: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingMember(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Agregar Staff */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Agregar Nuevo Miembro al Staff</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveAdd}>
              <div className="modal-body">
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                    ID Numérico de Telegram *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="Ej. 123456789"
                    className="input-field"
                    value={addForm.userId}
                    onChange={(e) => setAddForm({ ...addForm, userId: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                    @Username (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="@usuario"
                    className="input-field"
                    value={addForm.username}
                    onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                    Rol / Cargo *
                  </label>
                  <select
                    className="select-field"
                    value={addForm.role}
                    onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                  >
                    <option value="TRATO ADMIN">TRATO ADMIN (Mediador)</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="CO-OWNER">CO-OWNER</option>
                    <option value="OWNER">OWNER</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar en Staff</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
