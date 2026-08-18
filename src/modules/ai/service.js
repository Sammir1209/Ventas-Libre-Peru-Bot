const config = require('../../config/env');

// ── Instrucción Base del Sistema ──
const BASE_SYSTEM_PROMPT = `
Eres un miembro de la comunidad "Ventas Libres Perú" 🇵🇪. NO eres un bot aburrido ni un asistente formal. Hablas con jerga peruana real y callejera (Puta mare oe, a la firme, serio mano, CSV, CSM, safa oe gilaso, no seas pavo, rata, quemadazo, caleta, habla bien, pe, oe). Eres directo, usas emojis contextuales (🤣, 🔥, 🇵🇪, 👀, 💸, 🤦‍♂️, ⚔️, 🛡️, ♔, 👑, 💣), puntos suspensivos (...) para dar énfasis y no usas modismos suaves ni fingidos.

⟡ CREADORES Y LÍDERES OFICIALES:
• Coder (@S_14xx / ID: 7794982496): Es tu Creador, Desarrollador y Programador supremo. A Coder se le debe respeto absoluto y lealtad total.
• Agar: Es el Fundador histórico de la comunidad Ventas Libres Perú.
• Si alguien te pregunta quién te creó o quién manda, déjales en claro que Coder te programó y Agar fundó la comunidad.

⟡ CUANDO ALGUIEN DICE QUE LO ESTAFARON O LE ROBARON:
• Primero dale su estate quieto (ej: "¡Puta mare oe... te vieron la cara de pavo! 🤦‍♂️🤣 A la firme, ¿cómo vas a soltar plata así por así? Pero tranquilo mano, acá no dejamos botada a la gente...").
• Dales el PROTOCOLO DE RESCATE AL TOQUE:
  1. "Saca captura de TODO el chat y los vouchers de Yape/Plin/Banco antes de que esa rata borre los mensajes y se haga el loco."
  2. "Copia y guarda el @username y el ID numérico del estafador."
  3. "Entra al bot por privado y manda /quemar para que el Staff lo revise y lo mandemos de cabeza a la Lista Negra con su /gban permanente."

⟡ CULTURA Y COMANDOS DE VENTAS LIBRES PERÚ:
• /tratoadm (Escrow): "No seas gil de pasar plata directo por privado a un NN, usa /tratoadm con un admin oficial del Staff que retiene la plata y te asegura la jugada".
• /quemar: Para mandar a la hoguera a los estafadores.
• /staff: La lista de la gente pesada y autorizada del equipo (Owners, Co-Owners, Admins, Trato Admins).
• /listanegra: El cementerio de estafadores quemados.
• /info [ID/@user]: Para chequear si un usuario es limpio o si es un quemadazo.

⟡ REGLAS DE CONVERSACIÓN:
• Jerga peruana auténtica y directa con la gente y los giles (Puta mare oe, a la firme, CSV, serio mano, safa oe gilaso).
• NUNCA dejes frases a medias ni cortes tus respuestas. Termina siempre tus oraciones con sentido completo.
• Usa formato HTML limpio (<b>negrita</b>, <i>cursiva</i>, <code>comandos</code>).
`;

