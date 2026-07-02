/*
 * Componente reutilizável de seleção múltipla de responsáveis
 * Usado em clientes, audiências, perícias, atendimentos e processos
 * Roles elegíveis: ADMIN, ADVOGADO, ADVOGADA, ESTAGIARIO, ESTAGIARIA
 */

import { supabase } from './supabase.js';

const ROLES_RESPONSAVEL = ['ADMIN', 'ADVOGADO', 'ADVOGADA', 'ESTAGIARIO', 'ESTAGIARIA'];

const BADGE_POR_ROLE = {
  ADMIN: 'badge-role--admin',
  ADVOGADO: 'badge-role--advogado',
  ADVOGADA: 'badge-role--advogado',
  ESTAGIARIO: 'badge-role--estagiario',
  ESTAGIARIA: 'badge-role--estagiario'
};

const LABEL_POR_ROLE = {
  ADMIN: 'Admin',
  ADVOGADO: 'Advogado',
  ADVOGADA: 'Advogada',
  ESTAGIARIO: 'Estagiário',
  ESTAGIARIA: 'Estagiária'
};

function gerarIniciais(nome) {
  const partes = (nome || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  const primeira = partes[0][0] || '';
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}

export function criarSeletorResponsaveis({ inputEl, dropdownEl, tagsEl }) {
  let usuariosDisponiveis = [];
  let selecionados = [];

  const wrapperEl = inputEl.closest('.seletor-responsaveis');

  async function carregarUsuarios() {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nome, role')
      .eq('ativo', true)
      .in('role', ROLES_RESPONSAVEL)
      .order('nome', { ascending: true });

    if (error) {
      console.error('Erro ao carregar responsáveis:', error);
      return;
    }

    usuariosDisponiveis = data || [];
  }

  function renderizarTags() {
    if (!selecionados.length) {
      tagsEl.innerHTML = '<span class="responsaveis-tags-vazio">Nenhum responsável selecionado</span>';
      return;
    }

    tagsEl.innerHTML = selecionados
      .map(u => `
        <span class="tag-responsavel" data-tag-id="${u.id}">
          <span class="responsavel-avatar avatar-sm">${gerarIniciais(u.nome)}</span>
          <span>${(u.nome || '').split(' ')[0]}</span>
          <i class="fa-solid fa-times" title="Remover"></i>
        </span>
      `)
      .join('');

    tagsEl.querySelectorAll('.tag-responsavel').forEach(tag => {
      tag.querySelector('i.fa-times')?.addEventListener('click', () => {
        selecionados = selecionados.filter(u => u.id !== tag.dataset.tagId);
        renderizarTags();
      });
    });
  }

  function renderizarDropdown(lista) {
    if (!lista.length) {
      dropdownEl.innerHTML = `
        <div class="responsaveis-dropdown-vazio">
          <i class="fa-solid fa-user-slash"></i>
          Nenhum usuário encontrado
        </div>`;
      return;
    }

    dropdownEl.innerHTML = lista
      .map(u => `
        <div class="responsaveis-dropdown-item" data-id="${u.id}" data-nome="${u.nome}">
          <span class="responsavel-avatar">${gerarIniciais(u.nome)}</span>
          <span class="responsavel-info">
            <span class="responsavel-nome">${u.nome}</span>
            <span class="badge-role ${BADGE_POR_ROLE[u.role] || ''}">
              ${LABEL_POR_ROLE[u.role] || u.role}
            </span>
          </span>
        </div>
      `)
      .join('');

    dropdownEl.querySelectorAll('.responsaveis-dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const { id, nome } = item.dataset;
        if (!selecionados.some(u => u.id === id)) {
          selecionados.push({ id, nome });
          renderizarTags();
        }
        inputEl.value = '';
        dropdownEl.style.display = 'none';
      });
    });
  }

  function filtrar(termo) {
    const t = (termo || '').toLowerCase();
    const disponiveis = usuariosDisponiveis.filter(u => !selecionados.some(s => s.id === u.id));

    if (!t) return disponiveis.slice(0, 10);

    return disponiveis
      .filter(u => (u.nome || '').toLowerCase().includes(t))
      .slice(0, 20);
  }

  function bindEventos() {
    inputEl.addEventListener('input', (e) => {
      if (inputEl.disabled) return;
      renderizarDropdown(filtrar(e.target.value));
      dropdownEl.style.display = 'block';
    });

    inputEl.addEventListener('focus', () => {
      if (inputEl.disabled) return;
      renderizarDropdown(filtrar(''));
      dropdownEl.style.display = 'block';
      inputEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });

    inputEl.addEventListener('keydown', (e) => {
      if (inputEl.disabled) return;
      if (e.key === 'Escape') {
        dropdownEl.style.display = 'none';
        inputEl.blur();
      }
    });

    document.addEventListener('click', (e) => {
      if (inputEl.disabled) return;
      if (e.target !== inputEl && !dropdownEl.contains(e.target)) {
        dropdownEl.style.display = 'none';
      }
    });
  }


  renderizarTags();

  return {
    async init() {
      await carregarUsuarios();
      bindEventos();
    },
    getSelecionados: () => selecionados,
    setSelecionados(lista) {
      selecionados = lista || [];
      renderizarTags();
    },
    limpar() {
      selecionados = [];
      renderizarTags();
    },
    setDisabled(disabled) {
      inputEl.disabled = disabled;
      wrapperEl?.classList.toggle('is-disabled', disabled);

      if (disabled) {
        // Fecha o dropdown e evita interações residuais
        dropdownEl.style.display = 'none';
        try {
          inputEl.blur();
        } catch (_) {}
      }
    }
  };
}

