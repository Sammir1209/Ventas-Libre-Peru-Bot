const config = require('../../config/env');

const GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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
      temperature: 0.8,
      maxOutputTokens: 8192,
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
