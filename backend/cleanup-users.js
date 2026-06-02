const supabase = require('./supabase');

async function fixUsers() {
  const usersToFix = [
    { email: 'natianelima300@gmail.com', nome: 'Natiane Lima', role: 'ESTAGIARIO' },
    { email: 'amandafran900@gmail.com', nome: 'Amanda Francinni', role: 'ESTAGIARIO' },
    { email: 'oliveiraericaadv3@gmail.com', nome: 'Erica Oliveira', role: 'ADVOGADO' }
  ];

  for (const u of usersToFix) {
    await supabase.from('usuarios').update({ role: u.role }).eq('email', u.email);
    console.log(`✅ ${u.email} -> ${u.role} (temporary until constraint fixed)`);
  }
}

fixUsers().then(() => process.exit(0));