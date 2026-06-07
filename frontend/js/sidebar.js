/*
 * Gerenciamento do Menu Lateral (Sidebar)
 * Controla visibilidade de itens baseado no Nível de Acesso (Role)
 */

import { AuthAPI } from './auth.js';

const Sidebar = {
  init() {
    // Elementos da sidebar
    this.sidebar = document.querySelector('.sidebar'); // Assumindo que existe no HTML base
    this.navLinks = document.querySelectorAll('.sidebar-nav a');
    
    // Se não tiver sidebar na página (ex: login), ignora
    if (!this.sidebar) {
      console.warn('Sidebar não encontrada no DOM.');
      return;
    }

    // 1. Injeta a estrutura HTML padrão (Garante que existe em todas as páginas)
    this.render();
    
    // 2. Atualiza referências após renderizar
    this.navLinks = document.querySelectorAll('.sidebar-nav a');

    window.addEventListener('auth:role-ready', (e) => {
      this.atualizarMenu(e.detail);
      this.atualizarInfoUsuario();
    });

    // Caso a role já esteja em cache, roda imediatamente
    // IMPORTANTE: após render(), navLinks já existem.
    const currentRole = AuthAPI.getRole();
    if (currentRole) {
      this.atualizarMenu(currentRole);
      this.atualizarInfoUsuario();
    } else {
      // Fallback: tenta ler localStorage diretamente (para evitar race condition)
      const cachedRole = localStorage.getItem('userRole');
      if (cachedRole) {
        this.atualizarMenu(cachedRole);
        this.atualizarInfoUsuario();
      }
    }


    this.bindLogout();
  },

  render() {
    // Recupera tema salvo ou padrão light
    const isDark = localStorage.getItem('theme') === 'dark';
    if (isDark) document.body.classList.add('dark-mode');

    this.sidebar.innerHTML = `
      <div class="sidebar-header">
        <div class="brand-logo-text">
          <span>Caldas & Brito</span>
          <small>Advocacia</small>
        </div>
      </div>
      <ul class="sidebar-nav">
        <li><a href="index.html" class="nav-item"><i class="fa-solid fa-chart-pie"></i> Dashboard</a></li>
        <li><a href="clientes.html" class="nav-item"><i class="fa-solid fa-users"></i> Clientes</a></li>
        <li><a href="processos.html" class="nav-item"><i class="fa-solid fa-gavel"></i> Processos</a></li>
        <li><a href="agenda.html" class="nav-item"><i class="fa-solid fa-calendar-days"></i> Agenda</a></li>
        
        <li class="sidebar-header-group">JURÍDICO</li>
        <li><a href="audiencias.html" class="nav-item"><i class="fa-solid fa-user-tie"></i> Audiências</a></li>
        <li><a href="pericias.html" class="nav-item"><i class="fa-solid fa-magnifying-glass"></i> Perícias</a></li>
        <li><a href="atendimentos.html" class="nav-item"><i class="fa-solid fa-comments"></i> Atendimentos</a></li>
        
        <li class="sidebar-header-group admin-group-label">ADMINISTRAÇÃO</li>
        <li><a href="publicacoes.html" class="nav-item"><i class="fa-solid fa-newspaper"></i> Publicações</a></li>
        <li><a href="admin.html" class="nav-item"><i class="fa-solid fa-gear"></i> Usuários</a></li>
      </ul>

      
      <div class="sidebar-footer">
        <div class="user-profile">
          <div class="user-avatar">
            <i class="fa-solid fa-user"></i>
          </div>
          <div class="user-info">
            <span class="user-name">Carregando...</span>
            <span class="user-role">...</span>
          </div>
          <button id="btn-logout" class="btn-logout" title="Sair">
            <i class="fa-solid fa-right-from-bracket"></i>
          </button>
          <button id="btn-theme-toggle" class="btn-theme-inline" title="Alternar Tema">
            <i class="fa-solid ${isDark ? 'fa-sun' : 'fa-moon'}"></i>
          </button>
        </div>
      </div>
    `;

    this.bindThemeToggle();
  },

  atualizarMenu(role) {
    if (!role) return;

    const permissoes = {

      'index.html': ['ADMIN', 'ADVOGADO', 'ADVOGADA', 'SECRETARIA', 'ESTAGIARIO', 'ESTAGIARIA'],
      'dashboard.html': ['ADMIN', 'ADVOGADO', 'ADVOGADA', 'SECRETARIA', 'ESTAGIARIO', 'ESTAGIARIA'],
      'clientes.html': ['ADMIN', 'ADVOGADO', 'ADVOGADA', 'SECRETARIA', 'ESTAGIARIO', 'ESTAGIARIA'],
      'processos.html': ['ADMIN', 'ADVOGADO', 'ADVOGADA', 'SECRETARIA', 'ESTAGIARIO', 'ESTAGIARIA'],
      'agenda.html': ['ADMIN', 'ADVOGADO', 'ADVOGADA', 'SECRETARIA', 'ESTAGIARIO', 'ESTAGIARIA'],
      'audiencias.html': ['ADMIN', 'ADVOGADO', 'ADVOGADA', 'SECRETARIA'],
      'pericias.html': ['ADMIN', 'ADVOGADO', 'ADVOGADA', 'SECRETARIA'],
      'atendimentos.html': ['ADMIN', 'ADVOGADO', 'ADVOGADA', 'SECRETARIA', 'ESTAGIARIO', 'ESTAGIARIA'],
      'publicacoes.html': ['ADMIN'],
      'admin.html': ['ADMIN']
    };

    let adminVisible = false;

    this.navLinks.forEach(link => {
      link.classList.add('nav-item');
      const href = link.getAttribute('href').replace(/^(\.\/|\/)/, '').trim();
      const allowedRoles = permissoes[href];

      const allowed = allowedRoles && allowedRoles.includes(role);
      link.parentElement.style.display = allowed ? 'block' : 'none';

      // ADMINISTRAÇÃO: título só deve aparecer se algum item desse grupo estiver visível
      if (href === 'publicacoes.html' || href === 'admin.html') {
        if (allowed) adminVisible = true;
      }


      if (window.location.pathname.includes(href)) {
        link.classList.add('active');
      }
    });

    const adminLabel = this.sidebar.querySelector('.admin-group-label');
    if (adminLabel) adminLabel.style.display = adminVisible ? 'block' : 'none';

  },

  atualizarInfoUsuario() {
    const userName = localStorage.getItem('userName') || 'Usuário';
    const userRole = localStorage.getItem('userRole') || '';
    
    const nameEl = this.sidebar.querySelector('.user-name');
    const roleEl = this.sidebar.querySelector('.user-role');
    
    if (nameEl) nameEl.textContent = userName;
    if (roleEl) roleEl.textContent = userRole;
  },

  bindThemeToggle() {
    const btnTheme = document.getElementById('btn-theme-toggle');
    if (btnTheme) {
      btnTheme.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        
        // Atualiza ícone
        const icon = btnTheme.querySelector('i');
        if (isDark) {
          icon.classList.replace('fa-moon', 'fa-sun');
        } else {
          icon.classList.replace('fa-sun', 'fa-moon');
        }

        // Atualiza logo conforme tema
        const logo = this.sidebar.querySelector('.brand-logo-text');
        if (logo) {
          logo.classList.toggle('logo-dark', !isDark);
        }
      });
    }
  },

  bindLogout() {
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', (e) => {
        e.preventDefault();
        AuthAPI.logout();
      });
    }
  }
};

function iniciarSidebar() {
  try {
    Sidebar.init();
  } catch (err) {
    console.error('Erro ao inicializar Sidebar:', err);
  }
}

// Inicia assim que o DOM estiver pronto (ou imediatamente se já estiver carregado)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarSidebar);
} else {
  iniciarSidebar();
}
