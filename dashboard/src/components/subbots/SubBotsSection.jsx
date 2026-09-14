'use client';

import { useState } from 'react';
import {
  IconPlus,
  IconRefresh,
  IconTrash,
  IconEdit,
  IconActivity,
  IconBot,
  IconShield,
  IconScale,
  IconAlertTriangle,
  IconUsers,
} from '../common/Icons';

const TABS = [
  { id: 'identidad', label: 'Identidad & Token', icon: IconBot },
  { id: 'canales', label: 'Canales & Enlaces', icon: IconUsers },
  { id: 'staff_logs', label: 'Staff & Logs', icon: IconShield },
  { id: 'gban_escrow', label: 'GBan & Escrow', icon: IconScale },
  { id: 'seguridad', label: 'Seguridad & Filtros', icon: IconAlertTriangle },
];

const initialCreateForm = {
  // 1. Identidad
  botToken: '',
  communityName: '',
  ownerIds: '',
  planStatus: 'ACTIVE',
  expiresAt: '',
  autoStart: true,

  // 2. Canales & Enlaces
  channelsToVerify: '',
  groupsFolderLink: '',
  verifyWebUrl: '',

  // 3. Staff & Logs
  staffChatId: '',
  staffThreadId: '',
  logChannelId: '',
  logThreadId: '',

  // 4. GBan & Escrow
  burnChatId: '',
  burnThreadId: '',
  publicBurnChannelId: '',
  publicBurnThreadId: '',
  escrowGroupId: '',
  escrowCommission: 10,
  escrowTerms: '',

  // 5. Seguridad & Filtros
  defconLevel: 'NORMAL',
  antiSpam: true,
  antiFlood: true,
  antiLinks: true,
  welcomeMessage: '',
};

