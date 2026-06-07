/*
 * Cliente Supabase Global
 * Inicializa a conexão usando as variáveis injetadas por js/env.js
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Carrega configurações ou usa placeholders para evitar crash imediato do JS
const env = window._env || window.env || {};

// Se o navegador estiver recebendo HTML no lugar de JS (ex.: /api retornando index.html),
// isso costuma causar erros “Unexpected token '<'”.
// Vamos detectar chave ausente cedo para deixar o erro mais claro.
if (!window._env) {
  console.warn('Supabase: window._env nao encontrado. Verifique se js/env.js esta carregado antes deste arquivo.');
}
if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
  console.warn('Aviso: Supabase: js/env.js nao carregado ou chaves ausentes no frontend.');
}

const supabaseUrl = env.SUPABASE_URL || 'https://xogyvlhgtznffapbpovq.supabase.co';
// Importante: sem js/env.js (ou window._env/window.env) o sistema não deve operar.
if (!env.SUPABASE_ANON_KEY) {
  console.error('Supabase: SUPABASE_ANON_KEY ausente. Verifique se js/env.js está carregado nas páginas.');
}

const supabaseKey = env.SUPABASE_ANON_KEY;

// Cria instância oficial.
// Se a key não existir, NÃO cria client inválido (isso quebra com "supabaseKey is required").
export const supabase = supabaseKey ? createClient(supabaseUrl, supabaseKey) : (() => {
  console.error('Supabase: CLIENT NÃO CRIADO. js/env.js está sem SUPABASE_ANON_KEY.');
  return null;
})();

// Helper para obter a URL base da API (Backend)

export const getApiUrl = () => {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001/api'
    : '/api'; // Na Vercel, usamos caminhos relativos para a mesma URL
};

// Compatibilidade para chamadas que esperam uma Promise de inicialização (ex: login.html)
export async function initSupabase() {
  return supabase;
}

// Torna global para debug
window.supabase = supabase;
