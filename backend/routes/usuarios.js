const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const { supabasePublic, cache } = require('../supabase');
const { sanitizarString } = require('../utils/validar');

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .order('nome');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;