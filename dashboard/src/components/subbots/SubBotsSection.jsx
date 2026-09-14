'use client';

import { useState } from 'react';
import { IconPlus, IconRefresh, IconTrash, IconEdit, IconActivity } from '../common/Icons';

export default function SubBotsSection({ subbots, onCreateSubBot, onUpdateSubBot, onExecuteAction, onDeleteSubBot }) {
  const [editingBot, setEditingBot] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ botToken: '', communityName: '', ownerIds: '' });
  const [loadingActionId, setLoadingActionId] = useState(null);

  const handleAction = async (id, action) => {
    setLoadingActionId(`${id}_${action}`);
    await onExecuteAction(id, action);
    setLoadingActionId(null);
  };

  const handleSaveCreate = async (e) => {
    e.preventDefault();
    if (!createForm.botToken) return;
    const owners = createForm.ownerIds.split(',').map(id => Number(id.trim())).filter(Boolean);
    await onCreateSubBot({
      botToken: createForm.botToken.trim(),
      communityName: createForm.communityName.trim() || undefined,
      ownerIds: owners,
    });
    setShowCreateModal(false);
    setCreateForm({ botToken: '', communityName: '', ownerIds: '' });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingBot) return;
    await onUpdateSubBot(editingBot.id, {
      communityName: editingBot.community_name,
      groupsFolderLink: editingBot.groups_folder_link,
      staffChatId: editingBot.staff_chat_id ? Number(editingBot.staff_chat_id) : null,
      logChannelId: editingBot.log_channel_id ? Number(editingBot.log_channel_id) : null,
    });
    setEditingBot(null);
  };

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div className="panel-header-left">
          <h3>Instancias de Sub-Bots (Motor SaaS Multi-Tenant)</h3>
          <p>Despliega y controla instancias secundarias independientes con sus propios tokens, grupos y configuraciones.</p>
        </div>
        <div className="panel-toolbar">
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
            <IconPlus size={14} />
            <span>Crear Sub-Bot</span>
          </button>
        </div>
      </div>

      <div className="table-responsive">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Bot & Comunidad</th>
              <th>Token de BotFather</th>
              <th>Estado de Instancia</th>
              <th>Propietarios (Owners)</th>
              <th>Uptime / Inicio</th>
              <th>Acciones en Caliente</th>
            </tr>
          </thead>
          <tbody>
            {(!subbots || subbots.length === 0) ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-subtle)' }}>
                  No hay sub-bots creados en el sistema.
                </td>
              </tr>
            ) : (
              subbots.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{b.community_name}</div>
                    {b.bot_username && (
                      <a
                        href={`https://t.me/${b.bot_username}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--cyan-primary)', fontSize: '13px', textDecoration: 'none' }}
                      >
                        @{b.bot_username}
                      </a>
                    )}
                  </td>
                  <td>
                    <code style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {b.bot_token_masked || '***'}
                    </code>
                  </td>
                  <td>
                    {b.is_running ? (
                      <span className="badge badge-success">
                        [ ACTIVO / ONLINE ]
                      </span>
                    ) : (
                      <span className="badge badge-muted">
                        [ DETENIDO ]
                      </span>
                    )}
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {Array.isArray(b.owner_ids) && b.owner_ids.length > 0 ? b.owner_ids.join(', ') : 'Global'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>
                      {b.started_at ? new Date(b.started_at).toLocaleTimeString() : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {b.is_running ? (
                        <>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ color: 'var(--amber-warning)' }}
                            onClick={() => handleAction(b.id, 'restart')}
                            disabled={loadingActionId === `${b.id}_restart`}
                          >
                            <IconRefresh size={12} />
                            <span>Reiniciar</span>
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ color: 'var(--rose-danger)' }}
                            onClick={() => handleAction(b.id, 'stop')}
                            disabled={loadingActionId === `${b.id}_stop`}
                          >
                            <IconActivity size={12} />
                            <span>Detener</span>
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleAction(b.id, 'start')}
                          disabled={loadingActionId === `${b.id}_start`}
                        >
                          <IconActivity size={12} />
                          <span>Iniciar</span>
                        </button>
                      )}
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setEditingBot({ ...b })}
                      >
                        <IconEdit size={12} />
                        <span>Config</span>
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => onDeleteSubBot(b.id)}
                      >
                        <IconTrash size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Crear Sub-Bot */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Crear Nueva Instancia de Sub-Bot</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveCreate}>
              <div className="modal-body">
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                    Token de BotFather (Telegram API) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="123456789:ABCdefGhIJKlmNoPQRstUVwxyZ"
                    className="input-field"
                    value={createForm.botToken}
                    onChange={(e) => setCreateForm({ ...createForm, botToken: e.target.value })}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '4px', display: 'block' }}>
                    El sistema validará el token automáticamente con Telegram al guardar.
                  </span>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                    Nombre de la Comunidad o Proyecto
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Red de Ventas Chiclayo"
                    className="input-field"
                    value={createForm.communityName}
                    onChange={(e) => setCreateForm({ ...createForm, communityName: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                    IDs de Telegram de los Owners (Separados por coma)
                  </label>
                  <input
                    type="text"
                    placeholder="7794982496, 7849224682"
                    className="input-field"
                    value={createForm.ownerIds}
                    onChange={(e) => setCreateForm({ ...createForm, ownerIds: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar & Lanzar Bot</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Configurar Sub-Bot */}
      {editingBot && (
        <div className="modal-overlay" onClick={() => setEditingBot(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Configuración de Sub-Bot: {editingBot.community_name}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingBot(null)}>✕</button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="modal-body">
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                    Nombre de la Comunidad
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={editingBot.community_name || ''}
                    onChange={(e) => setEditingBot({ ...editingBot, community_name: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                    Enlace de Carpeta de Grupos de Telegram
                  </label>
                  <input
                    type="text"
                    placeholder="https://t.me/addlist/..."
                    className="input-field"
                    value={editingBot.groups_folder_link || ''}
                    onChange={(e) => setEditingBot({ ...editingBot, groups_folder_link: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                    ID de Chat de Staff
                  </label>
                  <input
                    type="text"
                    placeholder="-100..."
                    className="input-field"
                    value={editingBot.staff_chat_id || ''}
                    onChange={(e) => setEditingBot({ ...editingBot, staff_chat_id: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                    ID de Canal de Logs
                  </label>
                  <input
                    type="text"
                    placeholder="-100..."
                    className="input-field"
                    value={editingBot.log_channel_id || ''}
                    onChange={(e) => setEditingBot({ ...editingBot, log_channel_id: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingBot(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Ajustes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
