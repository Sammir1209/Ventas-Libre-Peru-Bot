'use client';

import { useState, useMemo } from 'react';
import {
  IconBook,
  IconShield,
  IconUsers,
  IconSearch,
  IconScale,
  IconBot,
  IconCopy,
  IconCheck,
} from '../common/Icons';

export const COMMANDS_DATA = [
  // ── Moderación & Sanciones ──
  {
    cmd: '/mute [tiempo] [motivo]',
    desc: 'Silencia a un usuario para que no pueda enviar mensajes ni stickers en el grupo. Puede usarse respondiendo a un mensaje o con ID.',
    syntax: '/mute 1h Spam reiterado',
    roles: 'Admin, Co-Owner, Owner',
    category: 'moderation',
    notes: 'Soporta unidades de tiempo: m (minutos), h (horas), d (días). Sin tiempo aplica mute indefinido.',
  },
  {
    cmd: '/unmute [ID / respuesta]',
    desc: 'Devuelve inmediatamente los permisos de escritura a un usuario previamente silenciado.',
    syntax: '/unmute',
    roles: 'Admin, Co-Owner, Owner',
    category: 'moderation',
    notes: 'Puede responder al mensaje del silenciado o pasar su ID numérico.',
  },
  {
    cmd: '/ban [tiempo] [motivo]',
    desc: 'Expulsa y bloquea permanentemente o temporalmente a un usuario del grupo.',
    syntax: '/ban 7d Intento de estafa',
    roles: 'Admin, Co-Owner, Owner',
    category: 'moderation',
    notes: 'El usuario no podrá reingresar al grupo hasta que sea desbaneado.',
  },
  {
    cmd: '/unban [ID]',
    desc: 'Remueve la sanción de baneo de un usuario en el grupo actual.',
    syntax: '/unban 7849224682',
    roles: 'Admin, Co-Owner, Owner',
    category: 'moderation',
    notes: 'Requiere el ID numérico del usuario sancionado.',
  },
  {
    cmd: '/kick [motivo]',
    desc: 'Expulsa al usuario del grupo sin añadirlo a la lista negra permanente.',
    syntax: '/kick Incumplimiento de normas',
    roles: 'Admin, Co-Owner, Owner',
    category: 'moderation',
    notes: 'Si el grupo es público o tiene enlace de invitación, el usuario puede volver a unirse.',
  },
  {
    cmd: '/warn [motivo]',
    desc: 'Aplica una advertencia formal a un usuario. Al acumular 3 advertencias, el bot aplica una sanción automática.',
    syntax: '/warn Enlace no autorizado',
    roles: 'Admin, Co-Owner, Owner',
    category: 'moderation',
    notes: 'El conteo de advertencias se guarda en la base de datos de la comunidad.',
  },
  {
    cmd: '/warns [ID / respuesta]',
    desc: 'Consulta el historial y cantidad de advertencias acumuladas por un miembro.',
    syntax: '/warns',
    roles: 'Todos',
    category: 'moderation',
    notes: 'Cualquier usuario puede ver sus propias advertencias o las de otro miembro.',
  },
  {
    cmd: '/resetwarns [ID / respuesta]',
    desc: 'Reinicia a 0 las advertencias de un usuario.',
    syntax: '/resetwarns',
    roles: 'Co-Owner, Owner',
    category: 'moderation',
    notes: 'Útil cuando un usuario redime su conducta.',
  },

  // ── Staff & Gestión de Permisos ──
  {
    cmd: '/promote [ID / @usuario]',
    desc: 'Asistente interactivo para otorgar rango de Staff. Asigna el tag en grupos y envía en privado la invitación al grupo de Staff del sub-bot.',
    syntax: '/promote @nuevoAdmin',
    roles: 'Co-Owner, Owner',
    category: 'staff',
    notes: 'Lee y guarda roles estrictamente por comunidad (tenant_id). Envía el enlace de staff configurado en el sub-bot.',
  },
  {
    cmd: '/demote [ID / @usuario]',
    desc: 'Remueve todos los privilegios de Staff a un usuario en la comunidad.',
    syntax: '/demote @antiguoStaff',
    roles: 'Owner',
    category: 'staff',
    notes: 'Revoca permisos tanto en la base de datos como en los chats vinculados.',
  },
  {
    cmd: '/staff',
    desc: 'Muestra la jerarquía visual de todo el equipo de Staff oficial de la comunidad.',
    syntax: '/staff',
    roles: 'Todos',
    category: 'staff',
    notes: 'Presenta Owners, Co-Owners, Trato Admins y Admins con sus respectivos IDs y nombres de usuario.',
  },
  {
    cmd: '/panel o /web',
    desc: 'Genera un token y enlace de un solo uso para iniciar sesión instantánea en el Panel Administrativo Web.',
    syntax: '/panel',
    roles: 'Staff de la Comunidad',
    category: 'staff',
    notes: 'En sub-bots, redirige directamente al portal de administración propio de esa comunidad.',
  },

  // ── Radar & Búsqueda Avanzada ──
  {
    cmd: '/buscar multis',
    desc: 'Radar inteligente que analiza a los miembros de los grupos buscando cuentas clones o multicuentas sospechosas.',
    syntax: '/buscar multis',
    roles: 'Admin, Co-Owner, Owner',
    category: 'radar',
    notes: 'Agrupa por similitud fonética, raíces de nombres compartidos y filtra clanes para evitar falsos positivos.',
  },
  {
    cmd: '/buscar sin @',
    desc: 'Lista a todos los miembros de los grupos que no tienen un alias (@username) configurado en Telegram.',
    syntax: '/buscar sin @',
    roles: 'Admin, Co-Owner, Owner',
    category: 'radar',
    notes: 'Útil para auditar perfiles anónimos de alto riesgo.',
  },
  {
    cmd: '/buscar [texto / nombre]',
    desc: 'Búsqueda instantánea de miembros por nombre o fragmento en todos los grupos registrados de la comunidad.',
    syntax: '/buscar carlos',
    roles: 'Admin, Co-Owner, Owner',
    category: 'radar',
    notes: 'No mezcla resultados entre sub-bots ni con la red principal.',
  },

  // ── Tratos & Escrow P2P ──
  {
    cmd: '/trato',
    desc: 'Inicia el protocolo de intermediación segura para compras o ventas con retención de fondos garantizada.',
    syntax: '/trato',
    roles: 'Todos los miembros',
    category: 'escrow',
    notes: 'Despliega el formulario interactivo para fijar comprador, vendedor, monto y mediador asignado.',
  },
  {
    cmd: '/mediadores',
    desc: 'Muestra la lista de Trato Admins oficiales disponibles para mediar transacciones P2P.',
    syntax: '/mediadores',
    roles: 'Todos',
    category: 'escrow',
    notes: 'Permite a los usuarios elegir un mediador verificado para su operación.',
  },
  {
    cmd: '/cancelartrato [ID]',
    desc: 'Cancela una solicitud de trato pendiente antes de que los fondos sean confirmados.',
    syntax: '/cancelartrato 105',
    roles: 'Comprador, Vendedor, Mediador',
    category: 'escrow',
    notes: 'Solo aplica mientras el trato esté en estado PENDIENTE.',
  },

  // ── Configuración / Set ──
  {
    cmd: '/set principal',
    desc: 'Establece el grupo de Telegram actual como el Chat Principal de la comunidad.',
    syntax: '/set principal',
    roles: 'Owner de la Comunidad',
    category: 'settings',
    notes: 'Aquí se aplicarán las reglas principales y verificación de entrada.',
  },
  {
    cmd: '/set logs',
    desc: 'Vincula el canal donde el bot reportará en tiempo real las auditorías, sanciones y verificaciones.',
    syntax: '/set logs',
    roles: 'Owner de la Comunidad',
    category: 'settings',
    notes: 'El bot debe ser administrador con permisos de publicación en el canal de logs.',
  },
  {
    cmd: '/verificar o /canales',
    desc: 'Envía la tarjeta interactiva con el enlace al portal web donde los usuarios se unen a los canales requeridos.',
    syntax: '/verificar',
    roles: 'Todos',
    category: 'settings',
    notes: 'Si el sub-bot no tiene canales configurados, informa que el acceso es directo y libre.',
  },
  {
    cmd: '/id',
    desc: 'Muestra el ID numérico del usuario que lo envía, del usuario respondido y del chat grupal.',
    syntax: '/id',
    roles: 'Todos',
    category: 'settings',
    notes: 'Imprescindible para configurar canales o sanciones con precisión.',
  },
  {
    cmd: '/reglas',
    desc: 'Despliega el reglamento oficial de convivencia y comercio seguro de la comunidad.',
    syntax: '/reglas',
    roles: 'Todos',
    category: 'settings',
    notes: 'Puede personalizarse desde los ajustes de la comunidad.',
  },
];

