/* 
 * Proteção de rotas/páginas por autenticação e role
 * Executa em todas as páginas (exceto login.html)
 * Redireciona automaticamente se sem sessão ou sem permissão
 */

import { supabase } from './supabase.js';
import { AuthAPI } from './auth.js';

// Configuração de rotas protegidas
const ROUTE_CONFIG = {
  'index.html': { requiresAuth: true, requiredRole: null },        // Dashboard
  'dashboard.html': { requiresAuth: true, requiredRole: null },
  'clientes.html': { requiresAuth: true, requiredRole: null },
  'processos.html': { requiresAuth: true, requiredRole: null },
  'agenda.html': { requiresAuth: true, requiredRole: null },
  'audiencias.html': { requiresAuth: true, requiredRole: 'ADVOGADO' },
  'pericias.html': { requiresAuth: true, requiredRole: 'ADVOGADO' },
  'atendimentos.html': { requiresAuth: true, requiredRole: null },
  'documentos.html': { requiresAuth: true, requiredRole: null },
  'publicacoes.html': { requiresAuth: true, requiredRole: 'ADMIN' },
  'admin.html': { requiresAuth: true, requiredRole: 'ADMIN' }
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
    // Se tem role no cache, libera a UI imediatamente para não ficar "em branco"
    const cachedRole = localStorage.getItem('userRole');
    if (cachedRole) {
      // showPageContent(); // Comentado para evitar flash de conteúdo se o token for inválido
    }

    // Verifica autenticação
    // Aguarda o cliente estar pronto se necessário (lazy load no supabase.js)
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Guard: Erro ao obter sessão:', error);
      redirectToLogin();
      return;
    }

    if (!session) {
      console.warn('Guard: Sem sessão ativa. Redirecionando...');
      redirectToLogin();
      return;
    }
    
    // Verifica role específica
    if (requiredRole && !AuthAPI.hasPermission(requiredRole)) {
      console.warn(`Acesso negado a ${currentPage}. Role necessário: ${requiredRole}`);
      redirectToDashboard();
      return;
    }
    
    console.log(`Guard: Acesso permitido a ${currentPage} para ${session.user.email}`);
    
    // Tudo OK - mostra conteúdo
    showPageContent();
    
  } catch (error) {
    console.error('Erro no pageGuard:', error);
    redirectToLogin();
  }
}

// Redirecionamentos
function redirectToLogin() {
  if (currentPage !== 'login.html') {
    window.location.href = 'login.html';
  }
}

function redirectToDashboard() {
  window.location.href = 'index.html';
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
