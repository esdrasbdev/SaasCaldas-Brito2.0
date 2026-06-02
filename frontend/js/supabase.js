/*
 * Cliente Supabase Global
 * Inicializa a conexão usando as variáveis injetadas por js/env.js
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Carrega configurações ou usa placeholders para evitar crash imediato do JS
const env = window._env || window.env || {};
if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
  console.warn('Aviso: Supabase: js/env.js nao carregado ou chaves ausentes no frontend.');
}

const supabaseUrl = env.SUPABASE_URL || 'https://xogyvlhgtznffapbpovq.supabase.co';
const supabaseKey = env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvZ3l2bGhndHpuZmZhcGJwb3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MjAyMjksImV4cCI6MjA4OTM5NjIyOX0.Dsnz3Pwyi-QvifHurtqdS3DVYtqH4NeOfVuNs-PdSqM';

// Cria instância oficial
export const supabase = createClient(supabaseUrl, supabaseKey);

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
