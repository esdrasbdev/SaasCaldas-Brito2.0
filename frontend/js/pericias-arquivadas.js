// Módulo Perícias Arquivadas
// Reutiliza parte da lógica de pericias.js, mas filtra por status=ARQUIVADA

import { supabase, initSupabase } from './supabase.js';
import { AuthAPI } from './auth.js';
import { showToast, formatarHora24h, formatarData, confirmarExclusao } from './utils.js';

function filtrar(lista, termoBusca, tipoFiltro) {
  return (lista || []).filter(p => {
    if (tipoFiltro && p.tipo !== tipoFiltro) return false;
    if (!termoBusca) return true;

    const cliente = (p.clientes?.nome || '').toLowerCase();
    const tipo = (p.tipo || '').toLowerCase();
    const local = (p.local || '').toLowerCase();
    const perito = (p.perito || '').toLowerCase();
    const dataObj = p.data ? new Date(p.data) : null;
    const dtTxt = dataObj ? formatarData(dataObj).toLowerCase() : '';
    const responsaveis = (p.responsaveis_pericia || []).map(r => r.usuarios?.nome || '').join(' ').toLowerCase();

    const termo = termoBusca.toLowerCase();
    return [cliente, tipo, local, perito, dtTxt, responsaveis].some(v => v.includes(termo));
  });
}

const PericiaArquivoView = {
  tbody() {
    return document.getElementById('lista-pericias');
  },

  renderizarTabela(lista) {
    const tbody = this.tbody();
    if (!tbody) return;

    if (!lista || lista.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center">Nenhuma perícia arquivada.</td></tr>`;
      return;
    }

    tbody.innerHTML = lista.map(p => {
      const dataTxt = p.data ? formatarData(p.data) : '-';
      const horaTxt = p.data ? formatarHora24h(p.data) : '';

      const responsaveis = (p.responsaveis_pericia || [])
        .map(r => r.usuarios?.nome?.split(' ')[0])
        .filter(Boolean)
        .join(', ') || '—';

      return `
        <tr>
          <td>
            <div style="font-weight:600; font-size:0.9rem;">${p.clientes?.nome || '-'}</div>
            <span class="status-badge status-arquivado" style="background:rgba(239,68,68,0.08); color:#b91c1c;">Arquivada</span>
          </td>
          <td style="white-space:nowrap;">
            <div style="font-size:0.9rem; font-weight:600;">${dataTxt}</div>
            <div style="font-size:0.8rem; color:var(--cinza-medio);">${horaTxt}</div>
          </td>
          <td style="font-size:0.85rem;">${p.local || '-'}</td>
          <td style="font-size:0.85rem;">${p.perito || 'Não informado'}</td>
          <td style="text-align:right; width:90px;">
            <button class="btn-sm btn-restore" data-id="${p.id}" title="Restaurar">
              <i class="fa-solid fa-box-archive"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }
};

const PericiasArquivadasController = {
  dataCompleta: [],

  bindEvents() {
    const buscaEl = document.getElementById('pericias-busca');
    const tipoEl = document.getElementById('pericias-filtro-tipo');

    buscaEl?.addEventListener('input', () => this.aplicarFiltros());
    tipoEl?.addEventListener('change', () => this.aplicarFiltros());

    document.getElementById('lista-pericias')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-restore');
      if (!btn) return;

      const id = btn.dataset.id;
      if (!id) return;

      const ok = await confirmarExclusao({
        title: 'Restaurar perícia?',
        message: 'Deseja restaurar esta perícia para a lista ativa?',
        confirmText: 'Sim, restaurar',
        cancelText: 'Cancelar',
        danger: false
      });

      if (!ok) return;

      try {
        await supabase.from('pericias').update({ status: 'ATIVA' }).eq('id', id);
        showToast('Perícia restaurada!', 'success');
        await this.loadAll();
      } catch (err) {
        console.error(err);
        showToast('Erro ao restaurar perícia.', 'error');
      }
    });
  },

  aplicarFiltros() {
    const buscaEl = document.getElementById('pericias-busca');
    const tipoEl = document.getElementById('pericias-filtro-tipo');

    const termo = (buscaEl?.value || '').trim().toLowerCase();
    const tipo = tipoEl?.value || '';

    const filtrados = filtrar(this.dataCompleta, termo, tipo);
    PericiaArquivoView.renderizarTabela(filtrados);
  },

  async loadAll() {
    const { data, error } = await supabase
      .from('pericias')
      .select('*, status, clientes(nome), responsaveis_pericia(usuario_id, usuarios(nome))')
      .eq('status', 'ARQUIVADA')
      .order('data', { ascending: true });

    if (error) {
      console.error(error);
      showToast('Erro ao carregar perícias arquivadas.', 'error');
      return;
    }

    this.dataCompleta = data || [];
    this.aplicarFiltros();
  },

  async init() {
    await initSupabase();
    this.bindEvents();
    await this.loadAll();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  PericiasArquivadasController.init();
});

