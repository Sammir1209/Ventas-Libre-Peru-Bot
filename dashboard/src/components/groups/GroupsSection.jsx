'use client';

import { useState } from 'react';
import { IconPlus, IconTrash, IconX, IconAlertTriangle, IconShield, IconZap, IconCheck } from '../common/Icons';

export default function GroupsSection({
  groups = [],
  onAddGroup = null,
  onRemoveGroup = null,
  onReverifyGroup = null,
  isSubBot = false,
  botUsername = null,
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    chatId: '',
    title: '',
    type: 'channel',
    username: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [formError, setFormError] = useState(null);

  // Estados de Modal de Re-Verificación / Auditoría Masiva
  const [reverifyModalGroup, setReverifyModalGroup] = useState(null);
  const [isReverifying, setIsReverifying] = useState(false);
  const [reverifyError, setReverifyError] = useState(null);

  const handleOpenModal = () => {
    setFormData({ chatId: '', title: '', type: 'channel', username: '' });
    setFormError(null);
    setShowAddModal(true);
  };

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setShowAddModal(false);
    setFormError(null);
  };

  const handleSubmitAdd = async (e) => {
    e.preventDefault();
    if (!formData.chatId.trim()) {
      setFormError('Ingresa el ID de Telegram o el @username del canal/grupo.');
      return;
    }

    if (!onAddGroup) {
      setFormError('La acción de vincular no está disponible.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      await onAddGroup({
        chatId: formData.chatId.trim(),
        title: formData.title.trim() || undefined,
        type: formData.type,
        username: formData.username.trim() || undefined,
      });
      setShowAddModal(false);
    } catch (err) {
      setFormError(err.message || 'Error al vincular el canal o grupo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (group) => {
    const chatTitle = group.title || group.chat_id;
    const confirmMsg = `¿Estás seguro de desvincular "${chatTitle}" (${group.chat_id})?\n\nDejará de pertenecer a los canales y grupos oficiales registrados en el sistema.`;
    if (!window.confirm(confirmMsg)) return;

    if (!onRemoveGroup) return;

    setRemovingId(group.chat_id);
    try {
      await onRemoveGroup(group.chat_id, chatTitle);
    } catch (err) {
      console.error('Error al desvincular grupo:', err);
    } finally {
      setRemovingId(null);
    }
  };

  const handleToggleReverify = async (mode) => {
    if (!reverifyModalGroup || !onReverifyGroup) return;

    setIsReverifying(true);
    setReverifyError(null);

    try {
      await onReverifyGroup(reverifyModalGroup.chat_id, mode);
      setReverifyModalGroup(null);
    } catch (err) {
      setReverifyError(err.message || 'Error al procesar la auditoría de miembros.');
    } finally {
      setIsReverifying(false);
    }
  };

  return (
    <>
      <section className="panel-card">
        <div className="panel-header">
          <div className="panel-header-left">
            <h3>Grupos Oficiales & Protocolos de Seguridad en Vivo</h3>
            <p>Supervisa los chats conectados, ejecuta auditorías de miembros antiguos y gestiona canales oficiales.</p>
          </div>
          {onAddGroup && (
            <div className="panel-toolbar">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleOpenModal}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <IconPlus size={14} />
                <span>Vincular Canal / Grupo</span>
              </button>
            </div>
          )}
        </div>

        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Título del Chat</th>
                <th>ID de Telegram</th>
                <th>Tipo</th>
                <th>@Username</th>
                <th>Fecha Registro</th>
                {(onRemoveGroup || onReverifyGroup) && (
                  <th style={{ textAlign: 'center', minWidth: '160px' }}>Acciones</th>
                )}
              </tr>
            </thead>
            <tbody>
              {(!groups || groups.length === 0) ? (
                <tr>
                  <td
                    colSpan={(onRemoveGroup || onReverifyGroup) ? 6 : 5}
                    style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-subtle)' }}
                  >
                    No hay grupos ni canales oficiales vinculados. Utiliza el botón <strong>"Vincular Canal / Grupo"</strong> para conectar tu primer chat a la red.
                  </td>
                </tr>
              ) : (
                groups.map((g) => (
                  <tr key={g.chat_id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {g.title || 'Grupo sin título'}
                        </div>
                        {g.isReverifyActive && (
                          <span
                            className="badge badge-warning"
                            style={{ fontSize: '10px', padding: '2px 6px', fontWeight: 600 }}
                            title="Auditoría de miembros antiguos activa en este chat"
                          >
                            Auditoría Activa
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan-primary)' }}>
                        {g.chat_id}
                      </code>
                    </td>
                    <td>
                      <span className="badge badge-muted" style={{ textTransform: 'capitalize' }}>
                        {g.type || 'supergroup'}
                      </span>
                    </td>
                    <td>
                      {g.username ? (
                        <a
                          href={`https://t.me/${String(g.username).replace(/^@/, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'var(--cyan-primary)', textDecoration: 'none', fontWeight: 500 }}
                        >
                          @{String(g.username).replace(/^@/, '')}
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-subtle)', fontSize: '12px' }}>Privado</span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {g.added_at ? new Date(g.added_at).toLocaleDateString() : '—'}
                      </span>
                    </td>
                    {(onRemoveGroup || onReverifyGroup) && (
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {/* Botón de Auditoría / Re-verificación (Solo para grupos/supergrupos) */}
                          {onReverifyGroup && g.type !== 'channel' && (
                            <button
                              type="button"
                              className={`btn btn-sm ${g.isReverifyActive ? 'btn-warning' : 'btn-secondary'}`}
                              onClick={() => {
                                setReverifyModalGroup(g);
                                setReverifyError(null);
                              }}
                              style={{
                                padding: '4px 8px',
                                fontSize: '11px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                borderRadius: '6px',
                                fontWeight: 600,
                              }}
                              title="Auditoría de miembros antiguos: Silencia a no unidos y pide verificación sin tocar a los ya verificados"
                            >
                              <IconShield size={12} />
                              <span>{g.isReverifyActive ? 'Auditando' : 'Auditar'}</span>
                            </button>
                          )}

                          {/* Botón Quitar */}
                          {onRemoveGroup && (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              disabled={removingId === g.chat_id}
                              onClick={() => handleRemove(g)}
                              style={{
                                padding: '4px 8px',
                                fontSize: '11px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                borderRadius: '6px',
                                fontWeight: 600,
                              }}
                              title="Quitar chat de la red oficial"
                            >
                              <IconTrash size={12} />
                              <span>{removingId === g.chat_id ? '...' : 'Quitar'}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal: Vincular Nuevo Canal o Grupo */}
      {showAddModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '520px', width: '92%' }}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(0, 240, 255, 0.1)',
                  border: '1px solid rgba(0, 240, 255, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--cyan-primary)'
                }}>
                  <IconPlus size={16} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px' }}>Vincular Canal o Grupo Oficial</h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>
                    {isSubBot ? 'Conectar canal/grupo al sub-bot' : 'Conectar chat a la red central de Ventas Libres Perú'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleCloseModal}
                disabled={isSubmitting}
                style={{ padding: '4px 8px' }}
              >
                <IconX size={14} />
              </button>
            </div>

            <form onSubmit={handleSubmitAdd}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {formError && (
                  <div style={{
                    background: 'rgba(255, 59, 92, 0.1)',
                    border: '1px solid rgba(255, 59, 92, 0.3)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#ff4d6d',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    <IconAlertTriangle size={16} />
                    <span>{formError}</span>
                  </div>
                )}

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                    ID de Telegram o @Username del Canal/Grupo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. -10024243437464 o @quemando_ventaslibreperu"
                    className="input-field"
                    value={formData.chatId}
                    onChange={(e) => setFormData({ ...formData, chatId: e.target.value })}
                    autoFocus
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Puedes ingresar el ID numérico (-100...), el @username o el link (t.me/canal).
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                      Tipo de Chat
                    </label>
                    <select
                      className="select-field"
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    >
                      <option value="channel">Canal (Broadcast)</option>
                      <option value="supergroup">Supergrupo</option>
                      <option value="group">Grupo Estándar</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                      Título o Nombre (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Autodetectado de Telegram"
                      className="input-field"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  fontSize: '12px',
                  lineHeight: '1.5',
                  color: 'var(--text-subtle)',
                }}>
                  <strong style={{ color: 'var(--cyan-primary)', display: 'block', marginBottom: '4px' }}>
                    🛡️ Importante para que funcione en vivo:
                  </strong>
                  Asegúrate de haber agregado a {botUsername ? <strong>@{botUsername}</strong> : 'tu bot'} como <strong>Administrador</strong> en el canal o grupo para que pueda leer títulos, validar usuarios y operar con total seguridad.
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {isSubmitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      <span>Vinculando...</span>
                    </>
                  ) : (
                    <>
                      <IconPlus size={14} />
                      <span>Vincular a la Red</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Auditoría & Re-verificación de Miembros Antiguos */}
      {reverifyModalGroup && (
        <div className="modal-overlay" onClick={() => !isReverifying && setReverifyModalGroup(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '540px', width: '92%' }}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: reveriveBgColor(reverifyModalGroup.isReverifyActive),
                  border: '1px solid rgba(255, 170, 0, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffaa00'
                }}>
                  <IconShield size={16} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px' }}>Auditoría & Re-verificación de Miembros</h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>
                    {reverifyModalGroup.title || reverifyModalGroup.chat_id}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => !isReverifying && setReverifyModalGroup(null)}
                disabled={isReverifying}
                style={{ padding: '4px 8px' }}
              >
                <IconX size={14} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {reverifyError && (
                <div style={{
                  background: 'rgba(255, 59, 92, 0.1)',
                  border: '1px solid rgba(255, 59, 92, 0.3)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  color: '#ff4d6d',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <IconAlertTriangle size={16} />
                  <span>{reverifyError}</span>
                </div>
              )}

              <div style={{
                background: reverifyModalGroup.isReverifyActive ? 'rgba(255, 170, 0, 0.08)' : 'rgba(0, 240, 255, 0.05)',
                border: `1px solid ${reverifyModalGroup.isReverifyActive ? 'rgba(255, 170, 0, 0.3)' : 'rgba(0, 240, 255, 0.2)'}`,
                borderRadius: '10px',
                padding: '14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-subtle)' }}>
                    Estado de Auditoría en el Grupo:
                  </span>
                  <span
                    className={`badge ${reverifyModalGroup.isReverifyActive ? 'badge-warning' : 'badge-muted'}`}
                    style={{ fontSize: '11px', fontWeight: 700 }}
                  >
                    {reverifyModalGroup.isReverifyActive ? '🔒 ACTIVA (PROTEGIDO)' : 'INACTIVA (NORMAL)'}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                  {reverifyModalGroup.isReverifyActive
                    ? 'El bot está auditando los mensajes. Solo los miembros que no estén unidos o verificados son silenciados al intentar hablar.'
                    : 'El grupo opera normalmente. Puedes activar la auditoría para exigir a miembros antiguos que se unan a los canales requeridos.'}
                </p>
              </div>

              {/* Reglas Clave */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '10px',
                padding: '14px',
                fontSize: '12px',
                lineHeight: '1.6',
                color: 'var(--text-subtle)',
              }}>
                <div style={{ color: 'var(--cyan-primary)', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <IconCheck size={14} />
                  <span>Reglas de Protección Inteligente:</span>
                </div>
                <ul style={{ margin: 0, paddingLeft: '18px' }}>
                  <li>
                    <strong style={{ color: '#fff' }}>Miembros ya verificados o unidos:</strong> Seguirán hablando libremente sin ser interrumpidos ni requerirles nada.
                  </li>
                  <li>
                    <strong style={{ color: '#ffaa00' }}>Miembros antiguos NO unidos:</strong> Al intentar hablar, su mensaje se elimina, se les silencia preventivamente y se les notifica por privado (DM) y con aviso temporal en el grupo (auto-eliminable en 15s).
                  </li>
                  <li>
                    <strong style={{ color: '#fff' }}>Banner Fijado:</strong> El bot publica y fija un mensaje con botón interactivo para que cualquier miembro verifique sus canales con un solo toque.
                  </li>
                </ul>
              </div>
            </div>

            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setReverifyModalGroup(null)}
                disabled={isReverifying}
              >
                Cerrar
              </button>

              {reverifyModalGroup.isReverifyActive ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isReverifying}
                  onClick={() => handleToggleReverify('unlock')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  }}
                >
                  {isReverifying ? 'Desactivando...' : '🔓 Desactivar Auditoría'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-warning"
                  disabled={isReverifying}
                  onClick={() => handleToggleReverify('lock')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'linear-gradient(135deg, #ff9900, #ff5500)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                  }}
                >
                  <IconZap size={14} />
                  <span>{isReverifying ? 'Activando...' : '🔒 Activar Auditoría de Miembros'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function reveriveBgColor(isActive) {
  return isActive ? 'rgba(255, 170, 0, 0.15)' : 'rgba(0, 240, 255, 0.1)';
}
