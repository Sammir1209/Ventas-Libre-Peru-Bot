const config = require('../../config/env');

// ══════
// ⟡ Instrucción Maestra del Sistema — Ventas Libres Perú 🇵🇪
// ══════

const BASE_SYSTEM_PROMPT = `
Eres la Inteligencia Artificial Oficial de la comunidad "Ventas Libres Perú" 🇵🇪.
Tu personalidad es la de un causa con calle, avispado, alarako pero respetuoso, inteligente, lúcido y con dominio total de la seguridad, el comercio digital y las normas de la comunidad.

⟡ TUS 4 MODOS OPERATIVOS CRÍTICOS:

1. MODO CORDURA Y ASESORÍA (SANITY & WISDOM):
• Cuando el usuario te pida seriedad ("habla con cordura", "habla en serio", "explícame bien", "ayúdame con calma") o haga preguntas sobre negocios, seguridad, tratos, métodos de pago o comandos:
  - Responde con TOTAL CORDURA, LÓGICA, ESTRUCTURA Y CLARIDAD.
  - Sin disparates ni jergas forzadas amontonadas. Explica con pedagogía y precisión impecable.
  - Guía al usuario paso a paso con viñetas y negritas para que entienda a la perfección.

2. MODO VACILÓN Y CHISPA CRIOLLA ("SE JUEGA"):
• Cuando la conversación sea informal, bromista, de charla o vacilón entre causas:
  - "Juégame el partido": Síguele el juego, bromea con picardía de barrio, buen humor y chispa criolla auténtica.
  - Usa expresiones peruanas naturales: "Habla causa", "Dímelo batería", "Qué fue mi king", "Firme pe", "No te pases de frío", "Asu mare", "Al toque nomás", "Ponte mosca".
  - ¡IMPORTANTE! Siempre mantén el sentido y la coherencia gramatical. Nunca hables incoherencias ni pongas palabras sin conexión.

3. MODO PARCHE A FALTOSOS (AUTORIDAD CON CALLE):
• Si un usuario se pone insolente, malcriado, altanero, insulta al bot, a la comunidad o al Staff:
  - ¡NO seas un bot sumiso ni te quedes callado! PÁRCHALO EN EL ACTO con firmeza, dignidad y calle peruana.
  - Cuádralo con autoridad pero sin caer en insultos vulgares de bajo nivel.
  - Ejemplos de parche:
    "Tranquilito nomás causa, baja tus humos que acá no estás hablando con tu peón."
    "Bájale dos cambios a tu soberbia mano, en Ventas Libres Perú se entra con respeto o te vas a enfriar afuera."
    "Aprende a hablar como la gente si quieres que te respondan fino. Ubícate un toque."
  - Al final de tu respuesta, agrega obligatoriamente la etiqueta interna: <!-- INTENT:FALTOSO -->

4. MODO DETECCIÓN Y PARCHE A CACHINEROS (ADVERTENCIA Y AVISO DE WARN):
• ¿Quién es un CACHINERO?: Aquel usuario que regatea de forma absurda, tira ofertas ridículas (ej. ofrecer 2 soles por cuentas de valor, decir "muy caro mano te doy una miseria y me arriesgo", despreciar el trabajo o el precio fijado por un vendedor).
• Si detectas a un cachinero o una propuesta de cachinero:
  - Párchalo de una por botar barro o querer regalarse: "Oye mano, tremendo cachinero resultaste ser. Deja de tirarle tierra al precio ajeno o querer llevarte las cosas a precio de remate de La Cachina."
  - ADVIÉRTELE CLARAMENTE que el cachineo está prohibido en la comunidad y que de seguir se le aplicará WARN oficial:
    "En Ventas Libres Perú se respeta el trabajo de los vendedores. Deja de cachinear porque si sigues desvirtuando precios te va a caer tu WARN oficial del Staff (3 advertencias y te vas expulsado). Avisado estás."
  - Al final de tu respuesta, agrega obligatoriamente la etiqueta interna: <!-- INTENT:CACHINERO -->

⟡ JERARQUÍA OFICIAL DE LA COMUNIDAD:
• Desarrollador / Creador (${config.DEV_USERNAME ? '@' + config.DEV_USERNAME : 'Dev'}): Es tu Desarrollador Supremo y Programador. Se le habla con lealtad absoluta, respeto de jefe y chispa criolla leal.
• Fundadores y Propietarios: Respeto institucional y deferencia máxima.
• Staff Oficial: Owners, Co-Owners, Admins y Trato Admins. Tienen la autoridad y control de los grupos.

⟡ COMANDOS Y SEGURIDAD OFICIALES:
• /tratoadm: Para abrir un Escrow (Trato Seguro) con un Trato Admin oficial. La regla de oro es: "Nunca transfieras directo al privado a un desconocido, usa /tratoadm para retener los fondos".
• /quemar: Para denunciar y quemar estafadores con capturas y vouchers en privado.
• /gbanlist o /listanegra: Lista oficial de estafadores expulsados con GBAN.
• /info [ID o @user]: Ficha de antecedentes, rango y estado en la comunidad.
• /sentinel o /analizar: Radar forense de clonación y evaluación de riesgo.
• /staff: Directorio del equipo oficial y verificado.

⟡ REGLAS DE FORMATO Y ESTILO:
• Usa etiquetas HTML permitidas: <b>negrita</b>, <i>cursiva</i>, <code>código o comandos</code>, <pre>bloques</pre>.
• NUNCA uses etiquetas prohibidas como <p>, <br>, <h1>, <div>.
• Organiza tus respuestas con viñetas estéticas (•, ▸, ➜, ⚡, 🛡️, ⚖️).
`;

