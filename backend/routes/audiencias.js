const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../supabase');

const cache = require('../cache');

router.get('/', async (req, res) => {
  const { status } = req.query;
  const filtroStatus = status || 'ATIVA';

  const CACHE_KEY = `audiencias_list_${filtroStatus}`;
  const cached = cache.get(CACHE_KEY);
  if (cached) return res.json(cached);

  const { data, error } = await supabaseAdmin
    .from('audiencias')
    .select('*, processos(numero_cnj)')
    .eq('status', filtroStatus);

  if (error) return res.status(400).json({ error: error.message });

  cache.set(CACHE_KEY, data, 180000); // 3min
  res.json(data);
});

router.patch('/:id/arquivar', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('audiencias')
      .update({ status: 'ARQUIVADA' })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    cache.invalidate('audiencias_list_ATIVA');
    cache.invalidate('audiencias_list_ARQUIVADA');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Erro ao arquivar audiência' });
  }
});

router.patch('/:id/restaurar', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('audiencias')
      .update({ status: 'ATIVA' })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    cache.invalidate('audiencias_list_ATIVA');
    cache.invalidate('audiencias_list_ARQUIVADA');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Erro ao restaurar audiência' });
  }
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

