/*
 * Script para garantir que os usuários padrão existam
 * Roda automaticamente ao iniciar o backend
 */
const { getAdminClient } = require('./supabase.js');

async function seedUsers() {
  const supabase = getAdminClient();
  const users = [
    { nome: 'Antonio', email: 'antoniocaldas.adv@gmail.com', pass: 'admin123', role: 'ADMIN' },
    { nome: 'Priscila', email: 'priscila.adv17@gmail.com', pass: 'admin123', role: 'ADMIN' },
    { nome: 'Artur Silva', email: 'artursilvavieira2709@gmail.com', pass: 'estagio123', role: 'ESTAGIARIO' },
    { nome: 'Raul Lima', email: 'raul_limasilveira@hotmail.com', pass: 'estagio123', role: 'ESTAGIARIO' },
    { nome: 'Rayssa Lima', email: 'rayssalima0507@gmail.com', pass: 'estagio123', role: 'ESTAGIARIO' },
    { nome: 'Natiane Lima', email: 'natianelima300@gmail.com', pass: 'secretaria123', role: 'SECRETARIA' },

    { nome: 'Alan Anjos', email: 'alananjos188@gmail.com', pass: 'advogado123', role: 'ADVOGADO' },
    { nome: 'Amanda Francinni', email: 'amandafran900@gmail.com', pass: 'estagia123', role: 'ESTAGIARIA' },
    { nome: 'Erica Oliveira', email: 'oliveiraericaadv3@gmail.com', pass: 'advogado123', role: 'ADVOGADA' }
  ];

  console.log('🌱 Verificando usuários padrão (Seed)...');

  for (const u of users) {
    // Buscar usuário existente no Auth
    const { data: list = { users: [] } } = await supabase.auth.admin.listUsers().catch(() => ({})) || {};
    let existing = list.users.find(au => au.email.toLowerCase() === u.email.toLowerCase());

    let userId = existing?.id;

    if (existing) {
      // Usuário existe - atualizar senha
      const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
        password: u.pass,
        email_confirm: true,
        user_metadata: { nome: u.nome }
      });

      if (updateError) {
        console.error(`Erro Atualizar [${u.email}]:`, updateError.message);
      } else {
        console.log(`🔑 Senha atualizada: ${u.email}`);
      }
    } else {
      // Criar novo usuário
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.pass,
        email_confirm: true,
        user_metadata: { nome: u.nome }
      });

      userId = authData?.user?.id;

      if (authError) {
        console.error(`Erro Auth [${u.email}]:`, authError.message);
        continue;
      }
    }

    // 2. Criar/atualizar Permissões (Tabela Publica)
    if (userId) {
      await supabase
        .from('usuarios')
        .delete()
        .eq('email', u.email.toLowerCase())
        .neq('id', userId);

      const { error: dbError } = await supabase.from('usuarios').upsert({
        id: userId,
        nome: u.nome,
        email: u.email.toLowerCase(),
        role: u.role,
        ativo: true
      }, { onConflict: 'email' });

      if (dbError) console.error(`Erro DB [${u.email}]:`, dbError.message);
    }
  }

  const userList = users.map(u => `${u.email} (${u.role})`).join(', ');
  console.log(`✅ Usuários concluídos: ${userList}`);
}

module.exports = seedUsers;