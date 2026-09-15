'use client';

import { useState, useRef, useEffect } from 'react';
import {
  IconShield,
  IconAlertTriangle,
  IconCheck,
  IconChevronDown,
  IconSearch,
  IconX,
  IconExternalLink,
} from './Icons';

/**
 * Selector inteligente de grupos y canales con detección de permisos de administrador
 */
export default function ChatSelectorDropdown({
  label,
  value,
  onChange,
  chats = [],
  placeholder = 'Selecciona un grupo o canal...',
  hint,
  isMulti = false,
  allowManual = true,
  required = false,
  loading = false,
  emptyMessage = 'No se detectaron grupos ni canales donde esté el bot. Añade el bot a tus chats en Telegram para que aparezcan aquí automáticamente.',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const containerRef = useRef(null);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Normalizar valor multi-selección a Array
  const selectedValues = isMulti
    ? (Array.isArray(value)
        ? value
        : String(value || '')
            .split(/[\n,]/)
            .map((s) => s.trim())
            .filter(Boolean))
    : [];

  const handleSelectSingle = (chat) => {
    // Si el chat tiene username público preferir @username, sino su chatId
    const val = chat.username ? chat.username : chat.chatId;
    onChange(val);
    setIsOpen(false);
  };

  const handleToggleMulti = (chat) => {
    const val = chat.username ? chat.username : chat.chatId;
    let next;
    if (selectedValues.includes(val) || selectedValues.includes(chat.chatId)) {
      next = selectedValues.filter((v) => v !== val && v !== chat.chatId);
    } else {
      next = [...selectedValues, val];
    }
    onChange(next.join('\n'));
  };

  const handleRemoveMultiItem = (itemVal) => {
    const next = selectedValues.filter((v) => v !== itemVal);
    onChange(next.join('\n'));
  };

  const handleAddManualItem = () => {
    if (!manualInput.trim()) return;
    const clean = manualInput.trim();
    if (isMulti) {
      if (!selectedValues.includes(clean)) {
        onChange([...selectedValues, clean].join('\n'));
      }
    } else {
      onChange(clean);
    }
    setManualInput('');
    setIsManualMode(false);
    setIsOpen(false);
  };

  // Filtrado de chats por término de búsqueda
  const filteredChats = (chats || []).filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    const titleMatch = (c.title || '').toLowerCase().includes(q);
    const userMatch = (c.username || '').toLowerCase().includes(q);
    const idMatch = String(c.chatId || '').includes(q);
    return titleMatch || userMatch || idMatch;
  });

  // Encontrar objeto de chat seleccionado (modo simple)
  const currentSelectedChat = !isMulti
    ? (chats || []).find((c) => String(c.chatId) === String(value) || c.username === value)
    : null;

  return (
    <div className="form-group" ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        {label && (
          <label className="form-label" style={{ margin: 0, fontWeight: 700, fontSize: '13px' }}>
            {label} {required && <span style={{ color: 'var(--rose-danger)' }}>*</span>}
          </label>
        )}
        {allowManual && (
          <button
            type="button"
            onClick={() => setIsManualMode(!isManualMode)}
            style={{
              background: 'none',
              border: 'none',
              color: isManualMode ? 'var(--cyan-primary)' : 'var(--text-muted)',
              fontSize: '11px',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            {isManualMode ? '← Usar menú desplegable' : '+ Ingresar enlace/ID manual'}
          </button>
        )}
      </div>

      {isManualMode ? (
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            className="input-field"
            style={{ flex: 1 }}
            placeholder={isMulti ? 'Ej: @canal_oficial o https://t.me/...' : 'Ej: -1001234567890 o @canal'}
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddManualItem();
              }
            }}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleAddManualItem}
            disabled={!manualInput.trim()}
          >
            Añadir
          </button>
        </div>
      ) : (
        <>
          {/* Botón Disparador del Menú Desplegable */}
          <div
            onClick={() => setIsOpen(!isOpen)}
            className="input-field"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              minHeight: '42px',
              padding: '8px 14px',
              background: 'rgba(18, 18, 22, 0.7)',
              borderColor: isOpen ? 'var(--cyan-primary)' : 'var(--border-subtle)',
              borderRadius: '10px',
              userSelect: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', flex: 1 }}>
              {currentSelectedChat ? (
                <>
                  <span style={{ fontSize: '15px' }}>
                    {currentSelectedChat.type === 'channel' ? '📢' : '🛡️'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <span style={{ fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {currentSelectedChat.title}
                    </span>
                    {currentSelectedChat.username && (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {currentSelectedChat.username}
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: currentSelectedChat.isAdmin ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: currentSelectedChat.isAdmin ? '#22c55e' : '#f59e0b',
                      border: `1px solid ${currentSelectedChat.isAdmin ? 'rgba(34, 197, 94, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {currentSelectedChat.badge || (currentSelectedChat.isAdmin ? '🛡️ Admin' : '⚠️ No Admin')}
                  </span>
                </>
              ) : value && !isMulti ? (
                <span style={{ color: '#ffffff', fontWeight: 600 }}>{value}</span>
              ) : isMulti && selectedValues.length > 0 ? (
                <span style={{ color: 'var(--cyan-primary)', fontWeight: 600 }}>
                  {selectedValues.length} {selectedValues.length === 1 ? 'canal seleccionado' : 'canales seleccionados'} (Pulsar para modificar)
                </span>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>{placeholder}</span>
              )}
            </div>

            <IconChevronDown
              size={16}
              style={{
                color: 'var(--text-muted)',
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
                flexShrink: 0,
                marginLeft: '8px',
              }}
            />
          </div>

          {/* Menú Desplegable Flotante */}
          {isOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                right: 0,
                zIndex: 9999,
                background: '#0d0d12',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '12px',
                boxShadow: '0 12px 36px rgba(0, 0, 0, 0.8), 0 0 20px rgba(6, 182, 212, 0.15)',
                overflow: 'hidden',
                animation: 'fadeIn 0.15s ease-out',
                maxHeight: '340px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Buscador interno */}
              <div
                style={{
                  padding: '10px 12px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255, 255, 255, 0.02)',
                }}
              >
                <IconSearch size={14} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, @username o ID..."
                  style={{
                    background: 'none',
                    border: 'none',
                    outline: 'none',
                    color: '#ffffff',
                    fontSize: '12px',
                    width: '100%',
                  }}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
                {search && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearch('');
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                  >
                    <IconX size={12} />
                  </button>
                )}
              </div>

              {/* Lista Scrolleable de Opciones */}
              <div style={{ overflowY: 'auto', flex: 1, padding: '6px' }}>
                {loading ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    Consultando chats y permisos en Telegram...
                  </div>
                ) : filteredChats.length === 0 ? (
                  <div style={{ padding: '20px 16px', textAlign: 'center' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 10px 0', lineHeight: 1.5 }}>
                      {emptyMessage}
                    </p>
                    {allowManual && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setIsManualMode(true);
                          setIsOpen(false);
                        }}
                      >
                        Ingresar Enlace o ID Manual
                      </button>
                    )}
                  </div>
                ) : (
                  filteredChats.map((chat) => {
                    const chatVal = chat.username ? chat.username : chat.chatId;
                    const isSelected = isMulti
                      ? selectedValues.includes(chatVal) || selectedValues.includes(chat.chatId)
                      : String(value) === String(chat.chatId) || value === chat.username;

                    return (
                      <div
                        key={chat.chatId}
                        onClick={() => (isMulti ? handleToggleMulti(chat) : handleSelectSingle(chat))}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
                          transition: 'background 0.15s ease',
                          marginBottom: '4px',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                          <span style={{ fontSize: '16px' }}>
                            {chat.type === 'channel' ? '📢' : '🛡️'}
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 600, fontSize: '13px', color: '#ffffff' }}>
                                {chat.title}
                              </span>
                              {isSelected && <IconCheck size={14} color="var(--cyan-primary)" />}
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {chat.username ? chat.username : `ID: ${chat.chatId}`} • {chat.type}
                            </span>
                          </div>
                        </div>

                        {/* Insignia de Estado de Admin */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: chat.isAdmin ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: chat.isAdmin ? '#22c55e' : '#f59e0b',
                              border: `1px solid ${chat.isAdmin ? 'rgba(34, 197, 94, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {chat.isAdmin ? '🛡️ Admin' : '⚠️ No Admin'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Pie de dropdown con opción manual */}
              {allowManual && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(0, 0, 0, 0.3)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {filteredChats.length} {filteredChats.length === 1 ? 'chat detectado' : 'chats detectados'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsManualMode(true);
                      setIsOpen(false);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--cyan-primary)',
                      fontSize: '11px',
                      cursor: 'pointer',
                      padding: '2px 6px',
                    }}
                  >
                    + Escribir ID manual
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Chips de elementos seleccionados (en caso de multi-selección) */}
      {isMulti && selectedValues.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
          {selectedValues.map((item) => {
            const matchedChat = (chats || []).find(
              (c) => String(c.chatId) === String(item) || c.username === item
            );
            return (
              <span
                key={item}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  background: 'rgba(6, 182, 212, 0.15)',
                  border: '1px solid rgba(6, 182, 212, 0.3)',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                <span>{matchedChat ? matchedChat.title : item}</span>
                {matchedChat && (
                  <span
                    style={{
                      fontSize: '9px',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      background: matchedChat.isAdmin ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: matchedChat.isAdmin ? '#22c55e' : '#f59e0b',
                    }}
                  >
                    {matchedChat.isAdmin ? '🛡️ Admin' : '⚠️ No Admin'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveMultiItem(item)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#a1a1aa',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Remover"
                >
                  <IconX size={12} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {hint && (
        <span className="form-hint" style={{ display: 'block', marginTop: '6px' }}>
          {hint}
        </span>
      )}
    </div>
  );
}
