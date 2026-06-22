/*
 * Cliente Supabase Global
 * Inicializa a conexão usando as variáveis injetadas por js/env.js
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Carrega configurações ou usa placeholders para evitar crash imediato do JS
const env = window._env || window.env || {};

// Helper para obter a URL base da API (Backend)
export const getApiUrl = () => {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001/api'
    : '/api'; // Na Vercel, usamos caminhos relativos para a mesma URL
};

// Supabase client é inicializado de forma lazy e robusta:
// 1) tenta window._env/window.env (js/env.js)
// 2) se falhar, busca via backend /api/env (não depende de js/env.js no deploy)
let supabaseClient = null;

function hasKeys(e) {
  return !!(e && e.SUPABASE_URL && e.SUPABASE_ANON_KEY);
}

function createIfPossible({ SUPABASE_URL, SUPABASE_ANON_KEY }) {
  if (!SUPABASE_ANON_KEY) {
    console.error('Supabase: SUPABASE_ANON_KEY ausente.');
    return null;
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// tentativa inicial (pode falhar no deploy)
if (hasKeys(env)) {
  supabaseClient = createIfPossible(env);
} else {
  console.warn('Supabase: js/env.js não carregado ou chaves ausentes. Fallback para /api/env.');
}

export const supabase = supabaseClient;

export async function initSupabase() {
  if (supabaseClient) return supabaseClient;

  // fallback: buscar configurações no backend
  const apiUrl = getApiUrl();
  const resp = await fetch(`${apiUrl}/env`, { headers: { 'accept': 'application/json' } });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Supabase init: falha ao obter /api/env (${resp.status}). ${text}`);
  }

  const data = await resp.json();
  supabaseClient = createIfPossible(data);

  if (!supabaseClient) {
    throw new Error('Supabase init: client não foi criado (chaves inválidas).');
  }

  // Torna global para debug/compat
  window.supabase = supabaseClient;
  return supabaseClient;
}

window.supabase = supabaseClient;
