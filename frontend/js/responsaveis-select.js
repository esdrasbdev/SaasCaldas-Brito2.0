/*
 * Componente reutilizável de seleção múltipla de responsáveis
 * Usado em audiências, perícias, atendimentos e processos
 * Roles elegíveis: ADMIN, ADVOGADO, ADVOGADA, ESTAGIARIO, ESTAGIARIA
 */
import { supabase } from './supabase.js';

const ROLES_RESPONSAVEL = ['ADMIN', 'ADVOGADO', 'ADVOGADA', 'ESTAGIARIO', 'ESTAGIARIA'];

export function criarSeletorResponsaveis({ inputEl, dropdownEl, tagsEl }) {
  let usuariosDisponiveis = [];
  let selecionados = [];

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
    tagsEl.innerHTML = selecionados.map(u => `
      <span class="tag-responsavel" data-tag-id="${u.id}" style="background:#eef2ff; color:#0b4a6f; padding:6px 10px; border-radius:16px; font-size:0.85rem; display:inline-flex; align-items:center; gap:8px; border:1px solid #c7d2fe;">
        <i class="fa-solid fa-user-tie" style="font-size:0.85rem;"></i>
        <span>${u.nome.split(' ')[0]}</span>
        <i class="fa-solid fa-times" style="cursor:pointer; font-size:0.8rem;" title="Remover"></i>
      </span>
    `).join('');

    tagsEl.querySelectorAll('.tag-responsavel').forEach(tag => {
      tag.querySelector('i.fa-times')?.addEventListener('click', () => {
        selecionados = selecionados.filter(u => u.id !== tag.dataset.tagId);
        renderizarTags();
      });
    });
  }

  function renderizarDropdown(lista) {
    if (!lista.length) {
      dropdownEl.innerHTML = '<div style="padding:12px; text-align:center; color:#999; font-size:0.9rem;">Nenhum usuário encontrado</div>';
      return;
    }
    dropdownEl.innerHTML = lista.map(u => `
      <div class="dropdown-responsavel-item" data-id="${u.id}" data-nome="${u.nome}" style="padding:10px 12px; cursor:pointer; border-bottom:1px solid #f0f0f0;">
        <strong>${u.nome}</strong><br><small style="color:#888;">${u.role}</small>
      </div>
    `).join('');

    dropdownEl.querySelectorAll('.dropdown-responsavel-item').forEach(item => {
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
    return disponiveis.filter(u => u.nome.toLowerCase().includes(t)).slice(0, 20);
  }

  function bindEventos() {
    inputEl.addEventListener('input', (e) => {
      renderizarDropdown(filtrar(e.target.value));
      dropdownEl.style.display = 'block';
    });
    inputEl.addEventListener('focus', () => {
      renderizarDropdown(filtrar(''));
      dropdownEl.style.display = 'block';
    });
    document.addEventListener('click', (e) => {
      if (e.target !== inputEl && !dropdownEl.contains(e.target)) {
        dropdownEl.style.display = 'none';
      }
    });
  }

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
      tagsEl.querySelectorAll('.fa-times').forEach(el => {
        el.style.display = disabled ? 'none' : 'inline';
      });
    }
  };
}
