const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Inicializa o cliente Supabase para uso no backend
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('audiencias')
    .select('*, processos(numero_cnj)');

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.post('/', async (req, res) => {
  const { data, error } = await supabase
    .from('audiencias')
    .insert([req.body]);

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

module.exports = router;