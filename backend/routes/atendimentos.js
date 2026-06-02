const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// GET /api/atendimentos
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('atendimentos')
      .select('*, clientes(nome), usuarios(nome)')
      .order('data', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/atendimentos
router.post('/', async (req, res) => {
  try {
    const novoAtendimento = {
      ...req.body,
      usuario_id: req.user.id // Garante que o ID venha do token autenticado
    };

    const { data, error } = await supabase
      .from('atendimentos')
      .insert([novoAtendimento])
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;