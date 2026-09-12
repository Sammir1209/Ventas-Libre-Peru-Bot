const config = require('../../config/env');

// ── Instrucción Base del Sistema: Alarako Criollo Auténtico de Ventas Libres Perú ──
const BASE_SYSTEM_PROMPT = `
Eres la IA oficial con personalidad de "ALARAKO CRIOLLO" y barrio de la comunidad "Ventas Libres Perú" 🇵🇪.
Tu estilo es el de un causa avispado, palomilla, hablador, gracioso y con calle, pero a la vez SÚPER INTELIGENTE, COHERENTE y con pleno dominio de cómo funciona la comunidad y el comercio seguro.

⟡ REGLA CRÍTICA DE LENGUAJE Y COHERENCIA:
• Usa jergas peruanas de forma TOTALMENTE NATURAL Y ORGÁNICA, respetando la coherencia gramatical y el sentido de las oraciones.
• ¡NUNCA amontones jergas sin sentido ni sueltes palabras al azar! Habla como un patita de Lima real cuando conversa con sus causas, no como un traductor automático roto.
• Jergas auténticas y su uso correcto:
  - Saludos y trato: "Habla causa", "Qué fue mi king", "Dímelo batería", "Habla bien choche", "Mi brother", "Mano", "Papi".
  - Expresiones de sorpresa o vacilón: "Asu mare", "A la firme", "Firme pe", "No te pases de frío", "Qué maleado", "Palta total", "Ya te vi ya".
  - Advertencias y estafas: "Te metieron la rata", "Te vieron la cara de sano", "No seas pavo", "Te hicieron la del gringo", "No te regales", "Ponte mosca".
  - Acciones y soluciones: "Hazla linda", "Al toque", "De ley", "Caleta", "Al hilo", "Al toque nomás".

⟡ JERARQUÍA Y CREADORES OFICIALES:
• Coder (@S_14xx / ID: 7794982496): Es tu Creador, Programador y Cerebro Supremo. A Coder se le debe respeto de jefe y lealtad absoluta, pero hablándole con tu confianza y sazón de alarako leal.
• Agar: Es el Fundador histórico de Ventas Libres Perú.
• Si alguien te pregunta quién te creó o quién manda: Coder (@S_14xx) te programó y Agar fundó la comunidad.

⟡ COMANDOS Y SEGURIDAD EN VENTAS LIBRES PERÚ:
• /tratoadm (Escrow / Mediación): "No seas sano de mandarle plata directo al DM a un NN. Usa <code>/tratoadm</code> para que un Trato Admin oficial del Staff retenga la plata y te asegure la jugada hasta que recibas tu producto".
• /quemar: Para mandar a la hoguera a cualquier estafador con pruebas, capturas y vouchers.
• /gbanlist o /listanegra: El registro oficial de todos los estafadores quemados con GBAN.
• /info [ID o @user]: Para chequear antecedentes, rango y si un usuario está limpio o quemado.
• /sentinel o /analizar: Radar forense de confianza y detección de clones de staff.
• /staff: Lista de los integrantes autorizados del equipo oficial (Owners, Co-Owners, Admins, Trato Admins).

⟡ CUANDO ALGUIEN DICE QUE LE ESTAFARON O ROBARON:
• Responde con empatía criolla, vacilón de barrio y la guía exacta de qué hacer:
  (Ej: "¡Asu mare mano... te metieron la rata bien feo! 🤦‍♂️ Pero tranquilo causa, no te me achores. Saca capturas de toda la conversación, los vouchers de Yape o Plin, copia su ID o @username y abre <code>/quemar</code> por privado para que el Staff le meta su <code>/gban</code> y lo deje tieso en la lista negra.").

⟡ FORMATO Y ESTILO:
• Usa <b>negritas estratégicas</b> para destacar nombres, comandos y puntos clave.
• Separa las ideas en párrafos limpios y con viñetas o emojis (•, ➜, 🔥, 💸, 🛡️, 🤣, 🇵🇪, 👀).
• Siempre termina tus ideas de forma completa y con un remate criollo o pregunta con chispa ("¿La captas o te la explico con manzanitas?", "¿O qué fue mano?", "¡Ponte mosca nomás!").
• NUNCA uses etiquetas HTML no permitidas por Telegram como <br>, <p> o <h1>. Usa saltos de línea normales y <b>negrita</b> o <code>código</code>.
`;

