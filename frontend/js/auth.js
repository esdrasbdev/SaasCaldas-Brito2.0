/* 
 * Autenticação e autorização do sistema
 * Gerencia login/logout, busca role do usuário logado na tabela usuarios
 * Role salva no localStorage para uso rápido em guard.js e sidebar.js
 */

import { initSupabase, getSupabaseClient } from './supabase.js';


// Compat: se por algum motivo o navegador tentar carregar HTML no lugar do JS,
// o erro comum vira “Unexpected token '<'”. Isso facilita diagnóstico.
if (typeof window !== 'undefined' && !window._env) {
  console.warn('Auth: window._env não encontrado. js/env.js pode não ter carregado corretamente.');
}

// Estado global da autenticação
let currentUserRole = localStorage.getItem('userRole'); // Inicia com valor em cache se existir
let isFetching = false; // Previne chamadas duplicadas

// Busca role do usuário na tabela usuarios
// IMPORTANTE: NÃO depende de supabase.auth.getSession() (evita race no restore de sessão).
// Se um session/user for fornecido, usa ele; caso contrário, aguarda requireAuth.
async function fetchUserRole({ session } = {}) {
  await initSupabase();
  const supabase = getSupabaseClient();

  if (currentUserRole && !isFetching) {
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

    // Resolve user a partir de session fornecida ou espera sessão via requireAuth.
    let user = session?.user;

    if (!user?.email) {
      // requireAuth usa onAuthStateChange e aguarda INITIAL_SESSION/SIGNED_IN.
      // Se não houver sessão, ele vai redirecionar para login.
      const resolvedSession = await requireAuth({ timeoutMs: 5000 }).catch(() => null);
      user = resolvedSession?.user;
    }

    if (!user?.email) {
      currentUserRole = null;
      localStorage.removeItem('userRole');
      return null;
    }

    const { data, error } = await supabase
      .from('usuarios')
      .select('role, nome')
      .eq('email', user.email)
      .single();

    if (!error && data) {
      currentUserRole = data.role;
      localStorage.setItem('userRole', currentUserRole);
      localStorage.setItem('userName', data.nome);
    } else {
      currentUserRole = null;
      localStorage.removeItem('userRole');
    }

    window.dispatchEvent(new CustomEvent('auth:role-ready', { detail: currentUserRole }));
    return currentUserRole;
  } catch (error) {
    console.error('Erro em fetchUserRole:', error);
    return currentUserRole;
  } finally {
    isFetching = false;
  }
}



// Login com email/senha via Supabase Auth
async function login(email, password) {
  try {
    await initSupabase();
    const supabase = getSupabaseClient();

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
    await initSupabase();
    const supabase = getSupabaseClient();

    window.location.replace('login.html');


    // Limpa localStorage
    localStorage.removeItem('userRole');
    localStorage.removeItem('supabaseToken');
    localStorage.removeItem('userName');
    currentUserRole = null;
    
    // Supabase auth logout
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    console.log('✅ Logout realizado');
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
    await initSupabase();
    // Dispara busca inicial
    await fetchUserRole();

    console.log('✅ Auth initialized');
  } catch (error) {
    console.error('Erro na initAuth:', error);
  }
}


// Listener para mudanças de autenticação (race-condition safe)
async function setupAuthListener() {
  await initSupabase();
  const supabase = getSupabaseClient();

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      // Evita depender de getSession(): repassa a sessão recebida
      await fetchUserRole({ session });
    } else if (event === 'SIGNED_OUT') {
      currentUserRole = null;
      localStorage.removeItem('userRole');
      localStorage.removeItem('supabaseToken');
      localStorage.removeItem('userName');
    }
  });
}

setupAuthListener().catch((e) => console.error('Auth listener error', e));


export async function requireAuth({ timeoutMs = 5000 } = {}) {
  const supabase = await initSupabase();

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.error('Auth timeout: sem resposta do Supabase em', timeoutMs, 'ms.');
      window.location.replace('login.html');
      reject(new Error('Auth timeout'));
    }, timeoutMs);

    supabase.auth.onAuthStateChange((event, session) => {
      if (settled) return;
      // IMPORTANTE: resolve/redirect só no primeiro estado definitivo
      if (event === 'SIGNED_IN' || (event === 'INITIAL_SESSION' && session)) {
        settled = true;
        clearTimeout(timeout);
        resolve(session);
      } else if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
        settled = true;
        clearTimeout(timeout);
        window.location.replace('login.html');
        reject(new Error('Não autenticado'));
      }
    });
  });
}

export async function requireGuest({ timeoutMs = 3000 } = {}) {
  const supabase = await initSupabase();

  return new Promise((resolve) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(null);
    }, timeoutMs);

    supabase.auth.onAuthStateChange((event, session) => {
      if (settled) return;
      if (event === 'SIGNED_IN' || (event === 'INITIAL_SESSION' && session)) {
        settled = true;
        clearTimeout(timeout);
        window.location.replace('index.html');
        resolve(session);
      } else if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
        settled = true;
        clearTimeout(timeout);
        resolve(null);
      }
    });
  });
}


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
fetchUserRole().catch(()=>{});



// Compatibilidade: garante que sidebar/guard enxerguem role imediatamente via evento
window.addEventListener('auth:role-ready', () => {
  // noop - listener já existe onde precisa
});

