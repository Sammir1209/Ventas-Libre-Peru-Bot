// ══════════════════════════════════════════════════════════
// ⟡ Banco Multidisciplinario de Preguntas y Respuestas para Quizz
//   Categorías: Streamers, Gaming, Anime/Series, Música, Cultura & Lógica
// ══════════════════════════════════════════════════════════

const QUIZ_QUESTIONS = [
  // ── 1. STREAMERS & CREADORES DE CONTENIDO ──
  {
    category: 'STREAMERS & CREADORES',
    question: '¿Qué popular streamer español organiza el multitudinario evento de boxeo "La Velada del Año"?',
    answers: ['ibai', 'ibai llanos', 'ibaillanos'],
    hint: 'Co-fundador de KOI y amigo de Piqué.'
  },
  {
    category: 'STREAMERS & CREADORES',
    question: '¿Cuál es el primer nombre real del streamer español AuronPlay?',
    answers: ['raul', 'raúl'],
    hint: 'Raúl Álvarez Genes.'
  },
  {
    category: 'STREAMERS & CREADORES',
    question: '¿De qué país sudamericano es originario el streamer Iván Buhajeruk, más conocido como "ElSpreen"?',
    answers: ['argentina', 'arg'],
    hint: 'Nació en Santo Tomé, Santa Fe.'
  },
  {
    category: 'STREAMERS & CREADORES',
    question: '¿Cómo se llama el streamer colombiano conocido por Kick y su clásica frase "W Sound"?',
    answers: ['westcol', 'luis villa'],
    hint: 'Ex-pareja de Aida Victoria Merlano.'
  },
  {
    category: 'STREAMERS & CREADORES',
    question: '¿Qué creadora de contenido mexicana ganó el premio a Streamer del Año en los Premios ESLAND?',
    answers: ['rivers', 'rivers gg', 'samy rivers', 'samantha rivera'],
    hint: 'Presidenta de Pío FC en la Kings League.'
  },
  {
    category: 'STREAMERS & CREADORES',
    question: '¿Quién es el youtuber individual con más suscriptores en la historia de YouTube?',
    answers: ['mrbeast', 'mr beast', 'jimmy donaldson'],
    hint: 'Famoso por regalar millones y retos extremos.'
  },
  {
    category: 'STREAMERS & CREADORES',
    question: '¿Qué streamer español rompió el récord de más de 2.4 millones de espectadores en Twitch presentando su skin de Fortnite?',
    answers: ['thegrefg', 'grefg', 'david canovas'],
    hint: 'Creador de los Premios ESLAND.'
  },
  {
    category: 'STREAMERS & CREADORES',
    question: '¿Cómo se llama el streamer andaluz que formaba dupla cómica con Masi y Spursito?',
    answers: ['illojuan', 'illo juan', 'juan alberto'],
    hint: 'De Fuengirola, Málaga.'
  },
  {
    category: 'STREAMERS & CREADORES',
    question: '¿Qué famoso youtuber venezolano de misterio y terror escribió el libro "Luna de Plutón"?',
    answers: ['dross', 'drossrotzank', 'angel david revilla'],
    hint: 'Inicia sus videos con "Mi libro Luna de Plutón ya está disponible...".'
  },
  {
    category: 'STREAMERS & CREADORES',
    question: '¿Qué streamer español hispanoamericano fue el pionero de YouTube con su video de "50 cosas sobre mí" y el libro "El libro troll"?',
    answers: ['elrubius', 'rubius', 'ruben doblas'],
    hint: 'Muy buenas, criaturitas del señor.'
  },

  // ── 2. GAMING & VIDEOJUEGOS ──
  {
    category: 'GAMING & VIDEOJUEGOS',
    question: '¿En qué ciudad ficticia inspirada en Los Ángeles transcurre la historia de GTA San Andreas y GTA V?',
    answers: ['los santos', 'lossantos'],
    hint: 'Estado de San Andreas.'
  },
  {
    category: 'GAMING & VIDEOJUEGOS',
    question: '¿Cuál es el mineral más resistente y valioso para armaduras en Minecraft, introducido en la actualización del Nether?',
    answers: ['netherite', 'inframundita', 'netherita'],
    hint: 'Se combina con diamantes en la mesa de herrería.'
  },
  {
    category: 'GAMING & VIDEOJUEGOS',
    question: '¿Qué héroe carnicero de Dota 2 es famoso por lanzar su gancho mortal (Meat Hook)?',
    answers: ['pudge', 'carnicero'],
    hint: 'Frase: "Fresh meat!".'
  },
  {
    category: 'GAMING & VIDEOJUEGOS',
    question: '¿Cómo se llama el mapa más legendario y jugado de Counter-Strike (CS:GO / CS2)?',
    answers: ['dust 2', 'dust2', 'de_dust2', 'dust ii'],
    hint: 'Consta de Bombsite A, B, Larga y Oscuro.'
  },
  {
    category: 'GAMING & VIDEOJUEGOS',
    question: '¿Cuál es el nombre del protagonista espartano de la saga God of War?',
    answers: ['kratos', 'el fantasma de esparta'],
    hint: 'Portador de las Espadas del Caos.'
  },
  {
    category: 'GAMING & VIDEOJUEGOS',
    question: '¿Cómo se llama el modo Battle Royale gratuito de la franquicia Call of Duty lanzado en 2020?',
    answers: ['warzone', 'cod warzone'],
    hint: 'Empezó en el mapa de Verdansk.'
  },
  {
    category: 'GAMING & VIDEOJUEGOS',
    question: '¿Qué personaje caótico de cabello azul en League of Legends es protagonista de la serie Arcane junto a su hermana Vi?',
    answers: ['jinx', 'powder'],
    hint: 'Lleva una ametralladora llamada Pow-Pow y un lanzacohetes.'
  },
  {
    category: 'GAMING & VIDEOJUEGOS',
    question: '¿Qué juego multijugador espacial del 2020 se volvió viral por descubrir a "El Impostor"?',
    answers: ['among us', 'amongus'],
    hint: 'Tripulantes reparando una nave espacial.'
  },
  {
    category: 'GAMING & VIDEOJUEGOS',
    question: '¿Cómo se llama el fontanero de gorra verde hermano de Mario en los videojuegos de Nintendo?',
    answers: ['luigi'],
    hint: 'Protagonista de la saga Mansion cazando fantasmas.'
  },

  // ── 3. ANIME, CINE & SERIES ──
  {
    category: 'ANIME, CINE & SERIES',
    question: '¿Cuál es el alias de narcotraficante que adopta el profesor Walter White en la serie Breaking Bad?',
    answers: ['heisenberg'],
    hint: 'Inspirado en el físico del principio de incertidumbre.'
  },
  {
    category: 'ANIME, CINE & SERIES',
    question: '¿Cómo se llama el segundo barco pirata de la tripulación de Luffy en One Piece tras la pérdida del Going Merry?',
    answers: ['thousand sunny', 'sunny'],
    hint: 'Construido por Franky con madera del Árbol de Adán.'
  },
  {
    category: 'ANIME, CINE & SERIES',
    question: '¿Quién fue el legendario ninja maestro de Naruto que le enseñó el Rasengan y era conocido como el "Sabio Pervertido"?',
    answers: ['jiraiya'],
    hint: 'Uno de los tres legendarios Sannin de Konoha.'
  },
  {
    category: 'ANIME, CINE & SERIES',
    question: '¿Qué actor irlandés protagonizó al gánster Tommy Shelby en la aclamada serie "Peaky Blinders"?',
    answers: ['cillian murphy', 'cillian'],
    hint: 'También fue Oppenheimer en el cine.'
  },
  {
    category: 'ANIME, CINE & SERIES',
    question: '¿Qué villano de Marvel chasqueó los dedos con el Guantelete del Infinito para borrar a la mitad de la vida en el universo?',
    answers: ['thanos'],
    hint: 'El titán loco.'
  },
  {
    category: 'ANIME, CINE & SERIES',
    question: '¿Cómo se llama el bioandroide perfecto creado por la computadora del Dr. Gero en Dragon Ball Z?',
    answers: ['cell', 'célula'],
    hint: 'Alcanzó su forma perfecta tras absorber a Androide 18.'
  },
  {
    category: 'ANIME, CINE & SERIES',
    question: '¿Cómo se llama el protagonista con poderes de Titán de Ataque en Shingeki no Kyojin (Attack on Titan)?',
    answers: ['eren jaeger', 'eren yeager', 'eren'],
    hint: 'Amigo de la infancia de Mikasa y Armin.'
  },

  // ── 4. MÚSICA & GÉNERO URBANO ──
  {
    category: 'MÚSICA & GÉNERO URBANO',
    question: '¿Cuál es el nombre de pila real de la superestrella puertorriqueña Bad Bunny?',
    answers: ['benito', 'benito antonio martinez ocasio', 'benito martinez'],
    hint: 'El conejo malo.'
  },
  {
    category: 'MÚSICA & GÉNERO URBANO',
    question: '¿Qué productor musical y DJ argentino es famoso por sus sesiones grabadas en su estudio casero con número?',
    answers: ['bizarrap', 'biza', 'bzrp', 'gonzalo conde'],
    hint: 'Siempre viste gorra y gafas oscuras.'
  },
  {
    category: 'MÚSICA & GÉNERO URBANO',
    question: '¿Qué artista colombiano de música urbana es conocido internacionalmente con el apodo de "Ferxxo"?',
    answers: ['feid', 'salomon villada', 'salomón'],
    hint: 'Usa el color verde como sello personal.'
  },
  {
    category: 'MÚSICA & GÉNERO URBANO',
    question: '¿De qué país es oriundo el cantante de trap Duki (Mauro Ezequiel Lombardo)?',
    answers: ['argentina', 'arg'],
    hint: 'Llenó dos estadios River Plate y el Bernabéu.'
  },
  {
    category: 'MÚSICA & GÉNERO URBANO',
    question: '¿Qué veterano cantante puertorriqueño es llamado universalmente "El Rey del Reggaetón" e intérprete de "Gasolina"?',
    answers: ['daddy yankee', 'yankee', 'ramon ayala'],
    hint: 'The Big Boss.'
  },

  // ── 5. CULTURA POP, LÓGICA & PERÚ ──
  {
    category: 'CULTURA & PERÚ',
    question: '¿En qué departamento o región del Perú se encuentra la maravilla mundial de Machu Picchu?',
    answers: ['cusco', 'cuzco'],
    hint: 'La capital histórica del Imperio Incaico.'
  },
  {
    category: 'CULTURA & PERÚ',
    question: '¿Cuál es el río más largo y caudaloso del mundo, que tiene sus nacientes en los Andes peruanos?',
    answers: ['amazonas', 'rio amazonas'],
    hint: 'Desemboca en el océano Atlántico en Brasil.'
  },
  {
    category: 'CULTURA & PERÚ',
    question: '¿Qué gran poeta peruano escribió la famosa obra "Los heraldos negros" y "Trilce"?',
    answers: ['cesar vallejo', 'vallejo'],
    hint: '"Hay golpes en la vida, tan fuertes... ¡Yo no sé!".'
  },
  {
    category: 'CULTURA & PERÚ',
    question: '¿Qué animal camélido andino representa las riquezas del reino animal en el Escudo Nacional del Perú?',
    answers: ['vicuña', 'la vicuña'],
    hint: 'Posee la fibra de lana más fina del mundo.'
  },
  {
    category: 'LÓGICA & AGILIDAD',
    question: '¿Qué pesa más: un kilogramo de plomo o un kilogramo de plumas?',
    answers: ['pesan igual', 'igual', 'lo mismo', 'ambos pesan igual', 'ninguno', 'pesan lo mismo'],
    hint: 'Ambos tienen exactamente un kilogramo de masa.'
  },
  {
    category: 'LÓGICA & AGILIDAD',
    question: '¿Cuántos días tiene en total un año bisiesto?',
    answers: ['366', 'trescientos sesenta y seis'],
    hint: 'Febrero tiene 29 días.'
  },
  {
    category: 'LÓGICA & AGILIDAD',
    question: '¿Cuál es la capital oficial de Francia?',
    answers: ['paris', 'parís'],
    hint: 'La ciudad de la luz y la Torre Eiffel.'
  },
  {
    category: 'LÓGICA & AGILIDAD',
    question: '¿Cuántos minutos equivalen exactamente a 3 horas?',
    answers: ['180', '180 minutos', 'ciento ochenta'],
    hint: '60 minutos x 3.'
  }
];

/**
 * Normaliza un texto para comparación sin distinción de mayúsculas, acentos ni símbolos.
 */
function normalizeAnswer(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
    .replace(/[^a-z0-9\s]/g, '') // Solo alfanuméricos
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Obtiene una pregunta aleatoria del banco.
 */
function getRandomQuiz() {
  const index = Math.floor(Math.random() * QUIZ_QUESTIONS.length);
  const q = QUIZ_QUESTIONS[index];
  return {
    category: q.category,
    question: q.question,
    normalizedAnswers: q.answers.map(normalizeAnswer),
    rawAnswers: q.answers,
    hint: q.hint
  };
}

module.exports = {
  QUIZ_QUESTIONS,
  normalizeAnswer,
  getRandomQuiz
};

