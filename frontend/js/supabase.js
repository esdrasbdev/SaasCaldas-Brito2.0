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

let _client = null;
let _initPromise = null;

function createIfPossible({ SUPABASE_URL, SUPABASE_ANON_KEY }) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
}

// Compat: alguns arquivos antigos importam { supabase }.
// Em ES Modules, export const é read-only; então mantemos um "proxy" via getter
// e asseguramos que `from './supabase.js'` sempre retorne o client inicializado.
export const supabase = /** @type {any} */ (new Proxy({}, {
  get(_target, prop) {
    if (!_client) throw new Error('Supabase não inicializado. Chame await initSupabase() antes.');
    return _client[prop];
  }
}));


export async function initSupabase() {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    if (_client) return _client;

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

    const created = createIfPossible(data);
    if (!created) {
      throw new Error('Supabase init: client não foi criado (chaves inválidas em /api/env).');
    }

    _client = created;
    window.supabase = _client;
    return _client;
  })();

  return _initPromise;
}

export function getSupabaseClient() {
  if (!_client) throw new Error('Supabase não inicializado. Chame await initSupabase() antes.');
  return _client;
}

// Mantém compatibilidade com código legado que acessa window.supabase.
window.supabase = window.supabase || null;

