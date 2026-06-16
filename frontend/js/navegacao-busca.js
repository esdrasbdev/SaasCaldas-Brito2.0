import { AuthAPI } from './auth.js';

const SELECTORES = {
  input: '#nav-busca',
  // No sidebar.js o container real é a <ul class="sidebar-nav">, mas pode existir variação entre páginas.
  container: '.sidebar-nav'
};


function normalizarTexto(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function iniciarBuscaSidebar() {
  const input = document.querySelector(SELECTORES.input);
  const container = document.querySelector(SELECTORES.container);
  if (!input || !container) return;

  const links = Array.from(container.querySelectorAll('a'));
  if (links.length === 0) return;

  // Quando usuário digitar, filtra visibilidade dos links.
  input.addEventListener('input', () => {
    const termo = normalizarTexto(input.value);

    links.forEach(link => {
      const txt = normalizarTexto(link.textContent);
      const href = normalizarTexto(link.getAttribute('href'));

      const match = termo.length === 0 || txt.includes(termo) || href.includes(termo);
      link.parentElement.style.display = match ? 'block' : 'none';
    });

    // Também tenta esconder grupo ADMIN quando nenhum item dele casar com o termo.
    // A lógica original de permissão continua sendo aplicada no sidebar.js.
    const adminHeader = container.parentElement?.querySelector('.admin-group-label');
    if (adminHeader) {
      const adminItems = container.querySelectorAll('a[href="publicacoes.html"], a[href="admin.html"]');
      const algumaVisivel = Array.from(adminItems).some(a => a.parentElement?.style?.display !== 'none');
      adminHeader.style.display = algumaVisivel ? 'block' : 'none';
    }
  });
}

// Inicializa quando role já estiver pronto.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarBuscaSidebar);
} else {
  iniciarBuscaSidebar();
}

