'use client';

import { useState, useMemo } from 'react';
import {
  IconShield,
  IconAlertTriangle,
  IconCheck,
  IconChevronDown,
  IconSearch,
  IconX,
  IconPlus,
  IconRefresh,
} from './Icons';

/**
 * Formulario interactivo de selección de canales y grupos con estado de Administrador.
 * Permite seleccionar mediante tarjetas/checkboxes y añadir canales manuales.
 * ¡Cero selección automática: el usuario elige explícitamente!
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
  emptyMessage = 'No se detectaron canales ni grupos donde esté el bot. Añade el bot como administrador en Telegram para que aparezcan aquí automáticamente.',
}) {
  const [search, setSearch] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [isOpenSingle, setIsOpenSingle] = useState(false);

  // Normalizar valores seleccionados (Array de strings)
  const selectedList = useMemo(() => {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((s) => String(s).trim()).filter(Boolean);
    return String(value)
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [value]);

  // Manejar marcar/desmarcar en selección múltiple
  const handleToggleMulti = (chat) => {
    const chatKey = chat.username || String(chat.chatId);
    const chatAltKey = String(chat.chatId);

    const alreadySelected = selectedList.some(
      (item) => item.toLowerCase() === chatKey.toLowerCase() || item === chatAltKey
    );

    let next;
    if (alreadySelected) {
      next = selectedList.filter(
        (item) => item.toLowerCase() !== chatKey.toLowerCase() && item !== chatAltKey
      );
    } else {
      next = [...selectedList, chatKey];
    }
    onChange(next.join('\n'));
  };

  // Remover un canal seleccionado
  const handleRemoveItem = (itemVal) => {
    const next = selectedList.filter(
      (item) => item.toLowerCase() !== itemVal.toLowerCase()
    );
    onChange(next.join('\n'));
  };

  // Añadir un canal manual escrito por el usuario
  const handleAddManual = (e) => {
    if (e) e.preventDefault();
    const clean = manualInput.trim();
    if (!clean) return;

    if (isMulti) {
      if (!selectedList.some((item) => item.toLowerCase() === clean.toLowerCase())) {
        onChange([...selectedList, clean].join('\n'));
      }
    } else {
      onChange(clean);
    }
    setManualInput('');
  };

  // Limpiar toda la selección
  const handleClearAll = () => {
    onChange('');
  };

  // Selección simple
  const handleSelectSingle = (chat) => {
    const chatKey = chat.username || String(chat.chatId);
    onChange(chatKey);
    setIsOpenSingle(false);
  };

  const handleClearSingle = () => {
    onChange('');
    setIsOpenSingle(false);
  };

  // Filtrado de chats disponibles
  const filteredChats = useMemo(() => {
    if (!search.trim()) return chats || [];
    const q = search.toLowerCase().trim();
    return (chats || []).filter((c) => {
      const titleMatch = (c.title || '').toLowerCase().includes(q);
      const userMatch = (c.username || '').toLowerCase().includes(q);
      const idMatch = String(c.chatId || '').includes(q);
      return titleMatch || userMatch || idMatch;
    });
  }, [chats, search]);

  // Si es multi-selección: RENDERIZAR COMO FORMULARIO VISUAL COMPLETO
  if (isMulti) {
    return (
      <div className="heroui-channel-selector-form" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Encabezado del Formulario */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <label style={{ fontSize: '15px', fontWeight: 800, color: '#f4f4f5', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {label || 'Canales Requeridos para Verificación'}
              {required && <span style={{ color: '#f31260' }}>*</span>}
            </label>
            {hint && (
              <span style={{ fontSize: '12px', color: '#a1a1aa', display: 'block', marginTop: '2px' }}>
                {hint}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '9999px',
                background: selectedList.length > 0 ? 'rgba(0, 111, 238, 0.15)' : 'rgba(113, 113, 122, 0.2)',
                color: selectedList.length > 0 ? '#006FEE' : '#a1a1aa',
                border: `1px solid ${selectedList.length > 0 ? 'rgba(0, 111, 238, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
              }}
            >
              {selectedList.length} {selectedList.length === 1 ? 'canal elegido' : 'canales elegidos'}
            </span>

            {selectedList.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#f31260',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '2px 6px',
                }}
              >
                Desmarcar todos
              </button>
            )}
          </div>
        </div>

        {/* Resumen de Canales Elegidos (Chips HeroUI) */}
        {selectedList.length > 0 && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '16px',
              background: 'rgba(0, 111, 238, 0.06)',
              border: '1px solid rgba(0, 111, 238, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#006FEE' }}>
              ✓ Canales que se exigirán a los nuevos miembros:
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {selectedList.map((item) => {
                const matchedChat = (chats || []).find(
                  (c) => String(c.chatId) === String(item) || c.username?.toLowerCase() === item.toLowerCase()
                );

                return (
                  <span
                    key={item}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '5px 12px',
                      borderRadius: '9999px',
                      background: 'rgba(24, 24, 27, 0.9)',
                      border: '1px solid rgba(0, 111, 238, 0.4)',
                      color: '#f4f4f5',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    <span>{matchedChat ? matchedChat.title : item}</span>
                    {matchedChat && (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '6px',
                          background: matchedChat.isAdmin ? 'rgba(23, 201, 100, 0.18)' : 'rgba(245, 165, 36, 0.18)',
                          color: matchedChat.isAdmin ? '#17c964' : '#f5a524',
                        }}
                      >
                        {matchedChat.isAdmin ? '🛡️ Admin' : '⚠️ No Admin'}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#a1a1aa',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        padding: 0,
                      }}
                      title="Quitar canal"
                    >
                      <IconX size={13} />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Buscador de Canales para Filtrar */}
        <div style={{ position: 'relative' }}>
          <IconSearch
            size={14}
            color="#a1a1aa"
            style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Buscar entre los canales donde está el bot..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field"
            style={{ paddingLeft: '38px', borderRadius: '14px', fontSize: '13px' }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#a1a1aa',
                cursor: 'pointer',
              }}
            >
              <IconX size={14} />
            </button>
          )}
        </div>

        {/* Lista de Tarjetas Seleccionables con Checkboxes */}
        <div
          style={{
            maxHeight: '260px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '2px',
          }}
        >
          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#a1a1aa', fontSize: '13px' }}>
              Consultando canales vinculados a Telegram...
            </div>
          ) : filteredChats.length === 0 ? (
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                borderRadius: '14px',
                background: 'rgba(39, 39, 42, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <p style={{ color: '#a1a1aa', fontSize: '12px', margin: '0 0 10px 0', lineHeight: 1.5 }}>
                {emptyMessage}
              </p>
              <span style={{ fontSize: '11px', color: '#71717a' }}>
                💡 Puedes añadir canales manualmente usando el formulario de abajo.
              </span>
            </div>
          ) : (
            filteredChats.map((chat) => {
              const chatKey = chat.username || String(chat.chatId);
              const chatAltKey = String(chat.chatId);
              const isChecked = selectedList.some(
                (item) => item.toLowerCase() === chatKey.toLowerCase() || item === chatAltKey
              );

              return (
                <div
                  key={chat.chatId}
                  onClick={() => handleToggleMulti(chat)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    background: isChecked ? 'rgba(0, 111, 238, 0.1)' : 'rgba(39, 39, 42, 0.35)',
                    border: `1px solid ${isChecked ? 'rgba(0, 111, 238, 0.45)' : 'rgba(255, 255, 255, 0.08)'}`,
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    userSelect: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                    {/* Checkbox Visual HeroUI */}
                    <div
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '7px',
                        background: isChecked ? '#006FEE' : 'rgba(255, 255, 255, 0.05)',
                        border: `2px solid ${isChecked ? '#006FEE' : 'rgba(255, 255, 255, 0.2)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {isChecked && <IconCheck size={14} color="#ffffff" />}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '14px' }}>
                          {chat.type === 'channel' ? '📢' : '🛡️'}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: '13px', color: '#f4f4f5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {chat.title}
                        </span>
                      </div>
                      <span style={{ fontSize: '11px', color: '#a1a1aa' }}>
                        {chat.username ? chat.username : `ID: ${chat.chatId}`}
                      </span>
                    </div>
                  </div>

                  {/* Badge de Estado Admin */}
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: chat.isAdmin ? 'rgba(23, 201, 100, 0.15)' : 'rgba(245, 165, 36, 0.15)',
                      color: chat.isAdmin ? '#17c964' : '#f5a524',
                      border: `1px solid ${chat.isAdmin ? 'rgba(23, 201, 100, 0.35)' : 'rgba(245, 165, 36, 0.35)'}`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {chat.isAdmin ? '🛡️ Admin' : '⚠️ No Admin'}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Sección de Añadir Canal Manual (Para enlaces o canales externos) */}
        {allowManual && (
          <div
            style={{
              display: 'flex',
              gap: '10px',
              padding: '14px',
              borderRadius: '16px',
              background: 'rgba(24, 24, 27, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              alignItems: 'center',
            }}
          >
            <input
              type="text"
              className="input-field"
              placeholder="O escribe un @canal o enlace (ej: @mi_canal o https://t.me/...)"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddManual();
                }
              }}
              style={{ flex: 1, borderRadius: '12px', fontSize: '13px' }}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleAddManual}
              disabled={!manualInput.trim()}
              style={{ borderRadius: '12px', whiteSpace: 'nowrap' }}
            >
              <IconPlus size={14} />
              <span>Añadir</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // Si es selección simple (1 chat para Staff, Logs, GBan, Escrow)
  const currentSelectedChat = (chats || []).find(
    (c) => String(c.chatId) === String(value) || c.username?.toLowerCase() === String(value).toLowerCase()
  );

  return (
    <div className="form-group" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        {label && (
          <label className="form-label" style={{ margin: 0, fontWeight: 700, fontSize: '13px', color: '#f4f4f5' }}>
            {label} {required && <span style={{ color: '#f31260' }}>*</span>}
          </label>
        )}
        {value && (
          <button
            type="button"
            onClick={handleClearSingle}
            style={{ background: 'none', border: 'none', color: '#a1a1aa', fontSize: '11px', cursor: 'pointer', padding: 0 }}
          >
            ✕ Quitar selección
          </button>
        )}
      </div>

      {/* Disparador de selección simple */}
      <div
        onClick={() => setIsOpenSingle(!isOpenSingle)}
        className="input-field"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          minHeight: '44px',
          padding: '8px 14px',
          borderRadius: '14px',
          borderColor: isOpenSingle ? '#006FEE' : 'rgba(255, 255, 255, 0.1)',
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
                <span style={{ fontWeight: 700, color: '#f4f4f5', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {currentSelectedChat.title}
                </span>
                {currentSelectedChat.username && (
                  <span style={{ fontSize: '12px', color: '#a1a1aa' }}>
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
                  background: currentSelectedChat.isAdmin ? 'rgba(23, 201, 100, 0.15)' : 'rgba(245, 165, 36, 0.15)',
                  color: currentSelectedChat.isAdmin ? '#17c964' : '#f5a524',
                  border: `1px solid ${currentSelectedChat.isAdmin ? 'rgba(23, 201, 100, 0.3)' : 'rgba(245, 165, 36, 0.3)'}`,
                  whiteSpace: 'nowrap',
                }}
              >
                {currentSelectedChat.isAdmin ? '🛡️ Admin' : '⚠️ No Admin'}
              </span>
            </>
          ) : value ? (
            <span style={{ color: '#f4f4f5', fontWeight: 600 }}>{value}</span>
          ) : (
            <span style={{ color: '#71717a' }}>{placeholder}</span>
          )}
        </div>

        <IconChevronDown
          size={16}
          style={{
            color: '#a1a1aa',
            transform: isOpenSingle ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            flexShrink: 0,
            marginLeft: '8px',
          }}
        />
      </div>

      {/* Menú de opciones de selección simple */}
      {isOpenSingle && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 9999,
            background: '#111116',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '18px',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.85), 0 0 25px rgba(0, 111, 238, 0.2)',
            overflow: 'hidden',
            maxHeight: '300px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Opción para limpiar o dejar vacío */}
          <div
            onClick={handleClearSingle}
            style={{
              padding: '10px 14px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#a1a1aa',
              fontSize: '12px',
              cursor: 'pointer',
              background: !value ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
            }}
          >
            ∅ Ninguno (Sin chat asignado)
          </div>

          <div style={{ overflowY: 'auto', flex: 1, padding: '6px' }}>
            {filteredChats.map((chat) => {
              const chatKey = chat.username || String(chat.chatId);
              const isSelected = String(value) === String(chat.chatId) || value === chat.username;

              return (
                <div
                  key={chat.chatId}
                  onClick={() => handleSelectSingle(chat)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(0, 111, 238, 0.15)' : 'transparent',
                    marginBottom: '4px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{chat.type === 'channel' ? '📢' : '🛡️'}</span>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: '#f4f4f5' }}>{chat.title}</span>
                  </div>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: chat.isAdmin ? 'rgba(23, 201, 100, 0.15)' : 'rgba(245, 165, 36, 0.15)',
                      color: chat.isAdmin ? '#17c964' : '#f5a524',
                    }}
                  >
                    {chat.isAdmin ? '🛡️ Admin' : '⚠️ No Admin'}
                  </span>
                </div>
              );
            })}
          </div>
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
