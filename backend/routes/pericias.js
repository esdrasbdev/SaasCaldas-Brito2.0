const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../supabase');

const cache = require('../cache');

router.get('/', async (req, res) => {
  const { status } = req.query;
  const filtroStatus = status || 'ATIVA';

  const CACHE_KEY = `pericias_list_${filtroStatus}`;
  const cached = cache.get(CACHE_KEY);
  if (cached) return res.json(cached);

  try {
    const { data, error } = await supabaseAdmin
      .from('pericias')
      .select('*, clientes(nome)')
      .eq('status', filtroStatus);
    if (error) throw error;

    cache.set(CACHE_KEY, data, 180000); // 3min
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.patch('/:id/arquivar', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('pericias')
      .update({ status: 'ARQUIVADA' })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    cache.invalidate('pericias_list_ATIVA');
    cache.invalidate('pericias_list_ARQUIVADA');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Erro ao arquivar perícia' });
  }
});

router.patch('/:id/restaurar', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('pericias')
      .update({ status: 'ATIVA' })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    cache.invalidate('pericias_list_ATIVA');
    cache.invalidate('pericias_list_ARQUIVADA');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Erro ao restaurar perícia' });
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

