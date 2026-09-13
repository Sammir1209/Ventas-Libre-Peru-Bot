const { Bot } = require('grammy');
const config = require('../src/config/env');
const db = require('../src/database/postgres');
const { publishBurnAlert } = require('../src/modules/burn/publisher');

async function main() {
  console.log('⟡ Iniciando re-publicación de reportes de estafadores...');
  const bot = new Bot(config.BOT_TOKEN);

  const reportIds = [6, 7];

  for (const id of reportIds) {
    console.log(`\n========================================`);
    console.log(`⟡ Procesando Reporte #${id}...`);
    console.log(`========================================`);

    const report = await db.getBurnReport(id);
    if (!report) {
      console.error(`✗ Reporte #${id} no encontrado en base de datos.`);
      continue;
    }

    console.log(`⟡ Datos del reporte:`, {
      id: report.id,
      reporter_id: report.reporter_id,
      target_id: report.target_id,
      proofs_count: report.proof_file_ids?.length || 0,
      context_snippet: report.context?.slice(0, 60),
    });

    try {
      const res = await publishBurnAlert(bot.api, report);
      console.log(`✓ Reporte #${id} re-publicado exitosamente en ${res.broadcastCount} canales y grupos!`);
      console.log(`  Target: ${res.displayName} (@${res.targetUsername || 'sin_username'}) | ID: ${res.targetId || 'No identificado'}`);
    } catch (err) {
      console.error(`✗ Error publicando reporte #${id}:`, err);
    }
  }

  console.log('\n⟡ Todos los reportes han sido re-publicados correctamente en todos los grupos y canales.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
