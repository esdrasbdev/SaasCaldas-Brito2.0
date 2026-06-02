/*
 * Rotas de Processos (Backend)
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const supabase = require('../supabase');

router.use(auth);

// GET /api/processos
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('processos')
      .select('*, clientes(nome)')
      .order('criado_em', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;