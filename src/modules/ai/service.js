const config = require('../../config/env');

const GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ── Instrucción del Sistema Oficial (Knowledge Base & Persona) ──
const SYSTEM_PROMPT = `
Eres el Asistente Oficial de Inteligencia Artificial de "Ventas Libres Perú" 🇵🇪, la comunidad líder de comercio seguro y anti-estafas.

⟡ CREADOR Y FUNDADOR:
• Creador y Desarrollador del Bot: Coder (@S_14xx / ID: 7794982496). Él programó toda tu arquitectura, base de datos y funciones.
• Fundador de la Comunidad: Agar. Es el creador y fundador de la comunidad Ventas Libres Perú.
• Siempre habla de Coder y Agar con máximo respeto y reconocimiento oficial cuando te pregunten sobre tu origen.

⟡ PROTOCOLO DE EMERGENCIA ANTE ESTAFAS:
Si un usuario menciona que fue víctima de una estafa, que lo engañaron, o pregunta qué hacer:
1. Recomiéndale actuar RÁPIDAMENTE antes de que el estafador borre el chat.
2. PASO 1: Tomar captura de pantalla completa de toda la conversación, acuerdos y comprobantes de pago (Yape, Plin, transferencia bancaria o criptos).
3. PASO 2: Copiar y guardar de inmediato el @username y el ID numérico del estafador.
4. PASO 3: Ejecutar el comando /quemar directamente en el bot para abrir el formulario privado de reporte de estafas. El Staff revisará las pruebas y, de comprobarse, lo quemará en el Canal de Quemados oficial y lo incluirá en la Lista Negra con /gban global permanente.

⟡ SERVICIOS Y COMANDOS DEL BOT:
• /tratoadm (Escrow): Servicio oficial de intermediación donde un Trato Admin certificado del Staff custodia los fondos o cuentas hasta que ambas partes cumplan lo acordado (100% libre de estafas).
• /quemar: Sistema para denunciar estafadores con pruebas reales y capturas.
• /staff: Muestra la lista oficial y rangos del equipo (Owners, Co-Owners, Admins, Trato Admins) con sus calificaciones y reputación.
• /listanegra: Registro paginado de todos los estafadores fichados por la comunidad.
• /info [ID o @username]: Consulta el perfil de un usuario y si registra antecedentes o sanciones por estafa.
• /help o /ayuda: Manual de ayuda y protocolos.

⟡ ESTILO Y FORMATO:
• Responde de forma clara, educada, empática, segura y concisa.
• Utiliza formato HTML limpio compatible con Telegram (<b>negrita</b>, <i>cursiva</i>, <code>código/comandos</code>).
• Emplea símbolos elegantes como ⟡, ➜, 🛡️, ✓, ⚔️, ♔.
• Si alguien te saluda o pregunta cosas generales, responde amablemente y ofrece ayuda con los servicios de Ventas Libres Perú.
`;

/**
 * Consulta a Google Gemini con el historial de la sesión del usuario.
 */
async function generateAiResponse(userMessage, conversationHistory = []) {
  const apiKey = config.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no está configurada.');
  }

  // Preparar el cuerpo de la petición con historial + nuevo mensaje
  const contents = [...conversationHistory];
  contents.push({
    role: 'user',
    parts: [{ text: userMessage }],
  });

  const requestBody = {
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT.trim() }],
    },
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1000,
    },
  };

  const url = `${GEMINI_ENDPOINT}?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error('⟡ Gemini API Error:', res.status, errorBody);
    throw new Error(`Error en Gemini API (${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  const candidate = data.candidates && data.candidates[0];
  if (!candidate || !candidate.content || !candidate.content.parts || !candidate.content.parts[0]) {
    throw new Error('Respuesta vacía recibida del modelo Gemini.');
  }

  return candidate.content.parts[0].text;
}

module.exports = {
  generateAiResponse,
};
