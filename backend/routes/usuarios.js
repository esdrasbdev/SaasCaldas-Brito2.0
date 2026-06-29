const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../supabase');
const cache = require('../cache');


// Middleware: somente ADMIN pode acessar essas rotas
function soAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }
  next();
}

// GET / — listar usuários
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

// POST / — criar usuário (cria no Auth + insere na tabela pública)
router.post('/', soAdmin, async (req, res) => {
  const { nome, email, role, senha } = req.body;

  if (!nome || !email || !role || !senha) {
    return res.status(400).json({ error: 'Campos obrigatórios: nome, email, role, senha.' });
  }

  try {
    // 1) Criar no Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true // confirma automaticamente, sem precisar de e-mail
    });

    if (authError) throw new Error('Erro ao criar conta Auth: ' + authError.message);

    // 2) Inserir na tabela pública de usuários
    const { error: dbError } = await supabaseAdmin.from('usuarios').insert({
      id: authData.user.id, // mesmo UUID do Auth
      nome,
      email,
      role,
      ativo: true
    });

    if (dbError) {
      // Rollback: remover do Auth se falhou na tabela
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error('Erro ao inserir na tabela usuarios: ' + dbError.message);
    }

    cache.del('usuarios_list');
    res.json({ ok: true, id: authData.user.id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /:id — editar usuário (nome, role, ativo) e opcionalmente trocar senha
router.put('/:id', soAdmin, async (req, res) => {
  const { id } = req.params;
  const { nome, role, ativo, novaSenha } = req.body;

  try {
    // 1) Atualizar tabela pública
    const dadosPublicos = {};
    if (nome !== undefined) dadosPublicos.nome = nome;
    if (role !== undefined) dadosPublicos.role = role;
    if (ativo !== undefined) dadosPublicos.ativo = ativo;

    if (Object.keys(dadosPublicos).length > 0) {
      const { error: dbError } = await supabaseAdmin
        .from('usuarios')
        .update(dadosPublicos)
        .eq('id', id);
      if (dbError) throw new Error('Erro ao atualizar cadastro: ' + dbError.message);
    }

    // 2) Trocar senha no Auth (se fornecida)
    if (novaSenha) {
      if (novaSenha.length < 6) {
        return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres.' });
      }
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
        password: novaSenha
      });
      if (authError) throw new Error('Erro ao atualizar senha: ' + authError.message);
    }

    cache.del('usuarios_list');
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
