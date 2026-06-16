const express = require('express');
const router = express.Router();
const EmailService = require('../services/email');

// POST /api/email/testar
// Sem depender de Supabase/alertas.
// Body (JSON): { "to": "email@exemplo.com", "subject": "Assunto", "html": "<p>...</p>" }
router.post('/testar', async (req, res) => {
  const { to, subject, html } = req.body || {};

  if (!to || typeof to !== 'string') {
    return res.status(400).json({ error: 'Campo "to" é obrigatório e deve ser string.' });
  }
  if (!subject || typeof subject !== 'string') {
    return res.status(400).json({ error: 'Campo "subject" é obrigatório e deve ser string.' });
  }
  if (!html || typeof html !== 'string') {
    return res.status(400).json({ error: 'Campo "html" é obrigatório e deve ser string.' });
  }

  // Envia usando o mesmo serviço do projeto.
  // Obs: O `from` e a disponibilidade dependem de RESEND_API_KEY e EMAIL_FROM em .env
  const resultado = await EmailService.enviarDireto(to, subject, html);

  if (!resultado?.sucesso) {
    return res.status(400).json(resultado);
  }

  return res.json(resultado);
});

module.exports = router;

