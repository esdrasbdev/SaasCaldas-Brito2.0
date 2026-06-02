const express = require('express');
const router = express.Router();

router.post('/', (req, res) => {
  // Log para depuração de recebimento de publicações
  console.log('🔔 Webhook recebido do Escavador/Judit');
  // No futuro, aqui chamamos o JuditService.processarPublicacao(req.body)
  res.status(200).send('OK');
});

module.exports = router;