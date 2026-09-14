'use client';

export default function Toast({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div class="toast-container">
      {toasts.map((t) => (
        <div key={t.id} class={`toast ${t.type || 'success'}`} onClick={() => onDismiss(t.id)}>
          <span>{t.type === 'error' ? '❌' : '✓'}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
