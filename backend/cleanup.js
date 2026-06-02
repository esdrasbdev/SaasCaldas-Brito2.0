// Script para limpar usuários duplicados do Supabase Auth
// MODO DE USO:
// 1. Certifique-se que seu backend/.env tem as chaves corretas.
// 2. Rode no terminal: node backend/cleanup.js

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no arquivo backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanupDuplicateUsers() {
  console.log('🧹 Iniciando limpeza de usuários duplicados no Supabase Auth...');

  try {
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;

    console.log(`🔎 Encontrados ${users.length} usuários no total.`);

    const emailGroups = {};
    for (const user of users) {
        const emailBase = user.email.split('@')[0];
        if (!emailGroups[emailBase]) {
            emailGroups[emailBase] = [];
        }
        emailGroups[emailBase].push(user);
    }

    const usersToDelete = [];
    for (const base in emailGroups) {
        const group = emailGroups[base];
        if (group.length > 1) {
            console.log(`- Grupo [${base}] tem ${group.length} usuários. Verificando...`);
            let userToKeep = group.find(u => u.email.endsWith('.com.br'));

            if (!userToKeep) userToKeep = group[0]; // Se nenhum for .com.br, mantém o primeiro
            
            console.log(`  ✅ Mantendo: ${userToKeep.email}`);

            for (const user of group) {
                if (user.id !== userToKeep.id) {
                    usersToDelete.push({ id: user.id, email: user.email });
                    console.log(`    ❌ Marcado para exclusão: ${user.email}`);
                }
            }
        }
    }

    if (usersToDelete.length === 0) return console.log('✨ Nenhum usuário duplicado para limpar.');

    for (const user of usersToDelete) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
      if (deleteError) console.error(`      ❗️ Falha ao excluir ${user.email}: ${deleteError.message}`);
    }

    console.log('\n🧼 Limpeza concluída com sucesso.');

  } catch (error) {
    console.error('❌ Ocorreu um erro geral durante a limpeza:', error.message);
  }
}

cleanupDuplicateUsers();