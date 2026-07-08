const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../supabase');
const cache = require('../cache');

// GET listagem (com cache)
router.get('/', async (req, res) => {
  const { status } = req.query;
  const filtroStatus = status || 'ATIVO';

  const CACHE_KEY = `prazos_list_${filtroStatus}`;
  const cached = cache.get(CACHE_KEY);
  if (cached) return res.json(cached);

  try {
    const { data, error } = await supabaseAdmin
      .from('prazos')
      .select(
        '*, clientes(nome), processos(numero_cnj), responsaveis_prazo(usuario_id, usuarios(nome))'
      )
      .eq('status', filtroStatus)
      .order('data_prazo', { ascending: true });

    if (error) throw error;

    cache.set(CACHE_KEY, data, 180000); // 3min
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH marcar como CUMPRIDO
router.patch('/:id/cumprir', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('prazos')
      .update({ status: 'CUMPRIDO' })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    cache.invalidate('prazos_list_ATIVO');
    cache.invalidate('prazos_list_CUMPRIDO');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Erro ao marcar prazo como cumprido.' });
  }
});

// PATCH arquivar
router.patch('/:id/arquivar', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('prazos')
      .update({ status: 'ARQUIVADO' })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    cache.invalidate('prazos_list_ATIVO');
    cache.invalidate('prazos_list_ARQUIVADO');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Erro ao arquivar prazo.' });
  }
});

// PATCH restaurar
router.patch('/:id/restaurar', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('prazos')
      .update({ status: 'ATIVO' })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    cache.invalidate('prazos_list_ATIVO');
    cache.invalidate('prazos_list_ARQUIVADO');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Erro ao restaurar prazo.' });
  }
});

module.exports = router;
