// ══════════════════════════════════════════════════════════
// ⟡ Script de Ingesta Masiva: Stock de Cuentas Prime Video & YouTube
// ══════════════════════════════════════════════════════════

process.env.BOT_TOKEN = process.env.BOT_TOKEN || '123456:dummy';
const fs = require('fs');
const path = require('path');
const db = require('../src/database/postgres');

const PRIME_DIR = 'C:\\Users\\Conter\\Downloads\\primevideo_results_20261031_042553\\live';
const YOUTUBE_DIR = 'C:\\Users\\Conter\\Downloads\\YouTube_Hits_20261031_042336\\Premium';
const SEED_OUTPUT = path.join(__dirname, '..', 'src', 'data', 'rewards_seed.json');

async function importStock() {
  console.log('⟡ Iniciando ingesta masiva de recompensas...');
  const items = [];

  // 1. Prime Video
  if (fs.existsSync(PRIME_DIR)) {
    const files = fs.readdirSync(PRIME_DIR).filter(f => f.endsWith('.txt'));
    console.log(`▸ Encontrados ${files.length} archivos de Prime Video.`);
    for (const file of files) {
      const fullPath = path.join(PRIME_DIR, file);
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      const firstLine = lines[0] || '';
      let title = `Prime Video [${file.replace(/\.txt$/, '')}]`;
      if (firstLine.startsWith('#')) {
        title = firstLine.replace(/^#\s*/, '').trim();
      }

      items.push({
        category: 'PRIME_VIDEO',
        accountTitle: title,
        accountData: content.trim()
      });
    }
  } else {
    console.warn(`⟡ Directorio Prime Video no encontrado: ${PRIME_DIR}`);
  }

  // 2. YouTube Premium
  if (fs.existsSync(YOUTUBE_DIR)) {
    const files = fs.readdirSync(YOUTUBE_DIR).filter(f => f.endsWith('.txt'));
    console.log(`▸ Encontrados ${files.length} archivos de YouTube Premium.`);
    for (const file of files) {
      const fullPath = path.join(YOUTUBE_DIR, file);
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      let title = `YouTube Premium [${file.replace(/\.txt$/, '')}]`;
      const headerLines = lines.slice(0, 3).filter(l => l.startsWith('#')).map(l => l.replace(/^#\s*/, '').trim());
      if (headerLines.length > 0) {
        title = headerLines.join(' | ');
      }

      items.push({
        category: 'YOUTUBE_PREMIUM',
        accountTitle: title,
        accountData: content.trim()
      });
    }
  } else {
    console.warn(`⟡ Directorio YouTube Premium no encontrado: ${YOUTUBE_DIR}`);
  }

  // Guardar copia local estructurada en JSON
  const dataDir = path.dirname(SEED_OUTPUT);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(SEED_OUTPUT, JSON.stringify(items, null, 2), 'utf8');
  console.log(`✓ Archivo seed guardado con éxito en: ${SEED_OUTPUT} (${items.length} cuentas procesadas).`);

  // Intentar cargar a la base de datos si la conexión está disponible
  try {
    let inserted = 0;
    for (const item of items) {
      await db.insertReward(item);
      inserted++;
    }
    console.log(`✓ Base de datos: ${inserted} recompensas cargadas exitosamente.`);
  } catch (err) {
    console.warn('⟡ Error cargando a base de datos:', err.message);
  }

  const counts = await db.getAvailableRewardsCount();
  console.log('⟡ Balance actual de Stock:', counts);
}

if (require.main === module) {
  importStock()
    .then(() => {
      console.log('✓ Proceso de ingesta finalizado con éxito.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('✗ Error en ingesta:', err);
      process.exit(1);
    });
}

module.exports = { importStock };
