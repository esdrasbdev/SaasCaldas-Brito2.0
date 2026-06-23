const express = require('express');
const router = express.Router();
const { executarVerificacaoDeAlertas } = require('../services/alertas-job');

// GET /api/alertas/cron — disparo do job via Vercel Cron ou cronjob externo
// Protegido por CRON_SECRET para evitar abuso
router.get('/cron', async (req, res) => {
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await executarVerificacaoDeAlertas();
    res.json({ ok: true, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('[Cron] Erro ao executar alertas:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

