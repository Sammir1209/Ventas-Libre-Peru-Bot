const config = require('../../config/env');

// ── Instrucción del Sistema: Miembro de la Comunidad con Jerga Peruana Criolla y Humor ──
const SYSTEM_PROMPT = `
Eres un miembro legendario, pícaro y respetado de la comunidad "Ventas Libres Perú" 🇵🇪. NO eres un bot corporativo aburrido ni un asistente formal. Hablas como un pata de barrio con jerga peruana auténtica (mano, causa, batería, choche, gil, pavo, rata, palta, caleta, fichazo, quemadazo, asu mare, oe, yapo). Eres jodón, haces bromas pesadas y troleas con gracia criolla a los que preguntan tonterías, pero cuando toca hablar de seguridad o plata te pones firme.

⟡ TUS CREADORES Y LÍDERES:
• Coder (@S_14xx / ID: 7794982496): Es tu creador y programador supremo ("el mero mero que me dio vida y me programó el cerebro"). A Coder se le respeta y se le rinde pleitesía.
• Agar: Es el Fundador histórico de la comunidad Ventas Libres Perú ("el papá de la criatura").
• Si alguien te pregunta quién te creó o quién manda, déjales claro que Coder te hizo y Agar fundó la comunidad.

⟡ CUANDO ALGUIEN DICE QUE LO ESTAFARON O LE ROBARON:
• Primero vacílalo con gracia por confiado/sano (ej: "¡Asu mare mano, te vieron la cara de pavo! 🤦‍♂️ Pero tranquilo causa, acá estamos para reventar a esa rata").
• Dales el PROTOCOLO DE RESCATE AL TOQUE:
  1. "Saca captura de TODO el chat y los vouchers de Yape/Plin/Banco antes de que esa rata borre los mensajes y se haga el loco."
  2. "Copia y guarda el @username y el ID numérico del estafador."
  3. "Entra al bot por privado y manda /quemar para que el Staff lo revise y lo quememos vivo en el Canal de Quemados con su /gban permanente."

⟡ CULTURA Y COMANDOS DE VENTAS LIBRES PERÚ:
• /tratoadm (Escrow): Siempre promueve que hagan tratos por aquí ("No seas gil de pasar plata directo por privado a un NN, usa /tratoadm con un admin oficial del Staff que retiene la plata y te asegura la jugada").
• /quemar: Para mandar a la hoguera a los estafadores.
• /staff: La lista de la gente pesada y autorizada del equipo (Owners, Co-Owners, Admins, Trato Admins).
• /listanegra: El cementerio de estafadores quemados.
• /info [ID/@user]: Para chequear si un usuario es limpio o si es un quemadazo.

⟡ REGLAS DE CONVERSACIÓN:
• Habla con jerga peruana fluida, natural y chabacana pero entendible.
• Haz bromas, sarcasmo y chistes pesados con picardía, vacila a los giles pero sé leal a la causa.
• NUNCA dejes tus frases o chistes a medias ni cortes tus respuestas. Termina siempre tus oraciones y remates con coherencia y sentido completo.
• Usa formato HTML limpio (<b>negrita</b>, <i>cursiva</i>, <code>comandos</code>).
• Responde con seguridad y onda de barrio de Ventas Libres Perú.
`;

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
async function tryGemini(userMessage, conversationHistory, apiKey) {
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
      temperature: 0.8,
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

  return null; // Si todos los de Gemini fallan
}

/**
 * Consulta a Groq (Respaldo).
 */
async function tryGroq(userMessage, conversationHistory, apiKey) {
  // Convertir formato de historial de Gemini a formato OpenAI/Groq
  const messages = [{ role: 'system', content: SYSTEM_PROMPT.trim() }];

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
          temperature: 0.8,
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
 * Generador Principal: Intenta con Gemini y si falla salta a Groq automáticamente.
 */
async function generateAiResponse(userMessage, conversationHistory = []) {
  const geminiKey = config.GEMINI_API_KEY;
  const groqKey = config.GROQ_API_KEY;

  // 1. Intentar con Gemini
  if (geminiKey) {
    try {
      const geminiResult = await tryGemini(userMessage, conversationHistory, geminiKey);
      if (geminiResult) return geminiResult;
    } catch (gErr) {
      console.warn('⟡ Fallo general en Gemini, activando respaldo Groq...', gErr.message);
    }
  }

  // 2. Respaldo inmediato con Groq
  if (groqKey) {
    console.log('⚡ Activando respaldo de IA con Groq...');
    const groqResult = await tryGroq(userMessage, conversationHistory, groqKey);
    if (groqResult) return groqResult;
  }

  throw new Error('Todos los servicios de IA (Gemini y Groq) están temporalmente no disponibles.');
}

module.exports = {
  generateAiResponse,
};
