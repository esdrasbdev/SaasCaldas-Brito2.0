const supabase = require('./supabase');

async function fixRoles() {
  console.log('🔧 Corrigindo roles dos usuários no banco...');

  // 1. Buscar usuários existentes
  const { data: usuarios, error: fetchError } = await supabase
    .from('usuarios')
    .select('id, email, role');

  if (fetchError) {
    console.error('Erro ao buscar usuários:', fetchError.message);
    return;
  }

  console.log(`Encontrados ${usuarios.length} usuários`);

  const rolesMap = {
    'ARTUR SILVA': 'ESTAGIARIO',
    'RAUL LIMA': 'ESTAGIARIO',
    'NATIANE LIMA': 'SECRETARIA',
    'ALAN ANJOS': 'ADVOGADO',
    'AMANDA FRANCINNI': 'ESTAGIARIA',
    'ERICA OLIVEIRA': 'ADVOGADA'
  };

  for (const u of usuarios) {
    const nomeUpper = u.nome?.toUpperCase();
    const newRole = rolesMap[nomeUpper];

    if (newRole) {
      const { error: updateError } = await supabase
        .from('usuarios')
        .update({ role: newRole })
        .eq('id', u.id);

      if (updateError) {
        console.error(`Erro ao atualizar ${u.email}:`, updateError.message);
      } else {
        console.log(`✅ ${u.email} -> ${newRole}`);
      }
    }
  }

  console.log('🎉 Roles corrigidas!');
}

fixRoles().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});