export default function SubBotsSection({ subbots, onCreateSubBot, onUpdateSubBot, onExecuteAction, onDeleteSubBot }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createActiveTab, setCreateActiveTab] = useState('identidad');
  const [createForm, setCreateForm] = useState(initialCreateForm);

  const [editingBot, setEditingBot] = useState(null);
  const [editActiveTab, setEditActiveTab] = useState('identidad');
  const [editForm, setEditForm] = useState(null);

  const [loadingActionId, setLoadingActionId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAction = async (id, action) => {
    setLoadingActionId(`${id}_${action}`);
    await onExecuteAction(id, action);
    setLoadingActionId(null);
  };

  const handleOpenEdit = (bot) => {
    const cs = bot.custom_settings || {};
    setEditForm({
      id: bot.id,
      botToken: '',
      communityName: bot.community_name || '',
      ownerIds: Array.isArray(bot.owner_ids) ? bot.owner_ids.join(', ') : '',
      planStatus: bot.plan_status || 'ACTIVE',
      expiresAt: bot.expires_at ? bot.expires_at.split('T')[0] : '',

      channelsToVerify: Array.isArray(bot.channels_to_verify) ? bot.channels_to_verify.join('\n') : '',
      groupsFolderLink: bot.groups_folder_link || '',
      verifyWebUrl: cs.verify_web_url || '',

      staffChatId: bot.staff_chat_id || '',
      staffThreadId: bot.staff_thread_id || '',
      logChannelId: bot.log_channel_id || '',
      logThreadId: bot.log_thread_id || '',

      burnChatId: bot.burn_chat_id || '',
      burnThreadId: bot.burn_thread_id || '',
      publicBurnChannelId: bot.public_burn_channel_id || '',
      publicBurnThreadId: bot.public_burn_thread_id || '',
      escrowGroupId: bot.escrow_group_id || '',
      escrowCommission: cs.escrow_commission !== undefined ? cs.escrow_commission : 10,
      escrowTerms: cs.escrow_terms || '',

      defconLevel: cs.defcon_level || 'NORMAL',
      antiSpam: cs.anti_spam !== undefined ? cs.anti_spam : true,
      antiFlood: cs.anti_flood !== undefined ? cs.anti_flood : true,
      antiLinks: cs.anti_links !== undefined ? cs.anti_links : true,
      welcomeMessage: cs.welcome_message || '',
    });
    setEditingBot(bot);
    setEditActiveTab('identidad');
  };

  const handleSaveCreate = async (e) => {
    e.preventDefault();
    if (!createForm.botToken.trim()) return;

    setIsSubmitting(true);
    try {
      await onCreateSubBot({
        ...createForm,
        botToken: createForm.botToken.trim(),
        communityName: createForm.communityName.trim() || undefined,
      });
      setShowCreateModal(false);
      setCreateForm(initialCreateForm);
      setCreateActiveTab('identidad');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editForm) return;

    setIsSubmitting(true);
    try {
      const payload = { ...editForm };
      if (!payload.botToken.trim()) delete payload.botToken;
      await onUpdateSubBot(editForm.id, payload);
      setEditingBot(null);
      setEditForm(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <section className="panel-card">
        <div className="panel-header">
          <div className="panel-header-left">
            <h3>Instancias de Sub-Bots (Motor SaaS Multi-Tenant)</h3>
            <p>Despliega y controla instancias secundarias independientes con sus propios tokens, grupos, logs y configuraciones completas.</p>
          </div>
          <div className="panel-toolbar">
            <button className="btn btn-primary btn-sm" onClick={() => { setShowCreateModal(true); setCreateActiveTab('identidad'); }}>
              <IconPlus size={14} />
              <span>Crear Sub-Bot Completo</span>
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
                <th>Plan & Vigencia</th>
                <th>Propietarios (Owners)</th>
                <th>Uptime / Inicio</th>
                <th>Acciones en Caliente</th>
              </tr>
            </thead>
            <tbody>
              {(!subbots || subbots.length === 0) ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-subtle)' }}>
                    No hay sub-bots creados en el sistema. Pulsa en "Crear Sub-Bot Completo" para lanzar una instancia.
                  </td>
                </tr>
              ) : (
                subbots.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{b.community_name}</div>
                      {b.bot_username ? (
                        <a
                          href={`https://t.me/${b.bot_username}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'var(--cyan-primary)', fontSize: '13px', textDecoration: 'none' }}
                        >
                          @{b.bot_username}
                        </a>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>Sin username</span>
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
                      <span className={`badge ${b.plan_status === 'ACTIVE' ? 'badge-admin' : b.plan_status === 'TRIAL' ? 'badge-escrow' : 'badge-danger'}`}>
                        {b.plan_status || 'ACTIVE'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {Array.isArray(b.owner_ids) && b.owner_ids.length > 0 ? b.owner_ids.join(', ') : 'Heredado'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>
                        {b.started_at ? new Date(b.started_at).toLocaleTimeString() : '—'}
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
                              title="Reiniciar instancia en caliente"
                            >
                              <IconRefresh size={12} />
                              <span>Reiniciar</span>
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ color: 'var(--rose-danger)' }}
                              onClick={() => handleAction(b.id, 'stop')}
                              disabled={loadingActionId === `${b.id}_stop`}
                              title="Detener polling del bot"
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
                            title="Iniciar bot en Telegram"
                          >
                            <IconActivity size={12} />
                            <span>Iniciar</span>
                          </button>
                        )}
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenEdit(b)}
                          title="Ajustes completos del Sub-Bot"
                        >
                          <IconEdit size={12} />
                          <span>Config</span>
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => onDeleteSubBot(b.id)}
                          title="Eliminar Sub-Bot"
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
      </section>

      {/* ── Modal: Crear Sub-Bot Completo ── */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content modal-content-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Crear & Desplegar Nueva Instancia de Sub-Bot</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, marginTop: '2px' }}>
                  Configura la identidad, canales perimetrales, staff, escrow y filtros de seguridad.
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>

            {/* Pestañas de Navegación */}
            <div className="modal-tabs">
              {TABS.map((t) => {
                const TabIcon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`modal-tab-btn ${createActiveTab === t.id ? 'active' : ''}`}
                    onClick={() => setCreateActiveTab(t.id)}
                  >
                    <TabIcon size={14} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleSaveCreate}>
              <div className="modal-body" style={{ minHeight: '340px' }}>
                {/* Tab 1: Identidad & Token */}
                {createActiveTab === 'identidad' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">
                        Token de BotFather (Telegram Bot API) *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="123456789:ABCdefGhIJKlmNoPQRstUVwxyZ"
                        className="input-field"
                        style={{ fontFamily: 'var(--font-mono)' }}
                        value={createForm.botToken}
                        onChange={(e) => setCreateForm({ ...createForm, botToken: e.target.value })}
                      />
                      <span className="form-hint">
                        El sistema validará este token en vivo contra la Bot API de Telegram antes de guardar.
                      </span>
                    </div>

                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="form-label">Nombre de la Comunidad / Marca</label>
                        <input
                          type="text"
                          placeholder="Ej. Ventas Libres Chiclayo"
                          className="input-field"
                          value={createForm.communityName}
                          onChange={(e) => setCreateForm({ ...createForm, communityName: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Estado del Plan SaaS</label>
                        <select
                          className="select-field"
                          value={createForm.planStatus}
                          onChange={(e) => setCreateForm({ ...createForm, planStatus: e.target.value })}
                        >
                          <option value="ACTIVE">ACTIVE (Activo & Operativo)</option>
                          <option value="TRIAL">TRIAL (Período de Prueba)</option>
                          <option value="SUSPENDED">SUSPENDED (Suspendido)</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="form-label">IDs de Propietarios (Owners de la Instancia)</label>
                        <input
                          type="text"
                          placeholder="7794982496, 7849224682"
                          className="input-field"
                          value={createForm.ownerIds}
                          onChange={(e) => setCreateForm({ ...createForm, ownerIds: e.target.value })}
                        />
                        <span className="form-hint">Separados por coma. Tienen acceso total a los comandos /staff y /setup.</span>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Fecha de Expiración / Vigencia (Opcional)</label>
                        <input
                          type="date"
                          className="input-field"
                          value={createForm.expiresAt}
                          onChange={(e) => setCreateForm({ ...createForm, expiresAt: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Tab 2: Canales & Enlaces */}
                {createActiveTab === 'canales' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Canales Requeridos para Verificación</label>
                      <textarea
                        rows={3}
                        placeholder="@canal_oficial&#10;https://t.me/+EnlacePrivado"
                        className="textarea-field"
                        value={createForm.channelsToVerify}
                        onChange={(e) => setCreateForm({ ...createForm, channelsToVerify: e.target.value })}
                      />
                      <span className="form-hint">
                        Un canal por línea o separados por coma. Los usuarios nuevos deben unirse a estos canales para desbloquearse.
                      </span>
                    </div>

                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="form-label">Enlace de Carpeta de Grupos de Telegram</label>
                        <input
                          type="url"
                          placeholder="https://t.me/addlist/..."
                          className="input-field"
                          value={createForm.groupsFolderLink}
                          onChange={(e) => setCreateForm({ ...createForm, groupsFolderLink: e.target.value })}
                        />
                        <span className="form-hint">Enlace estético del botón "UNIRME" en la verificación.</span>
                      </div>
                      <div className="form-group">
                        <label className="form-label">URL de Portal Web de Verificación (Opcional)</label>
                        <input
                          type="url"
                          placeholder="https://mi-portal.com/verificar"
                          className="input-field"
                          value={createForm.verifyWebUrl}
                          onChange={(e) => setCreateForm({ ...createForm, verifyWebUrl: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Tab 3: Staff & Logs */}
                {createActiveTab === 'staff_logs' && (
                  <>
                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="form-label">ID de Chat de Staff (Grupo Administrativo)</label>
                        <input
                          type="text"
                          placeholder="-1001234567890"
                          className="input-field"
                          value={createForm.staffChatId}
                          onChange={(e) => setCreateForm({ ...createForm, staffChatId: e.target.value })}
                        />
                        <span className="form-hint">ID del supergrupo donde el staff recibe alertas operativas.</span>
                      </div>
                      <div className="form-group">
                        <label className="form-label">ID de Hilo / Topic de Staff (Opcional)</label>
                        <input
                          type="number"
                          placeholder="Ej. 12"
                          className="input-field"
                          value={createForm.staffThreadId}
                          onChange={(e) => setCreateForm({ ...createForm, staffThreadId: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="form-label">ID de Canal Privado de Logs</label>
                        <input
                          type="text"
                          placeholder="-1009876543210"
                          className="input-field"
                          value={createForm.logChannelId}
                          onChange={(e) => setCreateForm({ ...createForm, logChannelId: e.target.value })}
                        />
                        <span className="form-hint">Canal de auditoría para registro de acciones y moderaciones.</span>
                      </div>
                      <div className="form-group">
                        <label className="form-label">ID de Hilo / Topic de Logs (Opcional)</label>
                        <input
                          type="number"
                          placeholder="Ej. 5"
                          className="input-field"
                          value={createForm.logThreadId}
                          onChange={(e) => setCreateForm({ ...createForm, logThreadId: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Tab 4: GBan & Escrow */}
                {createActiveTab === 'gban_escrow' && (
                  <>
                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="form-label">Chat Privado de Reportes / Quemar</label>
                        <input
                          type="text"
                          placeholder="-1001122334455"
                          className="input-field"
                          value={createForm.burnChatId}
                          onChange={(e) => setCreateForm({ ...createForm, burnChatId: e.target.value })}
                        />
                        <span className="form-hint">Donde llegan los reportes de estafas para revisión del staff.</span>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Topic ID de Reportes (Opcional)</label>
                        <input
                          type="number"
                          placeholder="Ej. 24"
                          className="input-field"
                          value={createForm.burnThreadId}
                          onChange={(e) => setCreateForm({ ...createForm, burnThreadId: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="form-label">Canal Público de Estafadores (Lista Negra)</label>
                        <input
                          type="text"
                          placeholder="-1009988776655"
                          className="input-field"
                          value={createForm.publicBurnChannelId}
                          onChange={(e) => setCreateForm({ ...createForm, publicBurnChannelId: e.target.value })}
                        />
                        <span className="form-hint">Canal donde se publican las sentencias públicas con pruebas.</span>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Topic ID del Canal Público (Opcional)</label>
                        <input
                          type="number"
                          placeholder="Ej. 8"
                          className="input-field"
                          value={createForm.publicBurnThreadId}
                          onChange={(e) => setCreateForm({ ...createForm, publicBurnThreadId: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="form-label">Grupo Oficial de Intermediación / Tratos (Escrow)</label>
                        <input
                          type="text"
                          placeholder="-1005544332211"
                          className="input-field"
                          value={createForm.escrowGroupId}
                          onChange={(e) => setCreateForm({ ...createForm, escrowGroupId: e.target.value })}
                        />
                        <span className="form-hint">Supergrupo con temas habilitados para salas de negociación.</span>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Comisión de Intermediación (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          className="input-field"
                          value={createForm.escrowCommission}
                          onChange={(e) => setCreateForm({ ...createForm, escrowCommission: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Términos y Condiciones del Servicio de Tratos</label>
                      <textarea
                        rows={2}
                        placeholder="Reglas de mediación, tiempos máximos y políticas de reembolso..."
                        className="textarea-field"
                        value={createForm.escrowTerms}
                        onChange={(e) => setCreateForm({ ...createForm, escrowTerms: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {/* Tab 5: Seguridad & Filtros */}
                {createActiveTab === 'seguridad' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Nivel de Seguridad Perimetral DEFCON</label>
                      <select
                        className="select-field"
                        value={createForm.defconLevel}
                        onChange={(e) => setCreateForm({ ...createForm, defconLevel: e.target.value })}
                      >
                        <option value="NORMAL">NORMAL — Operación estándar, bienvenida y verificación habitual</option>
                        <option value="DEFCON_3">DEFCON 3 — Alerta moderada, verificación estricta</option>
                        <option value="DEFCON_2">DEFCON 2 — Alto riesgo, silenciamiento preventivo general</option>
                        <option value="DEFCON_1">DEFCON 1 — Ataque o Raid inminente, bloqueo total de nuevos ingresos</option>
                      </select>
                    </div>

                    <div className="form-grid-2">
                      <label className="form-switch">
                        <input
                          type="checkbox"
                          checked={createForm.antiSpam}
                          onChange={(e) => setCreateForm({ ...createForm, antiSpam: e.target.checked })}
                        />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px' }}>Filtro Anti-Spam Activo</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>Bloquea mensajes idénticos repetidos en la red</div>
                        </div>
                      </label>

                      <label className="form-switch">
                        <input
                          type="checkbox"
                          checked={createForm.antiFlood}
                          onChange={(e) => setCreateForm({ ...createForm, antiFlood: e.target.checked })}
                        />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px' }}>Filtro Anti-Flood (Rate Limiting)</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>Previene saturación de comandos por segundo</div>
                        </div>
                      </label>
                    </div>

                    <div className="form-group">
                      <label className="form-switch">
                        <input
                          type="checkbox"
                          checked={createForm.antiLinks}
                          onChange={(e) => setCreateForm({ ...createForm, antiLinks: e.target.checked })}
                        />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px' }}>Filtro Anti-Links no autorizados</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>Elimina invitaciones y enlaces externos de usuarios sin rango</div>
                        </div>
                      </label>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Mensaje de Bienvenida Personalizado (Opcional)</label>
                      <textarea
                        rows={2}
                        placeholder="Dejar en blanco para usar la plantilla predeterminada de la comunidad"
                        className="textarea-field"
                        value={createForm.welcomeMessage}
                        onChange={(e) => setCreateForm({ ...createForm, welcomeMessage: e.target.value })}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="modal-footer">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: 'auto', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={createForm.autoStart}
                    onChange={(e) => setCreateForm({ ...createForm, autoStart: e.target.checked })}
                  />
                  <span>Iniciar bot en caliente inmediatamente al guardar</span>
                </label>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Validando & Creando...' : 'Registrar & Lanzar Bot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Editar / Configurar Sub-Bot Completo ── */}
      {editingBot && editForm && (
        <div className="modal-overlay" onClick={() => { setEditingBot(null); setEditForm(null); }}>
          <div className="modal-content modal-content-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Ajustes de Sub-Bot: {editingBot.community_name}</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, marginTop: '2px' }}>
                  ID de Instancia: <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan-primary)' }}>{editingBot.id}</code>
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => { setEditingBot(null); setEditForm(null); }}>✕</button>
            </div>

            {/* Pestañas de Navegación */}
            <div className="modal-tabs">
              {TABS.map((t) => {
                const TabIcon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`modal-tab-btn ${editActiveTab === t.id ? 'active' : ''}`}
                    onClick={() => setEditActiveTab(t.id)}
                  >
                    <TabIcon size={14} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="modal-body" style={{ minHeight: '340px' }}>
                {/* Tab 1: Identidad & Token */}
                {editActiveTab === 'identidad' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Token de BotFather (Telegram API)</label>
                      <input
                        type="text"
                        placeholder="Dejar en blanco para conservar el token actual"
                        className="input-field"
                        style={{ fontFamily: 'var(--font-mono)' }}
                        value={editForm.botToken}
                        onChange={(e) => setEditForm({ ...editForm, botToken: e.target.value })}
                      />
                      <span className="form-hint">
                        Token actual activo: <code>{editingBot.bot_token_masked}</code>. Si ingresas un nuevo token, se validará antes de guardar.
                      </span>
                    </div>

                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="form-label">Nombre de la Comunidad</label>
                        <input
                          type="text"
                          className="input-field"
                          value={editForm.communityName}
                          onChange={(e) => setEditForm({ ...editForm, communityName: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Estado del Plan SaaS</label>
                        <select
                          className="select-field"
                          value={editForm.planStatus}
                          onChange={(e) => setEditForm({ ...editForm, planStatus: e.target.value })}
                        >
                          <option value="ACTIVE">ACTIVE (Activo & Operativo)</option>
                          <option value="TRIAL">TRIAL (Período de Prueba)</option>
                          <option value="SUSPENDED">SUSPENDED (Suspendido)</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="form-label">IDs de Propietarios (Owners)</label>
                        <input
                          type="text"
                          placeholder="7794982496, 7849224682"
                          className="input-field"
                          value={editForm.ownerIds}
                          onChange={(e) => setEditForm({ ...editForm, ownerIds: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Fecha de Expiración</label>
                        <input
                          type="date"
                          className="input-field"
                          value={editForm.expiresAt}
                          onChange={(e) => setEditForm({ ...editForm, expiresAt: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Tab 2: Canales & Enlaces */}
                {editActiveTab === 'canales' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Canales Requeridos para Verificación</label>
                      <textarea
                        rows={3}
                        placeholder="@canal1&#10;https://t.me/+..."
                        className="textarea-field"
                        value={editForm.channelsToVerify}
                        onChange={(e) => setEditForm({ ...editForm, channelsToVerify: e.target.value })}
                      />
                      <span className="form-hint">Un canal por línea o separados por coma.</span>
                    </div>

                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="form-label">Enlace de Carpeta de Grupos de Telegram</label>
                        <input
                          type="url"
                          placeholder="https://t.me/addlist/..."
                          className="input-field"
                          value={editForm.groupsFolderLink}
                          onChange={(e) => setEditForm({ ...editForm, groupsFolderLink: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">URL de Portal Web de Verificación</label>
                        <input
                          type="url"
                          placeholder="https://..."
                          className="input-field"
                          value={editForm.verifyWebUrl}
                          onChange={(e) => setEditForm({ ...editForm, verifyWebUrl: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Tab 3: Staff & Logs */}
                {editActiveTab === 'staff_logs' && (
                  <>
                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="form-label">ID de Chat de Staff</label>
                        <input
                          type="text"
                          placeholder="-100..."
                          className="input-field"
                          value={editForm.staffChatId}
                          onChange={(e) => setEditForm({ ...editForm, staffChatId: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">ID de Hilo / Topic de Staff</label>
                        <input
                          type="number"
                          placeholder="Ej. 12"
                          className="input-field"
                          value={editForm.staffThreadId}
                          onChange={(e) => setEditForm({ ...editForm, staffThreadId: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="form-label">ID de Canal de Logs</label>
                        <input
                          type="text"
                          placeholder="-100..."
                          className="input-field"
                          value={editForm.logChannelId}
                          onChange={(e) => setEditForm({ ...editForm, logChannelId: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">ID de Hilo / Topic de Logs</label>
                        <input
                          type="number"
                          placeholder="Ej. 5"
                          className="input-field"
                          value={editForm.logThreadId}
                          onChange={(e) => setEditForm({ ...editForm, logThreadId: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Tab 4: GBan & Escrow */}
                {editActiveTab === 'gban_escrow' && (
                  <>
                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="form-label">Chat Privado de Reportes / Quemar</label>
                        <input
                          type="text"
                          placeholder="-100..."
                          className="input-field"
                          value={editForm.burnChatId}
                          onChange={(e) => setEditForm({ ...editForm, burnChatId: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Topic ID de Reportes</label>
                        <input
                          type="number"
                          placeholder="Ej. 24"
                          className="input-field"
                          value={editForm.burnThreadId}
                          onChange={(e) => setEditForm({ ...editForm, burnThreadId: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="form-label">Canal Público de Estafadores</label>
                        <input
                          type="text"
                          placeholder="-100..."
                          className="input-field"
                          value={editForm.publicBurnChannelId}
                          onChange={(e) => setEditForm({ ...editForm, publicBurnChannelId: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Topic ID del Canal Público</label>
                        <input
                          type="number"
                          placeholder="Ej. 8"
                          className="input-field"
                          value={editForm.publicBurnThreadId}
                          onChange={(e) => setEditForm({ ...editForm, publicBurnThreadId: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="form-label">Grupo Oficial de Intermediación (Escrow)</label>
                        <input
                          type="text"
                          placeholder="-100..."
                          className="input-field"
                          value={editForm.escrowGroupId}
                          onChange={(e) => setEditForm({ ...editForm, escrowGroupId: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Comisión de Intermediación (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          className="input-field"
                          value={editForm.escrowCommission}
                          onChange={(e) => setEditForm({ ...editForm, escrowCommission: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Términos y Condiciones del Servicio de Tratos</label>
                      <textarea
                        rows={2}
                        className="textarea-field"
                        value={editForm.escrowTerms}
                        onChange={(e) => setEditForm({ ...editForm, escrowTerms: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {/* Tab 5: Seguridad & Filtros */}
                {editActiveTab === 'seguridad' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Nivel de Seguridad DEFCON</label>
                      <select
                        className="select-field"
                        value={editForm.defconLevel}
                        onChange={(e) => setEditForm({ ...editForm, defconLevel: e.target.value })}
                      >
                        <option value="NORMAL">NORMAL — Operación estándar</option>
                        <option value="DEFCON_3">DEFCON 3 — Alerta moderada, verificación estricta</option>
                        <option value="DEFCON_2">DEFCON 2 — Silenciamiento preventivo general</option>
                        <option value="DEFCON_1">DEFCON 1 — Ataque o Raid inminente, bloqueo total</option>
                      </select>
                    </div>

                    <div className="form-grid-2">
                      <label className="form-switch">
                        <input
                          type="checkbox"
                          checked={editForm.antiSpam}
                          onChange={(e) => setEditForm({ ...editForm, antiSpam: e.target.checked })}
                        />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px' }}>Filtro Anti-Spam</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>Bloquea mensajes repetitivos</div>
                        </div>
                      </label>

                      <label className="form-switch">
                        <input
                          type="checkbox"
                          checked={editForm.antiFlood}
                          onChange={(e) => setEditForm({ ...editForm, antiFlood: e.target.checked })}
                        />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px' }}>Filtro Anti-Flood</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>Previene saturación de comandos</div>
                        </div>
                      </label>
                    </div>

                    <div className="form-group">
                      <label className="form-switch">
                        <input
                          type="checkbox"
                          checked={editForm.antiLinks}
                          onChange={(e) => setEditForm({ ...editForm, antiLinks: e.target.checked })}
                        />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px' }}>Filtro Anti-Links no autorizados</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>Elimina enlaces de usuarios no verificados</div>
                        </div>
                      </label>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Mensaje de Bienvenida Personalizado</label>
                      <textarea
                        rows={2}
                        className="textarea-field"
                        value={editForm.welcomeMessage}
                        onChange={(e) => setEditForm({ ...editForm, welcomeMessage: e.target.value })}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setEditingBot(null); setEditForm(null); }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Guardando Ajustes...' : 'Guardar & Aplicar en Caliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
