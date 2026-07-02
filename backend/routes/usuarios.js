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
    const emailNormalizado = String(email).toLowerCase();

    let authData;
    let authUserId;
    let criadoAgoraNoAuth = false;

    // 1) Criar no Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: emailNormalizado,
      password: senha,
      email_confirm: true // confirma automaticamente, sem precisar de e-mail
    });

    if (error) {
      const msg = (error.message || '').toLowerCase();
      const jaExiste =
        msg.includes('already been registered') ||
        msg.includes('already registered') ||
        error.status === 400 ||
        error.code === 'email_exists';

      if (!jaExiste) throw new Error('Erro ao criar conta Auth: ' + error.message);

      // Reconciliação: conta já existe no Auth, mas pode não existir na tabela pública.
      const { data: listagem, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw new Error('Erro ao localizar conta existente: ' + listError.message);

      const existente = listagem.users.find(u => u.email?.toLowerCase() === emailNormalizado);
      if (!existente) {
        throw new Error('Conta já registrada no Auth, mas não foi possível localizá-la para reconciliar.');
      }

      authData = { user: existente };
      authUserId = existente.id;

      // Garante que a senha informada agora passe a valer.
      const { error: updError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        password: senha,
        email_confirm: true
      });
      if (updError) throw new Error('Erro ao atualizar senha na conta Auth: ' + updError.message);
    } else {
      authData = data;
      authUserId = authData.user.id;
      criadoAgoraNoAuth = true;
    }

    // 2) Verificar se já existe linha na tabela pública
    const { data: linhaExistente, error: selError } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .eq('email', emailNormalizado)
      .maybeSingle();

    if (selError) throw new Error('Erro ao consultar usuarios: ' + selError.message);

    if (linhaExistente) {
      const { error: updError } = await supabaseAdmin
        .from('usuarios')
        .update({ nome, role, ativo: true })
        .eq('email', emailNormalizado);

      if (updError) throw new Error('Erro ao atualizar cadastro existente: ' + updError.message);

      cache.del('usuarios_list');
      return res.json({ ok: true, id: linhaExistente.id, reconciliado: true });
    }

    // 3) Inserir na tabela pública de usuários
    const { error: dbError } = await supabaseAdmin.from('usuarios').insert({
      id: authUserId,
      nome,
      email: emailNormalizado,
      role,
      ativo: true
    });

    if (dbError) {
      // Só reverte o Auth se fomos nós que acabamos de criar a conta agora.
      if (criadoAgoraNoAuth) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
      }
      throw new Error('Erro ao inserir na tabela usuarios: ' + dbError.message);
    }

    cache.del('usuarios_list');
    res.json({ ok: true, id: authUserId });
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
