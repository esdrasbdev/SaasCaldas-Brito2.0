const express = require('express');
const router = express.Router();

// Retorna configurações públicas necessárias para o frontend inicializar o Supabase.
// IMPORTANTE: não inclui SERVICE_ROLE_KEY.
router.get('/', (req, res) => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({
      error: 'SUPABASE_URL e/ou SUPABASE_ANON_KEY ausentes no backend (process.env).'
    });
  }

  res.json({
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  });
});

module.exports = router;

