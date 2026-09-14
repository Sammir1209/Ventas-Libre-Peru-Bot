'use client';

export default function GroupsSection({ groups, onToggleSecurity }) {
  return (
    <section class="panel-card">
      <div class="panel-header">
        <div class="panel-header-left">
          <h3>Grupos Oficiales & Protocolos de Seguridad en Vivo</h3>
          <p>Supervisa los chats conectados, los niveles DEFCON y los filtros anti-spam activos en la red.</p>
        </div>
      </div>

      <div class="table-responsive">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Título del Chat</th>
              <th>ID de Telegram</th>
              <th>Tipo</th>
              <th>@Username</th>
              <th>Fecha Registro</th>
            </tr>
          </thead>
          <tbody>
            {(!groups || groups.length === 0) ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-subtle)' }}>
                  No hay grupos oficiales vinculados. El bot se auto-registra al ser agregado como administrador.
                </td>
              </tr>
            ) : (
              groups.map((g) => (
                <tr key={g.chat_id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{g.title || 'Grupo sin título'}</div>
                  </td>
                  <td>
                    <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan-primary)' }}>
                      {g.chat_id}
                    </code>
                  </td>
                  <td>
                    <span class="badge badge-muted">
                      {g.type || 'supergroup'}
                    </span>
                  </td>
                  <td>
                    {g.username ? (
                      <a
                        href={`https://t.me/${g.username}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--cyan-primary)', textDecoration: 'none' }}
                      >
                        @{g.username}
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
