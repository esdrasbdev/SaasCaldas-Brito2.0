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
        return res.status(400).json({ error: 'A senha deve possuir pelo menos 6 caracteres.' });
      }

      const attemptUpdatePassword = async (authUserId) => {
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
          password: novaSenha
        });
        if (!authError) return;
        throw authError;
      };

      const normalizeSupabaseError = (authError) => {
        const msg = String(authError?.message || '').toLowerCase();
        const code = authError?.code;

        // Usuário não encontrado / ID inválido
        // (Supabase pode variar mensagem/code conforme versão/endpoint)
        const userNotFound =
          msg.includes('user not found') ||
          msg.includes('not found') ||
          msg.includes('invalid') ||
          msg.includes('unauthorized') && msg.includes('user') ||
          msg.includes('no rows') ||
          msg.includes('uuid') ||
          code === 'user_not_found' ||
          code === 'invalid_user_id' ||
          code === 'invalid_grant' ||
          code === 'invalid_token';

        // Senha igual à anterior (algumas versões retornam variações)
        const samePassword =
          msg.includes('same password') ||
          msg.includes('password is the same') ||
          (msg.includes('new password') && msg.includes('must be different')) ||
          code === 'new_password_same' ||
          code === 'password_same';

        return { userNotFound, samePassword };
      };


      try {
        // Primeira tentativa: usa o ID recebido (público)
        await attemptUpdatePassword(id);
      } catch (authError) {
        const { userNotFound, samePassword } = normalizeSupabaseError(authError);

        // Senha igual à anterior
        if (samePassword) {
          return res.status(400).json({ error: 'A nova senha deve ser diferente da senha atual.' });
        }

        // Se for relacionado ao ID/usuário no Auth, tenta reconciliar por email
        if (userNotFound) {
          // 1) Buscar registro na tabela pública para obter o email
          const { data: pubUser, error: pubErr } = await supabaseAdmin
            .from('usuarios')
            .select('email')
            .eq('id', id)
            .maybeSingle();

          if (pubErr || !pubUser?.email) {
            return res.status(400).json({ error: 'Não foi possível localizar este usuário.' });
          }

          const emailNormalizado = String(pubUser.email).toLowerCase();

          // 2) Localizar o usuário no Auth pelo email e obter o verdadeiro Auth ID
          const { data: listagem, error: listError } = await supabaseAdmin.auth.admin.listUsers();
          if (listError) {
            return res.status(400).json({ error: 'Não foi possível alterar a senha. Tente novamente em instantes.' });
          }

          const existente = (listagem?.users || []).find(u => u.email?.toLowerCase() === emailNormalizado);
          if (!existente?.id) {
            return res.status(400).json({ error: 'Não foi possível localizar este usuário.' });
          }

          // 3) Segunda tentativa: update usando o Auth ID correto
          try {
            await attemptUpdatePassword(existente.id);
          } catch (finalErr) {
            const { samePassword: sp2 } = normalizeSupabaseError(finalErr);
            if (sp2) {
              return res.status(400).json({ error: 'A nova senha deve ser diferente da senha atual.' });
            }
            return res.status(400).json({ error: 'Não foi possível alterar a senha. Tente novamente em instantes.' });
          }

          // Caso reconciliou, segue.
        } else {
          return res.status(400).json({ error: 'Não foi possível alterar a senha. Tente novamente em instantes.' });
        }
      }
    }


    cache.del('usuarios_list');
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
