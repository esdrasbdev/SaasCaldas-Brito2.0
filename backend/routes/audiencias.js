const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../supabase');

const cache = require('../cache');

router.get('/', async (req, res) => {
  const CACHE_KEY = 'audiencias_list';
  const cached = cache.get(CACHE_KEY);
  if (cached) return res.json(cached);

  const { data, error } = await supabaseAdmin
    .from('audiencias')
    .select('*, processos(numero_cnj)');

  if (error) return res.status(400).json({ error: error.message });

  cache.set(CACHE_KEY, data, 180000); // 3min
  res.json(data);
});


router.post('/', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('audiencias')
    .insert([req.body]);

  if (error) return res.status(400).json({ error: error.message });

  cache.invalidate('audiencias_list');
  res.status(201).json(data);
});


module.exports = router;

