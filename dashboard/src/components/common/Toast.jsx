'use client';

import { IconCheck, IconX } from './Icons';

export default function Toast({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type || 'success'}`} onClick={() => onDismiss(t.id)}>
          {t.type === 'error' ? <IconX size={16} /> : <IconCheck size={16} />}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
