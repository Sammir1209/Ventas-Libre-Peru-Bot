'use client';

import { useState } from 'react';
import { IconAlertTriangle, IconZap, IconEdit, IconCheck, IconPlus } from '../common/Icons';

export default function GbanSection({ burned, onAddBurned, onUpdateBurned, onRemoveBurned, onEnforceGban }) {
  const [editingUser, setEditingUser] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ userId: '', username: '', firstName: '', context: '', proofUrls: '' });
  const [enforcingId, setEnforcingId] = useState(null);

  const handleEnforce = async (userId) => {
    setEnforcingId(userId);
    await onEnforceGban(userId);
    setEnforcingId(null);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    await onUpdateBurned(editingUser.user_id, {
      context: editingUser.context,
      username: editingUser.username,
      firstName: editingUser.first_name,
    });
    setEditingUser(null);
  };

  const handleSaveAdd = async (e) => {
    e.preventDefault();
    if (!addForm.userId) return;
    const urls = addForm.proofUrls.split('\n').map(u => u.trim()).filter(Boolean);
    await onAddBurned({
      userId: addForm.userId,
      username: addForm.username,
      firstName: addForm.firstName,
      context: addForm.context,
      proofUrls: urls,
    });
    setShowAddModal(false);
    setAddForm({ userId: '', username: '', firstName: '', context: '', proofUrls: '' });
  };

  return (
    <>
      <section className="panel-card">
      <div className="panel-header">
        <div className="panel-header-left">
          <h3>Lista Negra de Estafadores (GBan Centralizado)</h3>
          <p>Supervisa usuarios vetados, administra motivos de sanción y fuerza la expulsión en todos los grupos oficiales.</p>
        </div>
        <div className="panel-toolbar">
          <button className="btn btn-danger btn-sm" onClick={() => setShowAddModal(true)}>
            <IconPlus size={14} />
            <span>Registrar GBan</span>
          </button>
        </div>
      </div>

      <div className="table-responsive">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Usuario & ID</th>
              <th>@Username</th>
              <th>Motivo / Hechos de la Estafa</th>
              <th>Reportado Por</th>
              <th>Fecha de Veto</th>
              <th>Acciones Defensivas</th>
            </tr>
          </thead>
          <tbody>
            {(!burned || burned.length === 0) ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-subtle)' }}>
                  No hay estafadores registrados en la lista negra.
                </td>
              </tr>
            ) : (
              burned.map((b) => (
                <tr key={b.user_id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{b.first_name || 'Sin nombre'}</div>
                    <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--rose-danger)', fontSize: '12px' }}>
                      {b.user_id}
                    </code>
                  </td>
                  <td>
                    {b.username ? (
                      <span style={{ color: 'var(--text-muted)' }}>@{b.username}</span>
                    ) : (
                      <span style={{ color: 'var(--text-subtle)', fontSize: '12px' }}>—</span>
                    )}
                  </td>
                  <td>
                    <div style={{ maxWidth: '300px', fontSize: '13px', color: 'var(--text-main)' }}>
                      {b.context || 'Sin descripción'}
                    </div>
                  </td>
                  <td>
                    <code style={{ fontSize: '12px' }}>{b.reported_by || 'Staff'}</code>
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {b.burned_at ? new Date(b.burned_at).toLocaleDateString() : '—'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn btn-danger btn-sm"
                        title="Expulsar de todos los grupos oficiales de la comunidad"
                        onClick={() => handleEnforce(b.user_id)}
                        disabled={enforcingId === b.user_id}
                      >
                        <IconZap size={13} />
                        <span>{enforcingId === b.user_id ? 'Baneando...' : 'Expulsar en Red'}</span>
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setEditingUser({ ...b })}
                      >
                        <IconEdit size={13} />
                        <span>Editar</span>
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ color: 'var(--emerald-success)', borderColor: 'rgba(16, 185, 129, 0.3)' }}
                        title="Revocar GBan y permitir acceso nuevamente"
                        onClick={() => onRemoveBurned(b.user_id)}
                      >
                        <IconCheck size={13} />
                        <span>Desbanear</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </section>

      {/* Modal: Editar GBan */}
      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Editar Ficha de Estafador (ID: {editingUser.user_id})</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingUser(null)}>✕</button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="modal-body">
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                    Nombre del Estafador
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={editingUser.first_name || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, first_name: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                    @Username
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={editingUser.username || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                    Motivo Detallado de la Sanción
                  </label>
                  <textarea
                    rows={4}
                    className="textarea-field"
                    value={editingUser.context || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, context: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingUser(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Actualizar Ficha</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Agregar GBan */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Registrar Estafador en Lista Negra (GBan)</h3>
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
                    Nombre o Alias
                  </label>
                  <input
                    type="text"
                    placeholder="Nombre registrado"
                    className="input-field"
                    value={addForm.firstName}
                    onChange={(e) => setAddForm({ ...addForm, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                    @Username
                  </label>
                  <input
                    type="text"
                    placeholder="@estafador"
                    className="input-field"
                    value={addForm.username}
                    onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                    Motivo / Descripción del Hecho *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Estafa por monto de S/. 200 en venta de cuenta..."
                    className="textarea-field"
                    value={addForm.context}
                    onChange={(e) => setAddForm({ ...addForm, context: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                    URLs de Pruebas (Una por línea)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="https://...supabase.co/storage/v1/..."
                    className="textarea-field"
                    value={addForm.proofUrls}
                    onChange={(e) => setAddForm({ ...addForm, proofUrls: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-danger">Confirmar GBan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
