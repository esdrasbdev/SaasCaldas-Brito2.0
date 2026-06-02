const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pericias')
      .select('*, clientes(nome)');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  const { data, error } = await supabase.from('pericias').insert([req.body]);
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

module.exports = router;