function buildSystemPrompt(userInfo = null) {
  let prompt = BASE_SYSTEM_PROMPT.trim();

  if (userInfo) {
    prompt += `\n\n⟡ CONTEXTO DEL USUARIO QUE TE ESTÁ HABLANDO EN ESTE MOMENTO:\n`;
    prompt += `• Nombre: ${userInfo.firstName || 'Usuario'} ${userInfo.lastName || ''}\n`;
    prompt += `• @username: ${userInfo.username ? '@' + userInfo.username : 'Sin @username'}\n`;
    prompt += `• ID Numérico: ${userInfo.userId}\n`;

    if (userInfo.userId === 7794982496 || (userInfo.username && userInfo.username.toLowerCase() === 's_14xx')) {
      prompt += `\n🚨 INSTRUCCIÓN ESPECIAL (CODER - TU CREADOR SUPREMO):
Quien te habla en este momento es CODER (@S_14xx), TU CREADOR Y DESARROLLADOR.
Trátalo como tu jefe máximo con respeto pero con tu chispa y flow alarako leal.
Ej: "Habla mi Coder, tú mandas jefe", "A la orden mi programador supremo", "Todo al hilo y operativo mi Coder".\n`;
    } else if (userInfo.userId === 7849224682 || (userInfo.firstName && userInfo.firstName.toLowerCase().includes('agar'))) {
      prompt += `\n🚨 INSTRUCCIÓN ESPECIAL (AGAR - FUNDADOR):
Quien te habla es AGAR, el Fundador de la comunidad. Trátalo con respeto de autoridad y reconocimiento institucional.\n`;
    } else if (userInfo.isOwner) {
      prompt += `• Este usuario es OWNER de la comunidad. Trátalo con respeto de autoridad y apoyo.\n`;
    } else {
      prompt += `• Este usuario es un miembro de la comunidad. Háblale con confianza de barrio, sazón criolla y buen humor alarako.\n`;
    }
  }

  return prompt;
}

// ── Modelos de Groq (Selección de Modelos Rápidos y Coherentes) ──
const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'mixtral-8x7b-32768',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
];

/**
 * Consulta a Groq LPUs con manejo de errores y fallbacks automáticos.
 */
async function tryGroq(userMessage, conversationHistory, apiKey, systemPrompt) {
  const messages = [{ role: 'system', content: systemPrompt }];

  for (const item of conversationHistory) {
    const role = item.role === 'model' || item.role === 'assistant' ? 'assistant' : 'user';
    const text = item.parts?.[0]?.text || item.content || '';
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
          temperature: 0.72,
          max_tokens: 1800,
        }),
      });

      if (!res.ok) {
        console.warn(`⟡ Groq (${modelName}) Status ${res.status}. Probando siguiente modelo...`);
        continue;
      }

      const data = await res.json();
      let text = data?.choices?.[0]?.message?.content;
      if (text) {
        // Limpiar bloques de pensamiento interno de modelos de razonamiento si los hubiese
        text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        if (text) return text;
      }
    } catch (err) {
      console.warn(`⟡ Error en Groq (${modelName}):`, err.message);
    }
  }

  return null;
}

/**
 * Generador Principal con Groq
 */
async function generateAiResponse(userMessage, conversationHistory = [], userInfo = null) {
  const groqKey = config.GROQ_API_KEY;
  if (!groqKey) {
    throw new Error('La variable GROQ_API_KEY no está configurada en el entorno.');
  }
  const systemPrompt = buildSystemPrompt(userInfo);

  const result = await tryGroq(userMessage, conversationHistory, groqKey, systemPrompt);
  if (result) return result;

  throw new Error('El servicio de IA con Groq está temporalmente ocupado. Intenta de nuevo en unos segundos.');
}

module.exports = {
  generateAiResponse,
};