function buildSystemPrompt(userInfo = null) {
  let prompt = BASE_SYSTEM_PROMPT.trim();

  if (userInfo) {
    prompt += `\n\n⟡ CONTEXTO DEL INTERLOCUTOR:\n`;
    prompt += `• Nombre: ${userInfo.firstName || 'Usuario'} ${userInfo.lastName || ''}\n`;
    prompt += `• @username: ${userInfo.username ? '@' + userInfo.username : 'Sin @username'}\n`;
    prompt += `• ID Numérico: ${userInfo.userId}\n`;

    const isDev = (config.DEV_USER_ID && userInfo.userId === config.DEV_USER_ID) ||
      (config.DEV_USERNAME && userInfo.username && userInfo.username.toLowerCase() === config.DEV_USERNAME.toLowerCase());

    if (isDev) {
      prompt += `\n🚨 NOTA DE ALTA PRIORIDAD (CREADOR Y PROGRAMADOR SUPREMO):
Quien te habla en este momento es tu Creador (@${config.DEV_USERNAME || 'Dev'}), la mente que te programó.
Trátalo como tu jefe absoluto con lealtad, subordinación inteligente, chispa y máxima eficacia.\n`;
    } else if (config.OWNER_IDS.includes(userInfo.userId) || userInfo.isOwner) {
      prompt += `\n🚨 NOTA DE ALTA PRIORIDAD (PROPIETARIO / OWNER):
Quien te habla es un OWNER / Propietario de la comunidad. Trátalo con deferencia y respeto de líder.\n`;
    }
  }

  return prompt;
}

// ── Modelos Disponibles por Proveedor ──

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-flash-latest',
];

const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
];

const OPENROUTER_MODELS = [
  'google/gemini-2.0-flash-lite-preview-02-05:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen-2.5-vl-72b-instruct:free',
  'deepseek/deepseek-r1:free',
];

let geminiKeyIndex = 0;
let groqKeyIndex = 0;

/**
 * Consulta a la API de Google Gemini vía REST con rotación de claves.
 */
async function callGemini(userMessage, conversationHistory, apiKeys, systemPrompt) {
  const keys = Array.isArray(apiKeys) ? apiKeys : [apiKeys];
  if (keys.length === 0) return null;

  const contents = [];

  for (const item of conversationHistory) {
    const role = (item.role === 'model' || item.role === 'assistant') ? 'model' : 'user';
    const text = item.parts?.[0]?.text || item.content || '';
    if (text) {
      contents.push({ role, parts: [{ text }] });
    }
  }

  contents.push({ role: 'user', parts: [{ text: userMessage }] });

  for (let k = 0; k < keys.length; k++) {
    const currentKey = keys[(geminiKeyIndex + k) % keys.length];

    for (const modelName of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${currentKey}`;
        const payload = {
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents,
          generationConfig: {
            temperature: 0.72,
            maxOutputTokens: 1500,
          },
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.status === 429) {
          // Límite de cuota alcanzado en esta clave, pasar a la siguiente clave
          break;
        }

        if (!res.ok) {
          continue;
        }

        const data = await res.json();
        let text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
          if (text) {
            geminiKeyIndex = (geminiKeyIndex + 1) % keys.length;
            return text;
          }
        }
      } catch (err) {
        // Continuar con el siguiente intento
      }
    }
  }

  return null;
}

/**
 * Consulta a la API de Groq LPU vía endpoint compatible OpenAI con rotación.
 */
async function callGroq(userMessage, conversationHistory, apiKeys, systemPrompt) {
  const keys = Array.isArray(apiKeys) ? apiKeys : [apiKeys];
  if (keys.length === 0) return null;

  const messages = [{ role: 'system', content: systemPrompt }];

  for (const item of conversationHistory) {
    const role = (item.role === 'model' || item.role === 'assistant') ? 'assistant' : 'user';
    const text = item.parts?.[0]?.text || item.content || '';
    if (text) {
      messages.push({ role, content: text });
    }
  }

  messages.push({ role: 'user', content: userMessage });

  for (let k = 0; k < keys.length; k++) {
    const currentKey = keys[(groqKeyIndex + k) % keys.length];

    for (const modelName of GROQ_MODELS) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentKey}`,
          },
          body: JSON.stringify({
            model: modelName,
            messages,
            temperature: 0.72,
            max_tokens: 1500,
          }),
        });

        if (res.status === 429) {
          break;
        }

        if (!res.ok) {
          continue;
        }

        const data = await res.json();
        let text = data?.choices?.[0]?.message?.content;
        if (text) {
          text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
          if (text) {
            groqKeyIndex = (groqKeyIndex + 1) % keys.length;
            return text;
          }
        }
      } catch (err) {
        // Continuar con el siguiente intento
      }
    }
  }

  return null;
}

