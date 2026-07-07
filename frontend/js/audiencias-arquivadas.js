// Módulo Audiências Arquivadas
// Reutiliza parte da lógica de audiencias.js, mas filtra por status=ARQUIVADA

import { supabase, initSupabase } from './supabase.js';
import { AuthAPI } from './auth.js';
import { showToast, formatarHora24h, formatarData, confirmarExclusao } from './utils.js';
import { criarSeletorResponsaveis } from './responsaveis-select.js';

const AudienciaArquivoView = {
  listaBody() {
    return document.getElementById('lista-audiencias');
  },

  renderizarTabela(lista) {
    const tbody = this.listaBody();
    if (!tbody) return;

    if (!lista || lista.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center">Nenhuma audiência arquivada.</td></tr>`;
      return;
    }

    tbody.innerHTML = lista.map(a => {
      const dataObj = a.data ? new Date(a.data) : null;
      const dataTxt = dataObj ? formatarData(dataObj) : '-';
      const horaTxt = dataObj ? formatarHora24h(dataObj) : '';

      const clienteNome = a.processos?.clientes?.nome || a.clientes?.nome || '—';
      const numeroCnj = a.processos?.numero_cnj || 'S/N';

      const responsaveis = (a.responsaveis_audiencia || [])
        .map(r => r.usuarios?.nome?.split(' ')[0])
        .filter(Boolean)
        .join(', ') || '—';

      return `
        <tr>
          <td style="width:140px; white-space:nowrap;">
            <div style="font-weight:600; color:var(--azul-escuro); font-size:0.9rem;">${dataTxt}</div>
            <div style="font-size:0.8rem; color:var(--cinza-medio);">${horaTxt}</div>
          </td>
          <td>
            <div style="font-weight:600; font-size:0.9rem;">${clienteNome}</div>
            <div style="font-size:0.75rem; color:var(--cinza-medio);">CNJ: ${numeroCnj}</div>
          </td>
          <td>
            <div style="font-size:0.85rem;">${a.local || 'Virtual'}</div>
          </td>
          <td style="width:110px;">
            <span class="status-badge status-arquivado">Arquivada</span>
          </td>
          <td style="width:110px; text-align: right; vertical-align:middle;">
            <div style="display:flex; gap:6px; justify-content:flex-end; align-items:center;">
              <button class="btn-sm btn-restore" data-id="${a.id}" title="Restaurar">
                <i class="fa-solid fa-box-archive"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }
};

function filtrar(lista, termoBusca, tipoFiltro) {
  return (lista || []).filter(a => {
    if (tipoFiltro && a.tipo !== tipoFiltro) return false;
    if (!termoBusca) return true;

    const clienteNome = (a.processos?.clientes?.nome || a.clientes?.nome || '').toLowerCase();
    const numeroCnj = (a.processos?.numero_cnj || '').toLowerCase();
    const tipo = (a.tipo || '').toLowerCase();
    const local = (a.local || '').toLowerCase();
    const dataObj = a.data ? new Date(a.data) : null;
    const dtTxt = dataObj ? formatarData(dataObj).toLowerCase() : '';
    const responsaveis = (a.responsaveis_audiencia || []).map(r => r.usuarios?.nome || '').join(' ').toLowerCase();

    const termo = termoBusca.toLowerCase();
    return [clienteNome, numeroCnj, tipo, local, dtTxt, responsaveis].some(v => v.includes(termo));
  });
}

const AudienciaArquivadasController = {
  dataCompleta: [],

  async loadAll() {
    // estado depende da migration: /audiencias aceita status como ?status (prompt)
    const termoTipoEl = document.getElementById('audiencias-filtro-tipo');

    const { data, error } = await supabase
      .from('audiencias')
      .select('*, status, processos(numero_cnj, clientes(nome)), clientes(nome), usuarios(nome), responsaveis_audiencia(usuario_id, usuarios(nome))')
      .eq('status', 'ARQUIVADA')
      .order('data', { ascending: true });

    if (error) {
      console.error(error);
      showToast('Erro ao carregar audiências arquivadas.', 'error');
      return;
    }

    this.dataCompleta = data || [];
    this.aplicarFiltros();
  },

  aplicarFiltros() {
    const buscaEl = document.getElementById('audiencias-busca');
    const tipoEl = document.getElementById('audiencias-filtro-tipo');

    const termo = (buscaEl?.value || '').trim().toLowerCase();
    const tipo = tipoEl?.value || '';

    const filtrados = filtrar(this.dataCompleta, termo, tipo);
    AudienciaArquivoView.renderizarTabela(filtrados);
  },

  bindEvents() {
    const buscaEl = document.getElementById('audiencias-busca');
    const tipoEl = document.getElementById('audiencias-filtro-tipo');

    buscaEl?.addEventListener('input', () => this.aplicarFiltros());
    tipoEl?.addEventListener('change', () => this.aplicarFiltros());

    document.getElementById('lista-audiencias')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-restore');
      if (!btn) return;

      const id = btn.dataset.id;
      if (!id) return;

      const ok = await confirmarExclusao({
        title: 'Restaurar audiência?',
        message: 'Deseja restaurar esta audiência para a lista ativa?',
        confirmText: 'Sim, restaurar',
        cancelText: 'Cancelar',
        danger: false
      });

      if (!ok) return;

      try {
        await supabase.from('audiencias').update({ status: 'ATIVA' }).eq('id', id);
        showToast('Audiência restaurada!', 'success');
        await this.loadAll();
      } catch (err) {
        console.error(err);
        showToast('Erro ao restaurar audiência.', 'error');
      }
    });
  },

  async init() {
    await initSupabase();
    this.bindEvents();
    await this.loadAll();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  AudienciaArquivadasController.init();
});

