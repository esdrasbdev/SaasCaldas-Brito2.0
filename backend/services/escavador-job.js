const cron = require('node-cron');
const JuditService = require('./escavador');

function iniciarJob() {
  // Roda todo dia às 03:00 da manhã
  cron.schedule('0 3 * * *', async () => {
    console.log('⏰ Iniciando busca automática de publicações...');
    await JuditService.buscarPublicacoes();
  });
  console.log('✅ Agendador de publicações ativado (03:00 AM)');
}

module.exports = iniciarJob;