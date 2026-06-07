/* 
 * Autenticação e autorização do sistema
 * Gerencia login/logout, busca role do usuário logado na tabela usuarios
 * Role salva no localStorage para uso rápido em guard.js e sidebar.js
 */

import { supabase } from './supabase.js'; // Módulo global

// Compat: se por algum motivo o navegador tentar carregar HTML no lugar do JS,
// o erro comum vira “Unexpected token '<'”. Isso facilita diagnóstico.
if (typeof window !== 'undefined' && !window._env) {
  console.warn('Auth: window._env não encontrado. js/env.js pode não ter carregado corretamente.');
}

// Estado global da autenticação
let currentUserRole = localStorage.getItem('userRole'); // Inicia com valor em cache se existir
let isFetching = false; // Previne chamadas duplicadas

// Busca role do usuário na tabela usuarios pelo email da sessão
async function fetchUserRole() {
  // Se já tem cache, retorna ele imediatamente para não travar a UI
  if (currentUserRole && !isFetching) {
    // Dispara evento mesmo assim para garantir que ouvintes (sidebar) funcionem
    window.dispatchEvent(new CustomEvent('auth:role-ready', { detail: currentUserRole }));
  }
  
  if (isFetching) return currentUserRole;
  isFetching = true;

  try {
    if (!supabase) {
      console.error('Auth: supabase client não inicializado (js/env.js sem chaves).');
      currentUserRole = null;
      localStorage.removeItem('userRole');
      return null;
    }
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    
    if (!user?.email) {
      currentUserRole = null;
      localStorage.removeItem('userRole');
      return null;
    }
    
    // Busca role na tabela usuarios (Fonte da verdade)
    const { data, error } = await supabase
      .from('usuarios')
      .select('role, nome')
      .eq('email', user.email)
      .single();

    if (!error && data) {
      currentUserRole = data.role;
      localStorage.setItem('userRole', currentUserRole);
      localStorage.setItem('userName', data.nome);
    }
    
    // Notifica o sistema que a role está pronta/atualizada
    window.dispatchEvent(new CustomEvent('auth:role-ready', { detail: currentUserRole }));
    return currentUserRole;
  } catch (error) {
    console.error('Erro em fetchUserRole:', error);
    return currentUserRole; // Retorna o que tiver em cache no pior caso
  } finally {
    isFetching = false;
  }
}


// Login com email/senha via Supabase Auth
async function login(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    
    // Salva o JWT para as chamadas de API do backend
    if (data.session) {
      localStorage.setItem('supabaseToken', data.session.access_token);
    }

    // Após login, busca role na tabela usuarios
    await fetchUserRole();
    
    console.log('✅ Login realizado. Role:', currentUserRole);
    return { success: true, role: currentUserRole };
  } catch (error) {
    console.error('Erro no login:', error);
    return { success: false, error: error.message };
  }
}

// Logout completo
async function logout() {
  try {
    // Limpa localStorage
    localStorage.removeItem('userRole');
    localStorage.removeItem('supabaseToken');
    localStorage.removeItem('userName');
    currentUserRole = null;
    
    // Supabase auth logout
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    console.log('✅ Logout realizado');
    window.location.href = 'login.html'; // Força redirecionamento imediato
    return { success: true };
  } catch (error) {
    console.error('Erro no logout:', error);
    return { success: false, error: error.message };
  }
}

// Verifica se usuário tem permissão para página específica
function hasPermission(requiredRole) {
  if (!currentUserRole) return false;
  
  // Hierarquia de roles: ADMIN > ADVOGADO/ADVOGADA > SECRETARIA > ESTAGIARIO/ESTAGIARIA
  const roleOrder = {
    'ADMIN': 5,
    'ADVOGADO': 4,
    'ADVOGADA': 4,
    'SECRETARIA': 3,
    'ESTAGIARIO': 2,
    'ESTAGIARIA': 2
  };
  
  return roleOrder[currentUserRole] >= roleOrder[requiredRole];
}

// Inicialização automática da sessão
async function initAuth() {
  try {
    // Dispara busca inicial
    await fetchUserRole();
    console.log('✅ Auth initialized');
  } catch (error) {
    console.error('Erro na initAuth:', error);
  }
}


// Listener para mudanças de autenticação (race-condition safe)
const setupAuthListener = () => {
  if (window.supabase?.auth?.onAuthStateChange) {
    window.supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN') {
        await fetchUserRole();
      } else if (event === 'SIGNED_OUT') {
        currentUserRole = null;
        localStorage.removeItem('userRole');
        localStorage.removeItem('supabaseToken');
        localStorage.removeItem('userName');
      }
    });
    console.log('✅ Auth listener attached');
  } else {
    console.log('Supabase not ready, waiting...');
    window.addEventListener('supabase-ready', () => setupAuthListener(), { once: true });
  }
};
setupAuthListener();

// APIs públicas
export const AuthAPI = {
  login,
  logout,
  hasPermission,
  getRole: () => currentUserRole,
  init: initAuth
};

// Compatibilidade global (opcional)
window.AuthAPI = AuthAPI;

// 🚀 Auto-inicialização: Garante que a role seja carregada assim que o script rodar
fetchUserRole();

// Compatibilidade: garante que sidebar/guard enxerguem role imediatamente via evento
window.addEventListener('auth:role-ready', () => {
  // noop - listener já existe onde precisa
});

