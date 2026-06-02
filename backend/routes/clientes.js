/*
 * Rotas de Clientes (Backend)
 * Exemplo de estrutura de rota protegida
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { supabasePublic } = require('../supabase');
const cache = require('../cache');
const { validarCPF, sanitizarString } = require('../utils/validar');

// Middleware de proteção global para estas rotas
router.use(auth);

// GET /api/clientes - Lista todos (Exemplo de endpoint server-side)
router.get('/', async (req, res) => {
  try {
    const cached = cache.get('clientes_list');
    if (cached) return res.json(cached);
    
    // Exemplo: O backend pode fazer filtros adicionais ou logs de auditoria aqui
    const { data, error } = await supabasePublic
      .from('clientes')
      .select('*')
      .order('nome', { ascending: true });

    if (error) throw error;

    cache.set('clientes_list', data);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;