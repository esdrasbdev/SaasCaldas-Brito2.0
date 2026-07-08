/* 
 * Proteção de rotas/páginas por autenticação e role
 * Executa em todas as páginas (exceto login.html)
 * Redireciona automaticamente se sem sessão ou sem permissão
 */

import { requireAuth } from './auth.js';
import { AuthAPI } from './auth.js';


// Configuração de rotas protegidas
const ROUTE_CONFIG = {
  'index.html': { requiresAuth: true, requiredRole: null },        // Dashboard
  'dashboard.html': { requiresAuth: true, requiredRole: null },
  'clientes.html': { requiresAuth: true, requiredRole: null },
  'processos.html': { requiresAuth: true, requiredRole: null },
  'agenda.html': { requiresAuth: true, requiredRole: null },
  'audiencias.html': { requiresAuth: true, requiredRole: null },
  
  'prazos.html': { requiresAuth: true, requiredRole: null },
  'pericias.html': { requiresAuth: true, requiredRole: null },

  'atendimentos.html': { requiresAuth: true, requiredRole: null },
  'documentos.html': { requiresAuth: true, requiredRole: null },
  'publicacoes.html': { requiresAuth: true, requiredRole: 'ADMIN' },
  'admin.html': { requiresAuth: true, requiredRole: 'ADMIN' },

  'procuracoes.html': { requiresAuth: true, requiredRole: null }
};


// Página atual (baseado em location.pathname)
const currentPage = window.location.pathname.split('/').pop() || 'index.html';

// Função principal de guarda
async function pageGuard() {
  try {
    // Auth listener já roda. Apenas verifica local state
    const { requiresAuth, requiredRole } = ROUTE_CONFIG[currentPage] || {};
    
    // Se página não está na config, permite acesso
    if (!requiresAuth) {
      showPageContent();
      return;
    }
  
    // 1. Verificação Rápida e Liberação (Cache Local)
    // Mantém segurança: só libera UI após confirmação OU em modo otimista, mas SEM buscar dados sensíveis aqui.
    const cachedRole = localStorage.getItem('userRole');

    // Mostra conteúdo imediatamente apenas quando há cache de role e não há necessidade de role específica.
    // Isso reduz a sensação de "tela presa" sem expor dados reais antes da validação.
    const shouldShowOptimistic = !!cachedRole && !requiredRole;
    if (shouldShowOptimistic) showPageContent();

    // Verifica autenticação (espera o Supabase restaurar sessão via onAuthStateChange)
    let session;
    try {
      session = await requireAuth({ timeoutMs: 2500 });
    } catch (e) {
      // requireAuth já redireciona
      return;
    }


    // Verifica role específica
    if (requiredRole && !AuthAPI.hasPermission(requiredRole)) {
      console.warn(`Acesso negado a ${currentPage}. Role necessário: ${requiredRole}`);
      redirectToDashboard();
      return;
    }

    console.log(`Guard: Acesso permitido a ${currentPage} para ${session?.user?.email}`);
    showPageContent();

    
  } catch (error) {
    console.error('Erro no pageGuard:', error);
    redirectToLogin();
  }
}

// Redirecionamentos
function redirectToLogin() {
  if (currentPage !== 'login.html') {
    window.location.replace('login.html');
  }
}

function redirectToDashboard() {
  window.location.replace('index.html');
}


function showPageContent() {
  // Remove loading screen
  const loading = document.getElementById('loading-screen');
  if (loading) {
    loading.style.display = 'none';
  }
  
  // Mostra placeholder ou conteúdo real da página
  const placeholder = document.getElementById('dashboard-placeholder');
  if (placeholder) {
    placeholder.style.display = 'block';
  }
}

// Executa guarda imediatamente quando página carrega
document.addEventListener('DOMContentLoaded', pageGuard);

// Re-executa em navegação SPA (se implementada futuramente)
window.addEventListener('popstate', pageGuard);
