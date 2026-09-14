'use client';

import { useState } from 'react';

export default function DealsSection({ deals, staff, onUpdateDeal, onCreateDeal, onDeleteDeal }) {
  const [filter, setFilter] = useState('ALL');
  const [editingDeal, setEditingDeal] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ creatorId: '', adminId: '', status: 'PENDING', description: '', counterpart: '' });

  const filteredDeals = (deals || []).filter((d) => {
    if (filter === 'ALL') return true;
    return d.status === filter;
  });

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingDeal) return;
    await onUpdateDeal(editingDeal.id, {
      adminId: editingDeal.admin_id,
      status: editingDeal.status,
      description: editingDeal.description,
      counterpart: editingDeal.counterpart,
      role: editingDeal.role,
      invite_link: editingDeal.invite_link,
    });
    setEditingDeal(null);
  };

  const handleSaveCreate = async (e) => {
    e.preventDefault();
    if (!createForm.creatorId) return;
    await onCreateDeal(createForm);
    setShowCreateModal(false);
    setCreateForm({ creatorId: '', adminId: '', status: 'PENDING', description: '', counterpart: '' });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED': return 'badge-success';
      case 'IN_PROGRESS': return 'badge-escrow';
      case 'ASSIGNED': return 'badge-admin';
      case 'PENDING': return 'badge-owner';
      case 'CANCELLED': return 'badge-danger';
      default: return 'badge-muted';
    }
  };

  return (
    <section class="panel-card">
      <div class="panel-header">
        <div class="panel-header-left">
          <h3>Tratos Admin & Sistema de Intermediación (Escrow)</h3>
          <p>Reasigna mediadores, monitorea transacciones y cambia estados de acuerdos comerciales.</p>
        </div>
        <div class="panel-toolbar">
          <div style={{ display: 'flex', gap: '6px' }}>
            {['ALL', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((tab) => (
              <button
                key={tab}
                class={`btn btn-sm ${filter === tab ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <button class="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
            ➕ Nuevo Trato
          </button>
        </div>
      </div>

      <div class="table-responsive">
        <table class="custom-table">
          <thead>
            <tr>
              <th>ID Trato</th>
              <th>Creador</th>
              <th>Contraparte</th>
              <th>Mediador Asignado</th>
              <th>Estado</th>
              <th>Detalles</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredDeals.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-subtle)' }}>
                  No hay tratos en la categoría seleccionada.
                </td>
              </tr>
            ) : (
              filteredDeals.map((d) => (
                <tr key={d.id}>
                  <td>
                    <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan-primary)', fontWeight: 'bold' }}>
                      #{d.id}
                    </code>
                  </td>
                  <td>
                    <span>ID: <code>{d.creator_id}</code></span>
                    {d.creator_username && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>@{d.creator_username}</div>}
                  </td>
                  <td>
                    <span style={{ color: 'var(--text-main)', fontSize: '13px' }}>
                      {d.counterpart || '—'}
                    </span>
                  </td>
                  <td>
                    {d.admin_id ? (
                      <span class="badge badge-admin">
                        👤 Admin #{d.admin_id}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--amber-warning)', fontSize: '12px' }}>
                        ⏳ Sin Asignar
                      </span>
                    )}
                  </td>
                  <td>
                    <span class={`badge ${getStatusBadge(d.status)}`}>
                      {d.status || 'PENDING'}
                    </span>
                  </td>
                  <td>
                    <div style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '13px', color: 'var(--text-muted)' }}>
                      {d.description || 'Sin notas'}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        class="btn btn-secondary btn-sm"
                        onClick={() => setEditingDeal({ ...d })}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        class="btn btn-danger btn-sm"
                        onClick={() => onDeleteDeal(d.id)}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Editar Trato */}
      {editingDeal && (
        <div class="modal-overlay" onClick={() => setEditingDeal(null)}>
          <div class="modal-content" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h3>Editar Trato #{editingDeal.id}</h3>
              <button class="btn btn-secondary btn-sm" onClick={() => setEditingDeal(null)}>✕</button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div class="modal-body">
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                    Reasignar Mediador Oficial (Trato Admin)
                  </label>
                  <select
                    class="select-field"
                    value={editingDeal.admin_id || ''}
                    onChange={(e) => setEditingDeal({ ...editingDeal, admin_id: e.target.value })}
                  >
                    <option value="">— Ninguno (Pendiente de Asignar) —</option>
                    {(staff || []).map((s) => (
                      <option key={s.user_id} value={s.user_id}>
                        {s.first_name || 'Admin'} (@{s.username || s.user_id}) — {s.role}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                    Estado del Trato
                  </label>
                  <select
                    class="select-field"
                    value={editingDeal.status || 'PENDING'}
                    onChange={(e) => setEditingDeal({ ...editingDeal, status: e.target.value })}
                  >
                    <option value="PENDING">PENDING (En espera de admin)</option>
                    <option value="ASSIGNED">ASSIGNED (Admin asignado)</option>
                    <option value="IN_PROGRESS">IN_PROGRESS (En mediación activa)</option>
                    <option value="COMPLETED">COMPLETED (Completado con éxito)</option>
                    <option value="CANCELLED">CANCELLED (Cancelado / Reembolsado)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                    Contraparte (@username o ID)
                  </label>
                  <input
                    type="text"
                    class="input-field"
                    value={editingDeal.counterpart || ''}
                    onChange={(e) => setEditingDeal({ ...editingDeal, counterpart: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                    Descripción o Términos del Trato
                  </label>
                  <textarea
                    rows={3}
                    class="textarea-field"
                    value={editingDeal.description || ''}
                    onChange={(e) => setEditingDeal({ ...editingDeal, description: e.target.value })}
                  />
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onClick={() => setEditingDeal(null)}>Cancelar</button>
                <button type="submit" class="btn btn-primary">Guardar Modificaciones</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Crear Trato */}
      {showCreateModal && (
        <div class="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div class="modal-content" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h3>Crear Trato Administrativo</h3>
              <button class="btn btn-secondary btn-sm" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveCreate}>
              <div class="modal-body">
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                    ID de Telegram del Creador *
                  </label>
                  <input
                    type="number"
                    required
                    class="input-field"
                    placeholder="Ej. 987654321"
                    value={createForm.creatorId}
                    onChange={(e) => setCreateForm({ ...createForm, creatorId: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                    Asignar Trato Admin
                  </label>
                  <select
                    class="select-field"
                    value={createForm.adminId}
                    onChange={(e) => setCreateForm({ ...createForm, adminId: e.target.value })}
                  >
                    <option value="">— Sin asignar de momento —</option>
                    {(staff || []).map((s) => (
                      <option key={s.user_id} value={s.user_id}>
                        {s.first_name} (@{s.username || s.user_id})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                    Contraparte (@username)
                  </label>
                  <input
                    type="text"
                    class="input-field"
                    placeholder="@comprador_o_vendedor"
                    value={createForm.counterpart}
                    onChange={(e) => setCreateForm({ ...createForm, counterpart: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                    Detalles del Acuerdo
                  </label>
                  <textarea
                    rows={3}
                    class="textarea-field"
                    placeholder="Monto, producto, condiciones de entrega..."
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  />
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancelar</button>
                <button type="submit" class="btn btn-primary">Crear Trato</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
