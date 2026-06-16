const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../supabase');

const cache = require('../cache');

router.get('/', async (req, res) => {
  const CACHE_KEY = 'pericias_list';
  const cached = cache.get(CACHE_KEY);
  if (cached) return res.json(cached);

  try {
    const { data, error } = await supabaseAdmin
      .from('pericias')
      .select('*, clientes(nome)');
    if (error) throw error;

    cache.set(CACHE_KEY, data, 180000); // 3min
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


router.post('/', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('pericias')
    .insert([req.body]);

  if (error) return res.status(400).json({ error: error.message });

  cache.invalidate('pericias_list');
  res.status(201).json(data);
});


module.exports = router;

