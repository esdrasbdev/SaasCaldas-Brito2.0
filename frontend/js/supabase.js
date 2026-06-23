/*
 * Cliente Supabase
 * Inicializa o client SOMENTE via endpoint /api/env
 * (funciona no Vercel e no localhost sem depender de js/env.js).
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

export const getApiUrl = () => {
  // Backend local (Express/Railway) usa a mesma origem em produção.
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001/api'
    : '/api';
};

let supabaseClient = null;

function createIfPossible({ SUPABASE_URL, SUPABASE_ANON_KEY }) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export const supabase = supabaseClient;

export async function initSupabase() {
  if (supabaseClient) return supabaseClient;

  const apiUrl = getApiUrl();
  const resp = await fetch(`${apiUrl}/env`, {
    headers: { accept: 'application/json' },
    cache: 'no-store'
  });

  const contentType = resp.headers.get('content-type') || '';

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Supabase init: falha ao obter /api/env (${resp.status}). ${text}`);
  }

  if (!contentType.includes('application/json')) {
    const text = await resp.text().catch(() => '');
    throw new Error(
      `Supabase init: /api/env não retornou JSON (content-type: ${contentType || 'unknown'}). Corpo: ${text}`
    );
  }

  const data = await resp.json();

  supabaseClient = createIfPossible(data);

  if (!supabaseClient) {
    throw new Error('Supabase init: client não foi criado (chaves inválidas em /api/env).');
  }

  window.supabase = supabaseClient;
  return supabaseClient;
}

window.supabase = supabaseClient;