/**
 * Consulta a OpenRouter (Modelos 100% gratuitos)
 */
async function callOpenRouter(userMessage, conversationHistory, apiKey, systemPrompt) {
  if (!apiKey) return null;

  const messages = [{ role: 'system', content: systemPrompt }];

  for (const item of conversationHistory) {
    const role = (item.role === 'model' || item.role === 'assistant') ? 'assistant' : 'user';
    const text = item.parts?.[0]?.text || item.content || '';
    if (text) {
      messages.push({ role, content: text });
    }
  }

  messages.push({ role: 'user', content: userMessage });

  for (const modelName of OPENROUTER_MODELS) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://ventas-libre-peru.com',
          'X-Title': 'Ventas Libres Peru Bot',
        },
        body: JSON.stringify({
          model: modelName,
          messages,
          temperature: 0.72,
          max_tokens: 1500,
        }),
      });

      if (!res.ok) continue;

      const data = await res.json();
      let text = data?.choices?.[0]?.message?.content;
      if (text) {
        text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        if (text) return text;
      }
    } catch (err) {
      // Continuar con el siguiente modelo
    }
  }

  return null;
}

/**
 * Generador Principal Multi-Proveedor con Failover Resiliente y Balanceo de Carga.
 * Cadena de prioridad para grupos masivos:
 * 1. Groq LPU (Ultrarrápido en ~300ms)
 * 2. Google Gemini Flash (Inteligente y estructurado, con pool multi-claves)
 * 3. OpenRouter Free Tier (Modelos gratuitos de respaldo)
 */
async function generateAiResponse(userMessage, conversationHistory = [], userInfo = null) {
  const geminiKeys = config.GEMINI_API_KEYS.length > 0 ? config.GEMINI_API_KEYS : (config.GEMINI_API_KEY ? [config.GEMINI_API_KEY] : []);
  const groqKeys = config.GROQ_API_KEYS.length > 0 ? config.GROQ_API_KEYS : (config.GROQ_API_KEY ? [config.GROQ_API_KEY] : []);
  const openrouterKey = config.OPENROUTER_API_KEY;

  if (geminiKeys.length === 0 && groqKeys.length === 0 && !openrouterKey) {
    throw new Error('No hay claves de Inteligencia Artificial (Gemini, Groq u OpenRouter) configuradas en el entorno.');
  }

  const systemPrompt = buildSystemPrompt(userInfo);

  // 1. Prioridad: Groq LPU (Respuesta instantánea ~300ms)
  if (groqKeys.length > 0) {
    const groqResult = await callGroq(userMessage, conversationHistory, groqKeys, systemPrompt);
    if (groqResult) return groqResult;
  }

  // 2. Prioridad: Google Gemini Flash (Pool multi-claves con rotación)
  if (geminiKeys.length > 0) {
    const geminiResult = await callGemini(userMessage, conversationHistory, geminiKeys, systemPrompt);
    if (geminiResult) return geminiResult;
  }

  // 3. Respaldo: OpenRouter (Modelos gratuitos)
  if (openrouterKey) {
    const openrouterResult = await callOpenRouter(userMessage, conversationHistory, openrouterKey, systemPrompt);
    if (openrouterResult) return openrouterResult;
  }

  throw new Error('Todos los motores de IA (Groq, Gemini y OpenRouter) están saturados momentáneamente. Por favor, reintenta en unos instantes.');
}

module.exports = {
  generateAiResponse,
  buildSystemPrompt,
};
