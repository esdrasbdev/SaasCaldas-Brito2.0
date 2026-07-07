const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../supabase');
const authMiddleware = require('../middleware/auth');

// A rota já fica protegida por authMiddleware quando registrada em backend/index.js,
// mas mantemos a assinatura para seguir o padrão.
router.use(authMiddleware);

function safeError(res, error) {
  return res.status(400).json({ error: error?.message || 'Erro na requisição.' });
}

// GET /api/procuracoes?status=ATIVA|PENDENTE|VENCIDA|HISTORICO
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;

    const select = '*, clientes(nome), documentos(url)';

    if (!status || status === 'HISTORICO') {
      // Histórico: PENDENTE ou VENCIDA
      const { data, error } = await supabaseAdmin
        .from('procuracoes')
        .select(select)
        .in('status', ['PENDENTE', 'VENCIDA'])
        .order('criado_em', { ascending: false });

      if (error) return safeError(res, error);
      return res.json(data);
    }

    const { data, error } = await supabaseAdmin
      .from('procuracoes')
      .select(select)
      .eq('status', status)
      .order('criado_em', { ascending: false });

    if (error) return safeError(res, error);
    return res.json(data);
  } catch (error) {
    return safeError(res, error);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('procuracoes')
      .select('*, clientes(nome), documentos(url)')
      .eq('id', id)
      .single();

    if (error) return safeError(res, error);
    return res.json(data);
  } catch (error) {
    return safeError(res, error);
  }
});

// POST /api/procuracoes
router.post('/', async (req, res) => {
  try {
    const { cliente_id, documento_id, status, data_emissao, data_vencimento } = req.body || {};

    if (!cliente_id) {
      return res.status(400).json({ error: 'cliente_id é obrigatório.' });
    }

    const payload = {
      cliente_id,
      documento_id: documento_id || null,
      status: status || 'ATIVA',
      data_emissao: data_emissao || null,
      data_vencimento: data_vencimento || null,
      criado_por: req.user?.id || null
    };

    const { data, error } = await supabaseAdmin
      .from('procuracoes')
      .insert([payload])
      .select()
      .single();

    if (error) return safeError(res, error);
    return res.status(201).json(data);
  } catch (error) {
    return safeError(res, error);
  }
});

// PUT /api/procuracoes/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, data_vencimento, data_emissao, documento_id } = req.body || {};

    const payload = {
      ...(status ? { status } : {}),
      ...(data_vencimento ? { data_vencimento } : {}),
      ...(data_emissao ? { data_emissao } : {}),
      ...(documento_id !== undefined ? { documento_id } : {})
    };

    const { data, error } = await supabaseAdmin
      .from('procuracoes')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) return safeError(res, error);
    return res.json(data);
  } catch (error) {
    return safeError(res, error);
  }
});

// DELETE /api/procuracoes/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('procuracoes')
      .delete()
      .eq('id', id);

    if (error) return safeError(res, error);
    return res.json({ ok: true });
  } catch (error) {
    return safeError(res, error);
  }
});

module.exports = router;

