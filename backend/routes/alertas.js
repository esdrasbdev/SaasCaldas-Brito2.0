const express = require('express');
const router = express.Router();
const { executarVerificacaoDeAlertas } = require('../services/alertas-job');

// POST /api/alertas/testar — dispara alerta manualmente (somente ADMIN)
router.post('/testar', async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Apenas ADMIN pode disparar alertas manualmente.' });
  }

  try {
    await executarVerificacaoDeAlertas();
    res.json({ mensagem: 'Verificação de alertas executada com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

