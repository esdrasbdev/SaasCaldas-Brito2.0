// Script para atualizar o banco de dados sem abrir o painel
// Requer a SERVICE_ROLE_KEY no .env do backend

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no arquivo backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🚀 Iniciando migração do banco de dados...');

  // O Supabase JS não executa DDL (CREATE/ALTER) diretamente.
  // Mas podemos usar a API REST do Postgres se habilitada, ou RPC.
  // Como solução de contorno para "não abrir o painel", vamos usar um truque:
  // Tentar inserir dados que dependem da coluna. Se falhar, avisamos.
  // Infelizmente, DDL real requer conexão direta Postgres (pg) ou painel.
  
  console.log('ℹ️ O cliente JS do Supabase não permite alterar estruturas de tabela (ADD COLUMN) por segurança.');
  console.log('ℹ️ Para rodar o SQL sem abrir o painel visual, você precisa de acesso direto ao banco via terminal psql ou conexão string.');
  
  console.log('\n📋 COPIE E COLE ESTE COMANDO NO TERMINAL (se tiver psql instalado):');
  console.log(`psql "postgresql://postgres:[SUA-SENHA]@db.[SEU-PROJETO].supabase.co:5432/postgres" -c "ALTER TABLE pericias ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES usuarios(id); ALTER TABLE audiencias ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES usuarios(id); ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS titulo text; ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS canal text; ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS duracao text;"`);
  
  console.log('\nOU use a interface SQL do Supabase. Não há outra forma segura via código frontend/JS puro.');
  
  // Verificação de conexão
  const { data, error } = await supabase.from('usuarios').select('count', { count: 'exact', head: true });
  
  if (error) {
    console.error('❌ Falha na conexão com o banco:', error.message);
  } else {
    console.log('✅ Conexão com o banco estabelecida com sucesso.');
  }
}

runMigration();