export default function DocsSection() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [copiedCmd, setCopiedCmd] = useState(null);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(text);
    setTimeout(() => setCopiedCmd(null), 2500);
  };

  const filteredCommands = useMemo(() => {
    return COMMANDS_DATA.filter((item) => {
      const matchCat = selectedCategory === 'all' || item.category === selectedCategory;
      const q = searchTerm.toLowerCase();
      const matchSearch =
        item.cmd.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q) ||
        item.syntax.toLowerCase().includes(q) ||
        item.roles.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [searchTerm, selectedCategory]);

  return (
    <div>
      {/* Encabezado */}
      <div className="section-header">
        <div>
          <h2>Guía Operativa & Documentación de Comandos</h2>
          <p>Manual oficial de uso para administradores, owners y clientes del sistema</p>
        </div>
      </div>

      {/* Tarjeta de Guía Rápida para Clientes Sub-Bots */}
      <div
        className="panel-card"
        style={{
          padding: '24px',
          marginBottom: '24px',
          background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.9), rgba(9, 9, 11, 0.95))',
          border: '1px solid rgba(255, 255, 255, 0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
          <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.1)' }}>
            <IconBot size={22} color="#ffffff" />
          </div>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
              ¿Cómo opera el dueño de un Sub-Bot desde su Panel Web?
            </h3>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Todo lo que necesita el cliente está accesible sin depender de comandos complejos
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-subtle)' }}>
            <strong style={{ color: '#ffffff', display: 'block', marginBottom: '4px' }}>1. Canales Obligatorios de Entrada</strong>
            El dueño entra a su panel pestaña <em>Canales & Enlaces</em> y escribe sus canales. <strong>Si lo deja vacío:</strong> el bot no muteará a nadie. <strong>Si coloca canales:</strong> el bot silencia a los nuevos y los dirige a su web para desbloquearse.
          </div>
          <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-subtle)' }}>
            <strong style={{ color: '#ffffff', display: 'block', marginBottom: '4px' }}>2. Enlace al Grupo de Staff</strong>
            En el campo <em>Enlace de Invitación al Staff</em>, coloca el enlace privado de su grupo interno. Cuando use <code>/promote</code> en Telegram, el bot enviará ese enlace en privado al nuevo moderador.
          </div>
          <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-subtle)' }}>
            <strong style={{ color: '#ffffff', display: 'block', marginBottom: '4px' }}>3. Gestión de Staff sin Comandos</strong>
            En la pestaña <em>Equipo de Staff</em> puede añadir o retirar administradores, definir su rol y su tag público directamente con un solo clic.
          </div>
        </div>
      </div>

      {/* Buscador y Filtros */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
          <IconSearch
            size={16}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Buscar comando, parámetro o descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field"
            style={{ width: '100%', paddingLeft: '40px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'Todos' },
            { id: 'moderation', label: 'Moderación' },
            { id: 'staff', label: 'Staff' },
            { id: 'radar', label: 'Radar / Multis' },
            { id: 'escrow', label: 'Tratos P2P' },
            { id: 'settings', label: 'Ajustes' },
          ].map((cat) => (
            <button
              key={cat.id}
              className={`btn btn-sm ${selectedCategory === cat.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Listado de Comandos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {filteredCommands.length === 0 ? (
          <div className="panel-card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No se encontraron comandos que coincidan con la búsqueda.
          </div>
        ) : (
          filteredCommands.map((item, idx) => (
            <div
              key={idx}
              className="panel-card"
              style={{
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                transition: 'border-color 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <code
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color: 'var(--cyan-primary)',
                      background: 'rgba(6, 182, 212, 0.08)',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid rgba(6, 182, 212, 0.2)',
                    }}
                  >
                    {item.cmd}
                  </code>
                  <span className="badge badge-subtle" style={{ fontSize: '11px' }}>
                    {item.roles}
                  </span>
                </div>

                <button
                  className="btn btn-secondary btn-sm"
                  style={{ gap: '6px', fontSize: '12px' }}
                  onClick={() => handleCopy(item.syntax)}
                >
                  {copiedCmd === item.syntax ? (
                    <>
                      <IconCheck size={14} color="var(--emerald-success)" />
                      <span style={{ color: 'var(--emerald-success)' }}>¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <IconCopy size={14} />
                      <span>Copiar Ejemplo</span>
                    </>
                  )}
                </button>
              </div>

              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                {item.desc}
              </p>

              <div
                style={{
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '10px',
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Ejemplo: </span>
                  <code>{item.syntax}</code>
                </div>
                {item.notes && (
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Nota: </span>
                    <span>{item.notes}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
