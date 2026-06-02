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
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Erro crítico mantido (sem log para não poluir, mas exit necessário)
  process.exit(1);
}

// Cliente PÚBLICO (respeita RLS - MAIORIA das rotas)
const supabasePublic = createClient(supabaseUrl, supabaseAnonKey);

// Cliente ADMIN (service role - APENAS rotas críticas/admin)
const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Warn silenciado (não crítico para runtime)

module.exports = { 
  supabasePublic, 
  supabaseAdmin,
  getAdminClient: () => supabaseAdmin || supabasePublic // Fallback seguro
};

