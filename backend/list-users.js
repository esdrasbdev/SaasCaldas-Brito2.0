const supabase = require('./supabase');

async function listUsers() {
  const { data, error } = await supabase
    .from('usuarios')
    .select('nome, email, role')
    .order('role');

  if (error) {
    console.error(error);
    return;
  }

  console.table(data);
}

listUsers().then(() => process.exit(0));