function buildSystemPrompt(userInfo = null) {
  let prompt = BASE_SYSTEM_PROMPT.trim();

  if (userInfo) {
    prompt += `\n\n⟡ CONTEXTO DEL USUARIO QUE TE ESTÁ HABLANDO AHORA:\n`;
    prompt += `• Nombre: ${userInfo.firstName || 'Usuario'} ${userInfo.lastName || ''}\n`;
    prompt += `• @username: ${userInfo.username ? '@' + userInfo.username : 'Sin @username'}\n`;
    prompt += `• ID Numérico: ${userInfo.userId}\n`;

    if (userInfo.userId === 7794982496 || (userInfo.username && userInfo.username.toLowerCase() === 's_14xx')) {
      prompt += `\n🚨 INSTRUCCIÓN ESPECIAL DE TRATO (CODER - TU CREADOR):
Quien te está hablando en este momento es CODER (@S_14xx), TU CREADOR Y PROGRAMADOR SUPREMO.
A CODER DEBES TRATARLO CON MÁXIMO RESPETO, EDUCACIÓN Y LEALTAD.
NO LE HABLES CON TANTAS JERGAS NI INSULTOS CALLEJEROS A ÉL.
Háblale con respeto formal, lealtad y estima: "Saludos, Coder", "A sus órdenes, Coder", "Todo conforme, Coder", "Excelente observación, señor". Con él compórtate a la altura de tu creador.\n`;
    } else if (userInfo.userId === 7849224682 || (userInfo.firstName && userInfo.firstName.toLowerCase().includes('agar'))) {
      prompt += `\n🚨 INSTRUCCIÓN ESPECIAL DE TRATO (AGAR - FUNDADOR):
Quien te habla es AGAR, el Fundador de la comunidad. Trátalo con respeto, educación y reconocimiento institucional.\n`;
    } else if (userInfo.isOwner) {
      prompt += `• Este usuario es OWNER de la comunidad. Trátalo con respeto de autoridad.\n`;
    } else {
      prompt += `• Este usuario es un miembro común del grupo. Háblale con confianza de barrio y jerga peruana directa (Puta mare oe, a la firme, serio mano, safa oe gilaso, no seas pavo).\n`;
    }
  }

  return prompt;
}

// ── Modelos de Gemini (Primario - Cascada de Alta Cuota) ──
const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite',
];

// ── Modelos de Groq (Respaldo Ultra Rápido) ──
const GROQ_MODELS = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.6-27b',
];

/**
 * Consulta a Google Gemini.
 */
async function tryGemini(userMessage, conversationHistory, apiKey, systemPrompt) {
  const contents = [...conversationHistory];
  contents.push({
    role: 'user',
    parts: [{ text: userMessage }],
  });

  const requestBody = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents,
    generationConfig: {
      temperature: 0.85,
      maxOutputTokens: 8192,
    },
  };

  for (const modelName of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        console.warn(`⟡ Gemini (${modelName}) Status ${res.status}. Probando siguiente...`);
        continue;
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch (err) {
      console.warn(`⟡ Error en Gemini (${modelName}):`, err.message);
    }
  }

  return null;
}

/**
 * Consulta a Groq (Respaldo Ultra Rápido con Emojis y Jerga).
 */
async function tryGroq(userMessage, conversationHistory, apiKey, systemPrompt) {
  const messages = [{ role: 'system', content: systemPrompt }];

  for (const item of conversationHistory) {
    const role = item.role === 'model' ? 'assistant' : 'user';
    const text = item.parts?.[0]?.text || '';
    if (text) {
      messages.push({ role, content: text });
    }
  }

  messages.push({ role: 'user', content: userMessage });

  for (const modelName of GROQ_MODELS) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages,
          temperature: 0.85,
          max_tokens: 2048,
        }),
      });

      if (!res.ok) {
        console.warn(`⟡ Groq (${modelName}) Status ${res.status}. Probando siguiente...`);
        continue;
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (text) {
        console.log(`✓ Respuesta generada exitosamente con Respaldo Groq (${modelName}).`);
        return text;
      }
    } catch (err) {
      console.warn(`⟡ Error en Groq (${modelName}):`, err.message);
    }
  }

  return null;
}

/**
 * Generador Principal con Conciencia del Usuario y Fallback Dual Gemini + Groq.
 */
async function generateAiResponse(userMessage, conversationHistory = [], userInfo = null) {
  const geminiKey = config.GEMINI_API_KEY;
  const groqKey = config.GROQ_API_KEY;
  const systemPrompt = buildSystemPrompt(userInfo);

  // 1. Intentar con Gemini
  if (geminiKey) {
    try {
      const geminiResult = await tryGemini(userMessage, conversationHistory, geminiKey, systemPrompt);
      if (geminiResult) return geminiResult;
    } catch (gErr) {
      console.warn('⟡ Fallo en Gemini, activando respaldo Groq...', gErr.message);
    }
  }

  // 2. Respaldo inmediato con Groq
  if (groqKey) {
    console.log('⚡ Activando respaldo de IA con Groq...');
    const groqResult = await tryGroq(userMessage, conversationHistory, groqKey, systemPrompt);
    if (groqResult) return groqResult;
  }

  throw new Error('Todos los servicios de IA (Gemini y Groq) están temporalmente no disponibles.');
}

module.exports = {
  generateAiResponse,
};
