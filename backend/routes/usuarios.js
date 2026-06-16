const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../supabase');
const cache = require('../cache');


router.get('/', async (req, res) => {
  try {
    const cached = cache.get('usuarios_list');
    if (cached) return res.json(cached);

    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .select('id, nome, email, role, ativo, criado_em')
      .order('nome');

    if (error) throw error;

    cache.set('usuarios_list', data, 120000); // 2min
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


module.exports = router;