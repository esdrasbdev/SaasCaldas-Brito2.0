/*
 * Configuração SEGURA do Cliente Supabase - DUAL MODE (PUBLIC + ADMIN)
 * ✅ Remove exposição da SERVICE_ROLE_KEY global
 * 🔒 Public para rotas normais (respeita RLS)
 * 🛡️ Admin apenas onde necessário (rotas protegidas)
 * 
 * Uso nas rotas:
 * const { supabasePublic, supabaseAdmin } = require('../supabase');
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[FATAL] Variáveis de ambiente Supabase ausentes. Verifique SUPABASE_URL e SUPABASE_ANON_KEY.');
  process.exit(1);
}

// Cliente PÚBLICO (respeita RLS - MAIORIA das rotas)
const supabasePublic = createClient(supabaseUrl, supabaseAnonKey);

// Cliente ADMIN (service role - APENAS rotas críticas/admin)
// Em serverless/Vercel, pode ser que SUPABASE_SERVICE_ROLE_KEY não esteja configurada.
// Nesse caso, mantemos supabaseAdmin como null e as rotas admin falharão/serão negadas via middleware.
const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Warn silenciado (não crítico para runtime)

module.exports = { 
  supabasePublic, 
  supabaseAdmin,
  getAdminClient: () => supabaseAdmin || supabasePublic // Fallback seguro
};

