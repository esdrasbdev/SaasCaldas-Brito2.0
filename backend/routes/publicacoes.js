/*
 * Rotas de Publicações (Integração Escavador)
 * Acesso restrito a ADMIN
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const supabase = require('../supabase');
const EscavadorService = require('../services/escavador');

router.use(auth);

// Middleware extra: Apenas ADMIN pode acessar
router.use((req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }
  next();
});

// GET /api/publicacoes - Lista todas
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('publicacoes')
      .select('*')
      .order('data_publicacao', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/publicacoes/sincronizar - Força busca na API (Manual)
router.post('/sincronizar', async (req, res) => {
  try {
    // Executa o serviço
    const resultado = await EscavadorService.buscarPublicacoes();
    res.json({ 
      message: 'Sincronização finalizada', 
      detalhes: resultado 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;