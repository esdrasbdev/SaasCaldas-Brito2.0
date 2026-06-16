/*
 * Rotas de Processos (Backend)
 */

const express = require('express');
const router = express.Router();

const { supabaseAdmin } = require('../supabase');

const cache = require('../cache');

// GET /api/processos
router.get('/', async (req, res) => {
  const CACHE_KEY = 'processos_list';
  const cached = cache.get(CACHE_KEY);
  if (cached) return res.json(cached);

  try {
    const { data, error } = await supabaseAdmin
      .from('processos')

      .select('*, clientes(nome)')
      .order('criado_em', { ascending: false });

    if (error) throw error;

    cache.set('processos_list', data, 180000); // 3min
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


module.exports = router;