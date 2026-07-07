import { supabase, initSupabase, getApiUrl } from './supabase.js';
import { AuthAPI } from './auth.js';
import { showToast, confirmarExclusao, formatarData } from './utils.js';

const ProcuracoesView = {
  tbody() {
    return document.getElementById('lista-procuracoes');
  },

  modalEl() {
    return document.getElementById('modal-container');
  },

  abrirModal(titulo) {
    const modal = this.modalEl();
    if (!modal) return;
    const h2 = document.getElementById('modal-titulo');
    if (h2) h2.textContent = titulo;
    modal.style.display = 'flex';
  },

  fecharModal() {
    const modal = this.modalEl();
    if (!modal) return;
    modal.style.display = 'none';
  },

  renderizarTabela(itens) {
    const tbody = this.tbody();
    if (!tbody) return;

    if (!itens || itens.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center">Nenhuma procuração encontrada.</td></tr>`;
      return;
    }

    tbody.innerHTML = itens.map(p => {
      const clienteNome = p.clientes?.nome || p.cliente_nome || '—';
      const dataEmissao = p.data_emissao ? formatarData(new Date(p.data_emissao)) : '—';
      const vencimento = p.data_vencimento ? formatarData(new Date(p.data_vencimento)) : '—';

      const statusLabel = (() => {
        const s = (p.status || '').toUpperCase();
        if (s === 'ATIVA') return 'Ativa';
        if (s === 'PENDENTE') return 'Pendente';
        if (s === 'VENCIDA') return 'Vencida';
        return p.status || '—';
      })();

      return `
        <tr>
          <td>
            <div style="font-weight:600;">${clienteNome}</div>
          </td>
          <td style="white-space:nowrap;">${dataEmissao}</td>
          <td style="white-space:nowrap;">${vencimento}</td>
          <td>
            <span class="status-badge status-${(p.status || '').toLowerCase()}">${statusLabel}</span>
          </td>
          <td style="text-align:right; white-space:nowrap;">
            <div style="display:flex; gap:8px; justify-content:flex-end; align-items:center;">
              ${p.documento_id && p.documentos?.url ? `
                <a class="btn-sm btn-view" href="${p.documentos.url}" target="_blank" rel="noopener noreferrer" title="Visualizar">
                  <i class="fa-solid fa-eye"></i>
                </a>
              ` : ''}
              <button class="btn-sm btn-edit" data-id="${p.id}" title="Atualizar status/vencimento">
                <i class="fa-solid fa-pen"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }
};

function calcularFiltroStatus(p, filtro) {
  const hoje = new Date();
  const dataVenc = p.data_vencimento ? new Date(p.data_vencimento) : null;
  const statusBase = (p.status || '').toUpperCase();

  if (!filtro) return true;

  if (filtro === 'HISTORICO') {
    return statusBase === 'VENCIDA' || statusBase === 'PENDENTE';
  }

  if (filtro === 'ATIVA') {
    if (statusBase === 'ATIVA') return true;
    if (dataVenc && dataVenc >= hoje) return true;
    return false;
  }

  if (filtro === 'VENCIDA') {
    if (statusBase === 'VENCIDA') return true;
    if (dataVenc && dataVenc < hoje) return true;
    return false;
  }

  if (filtro === 'PENDENTE') {
    if (statusBase === 'PENDENTE') return true;
    if (dataVenc) {
      const diffDias = Math.ceil((dataVenc - hoje) / (1000 * 60 * 60 * 24));
      return diffDias >= 0 && diffDias <= 30;
    }
    return false;
  }

  return true;
}

const ProcuracoesController = {
  data: [],

  async loadClientes() {
    const { data, error } = await supabase
      .from('clientes')
      .select('id, nome')
      .order('nome');

    if (error) throw error;

    const sel = document.getElementById('proc-cliente-id');
    if (!sel) return;

    sel.innerHTML = '<option value="">Selecione...</option>' + (data || []).map(c => `
      <option value="${c.id}">${c.nome}</option>
    `).join('');
  },

  async loadAll() {
    const { data, error } = await supabase
      .from('procuracoes')
      .select('*, data_emissao, data_vencimento, status, cliente_id, clientes(nome), documentos(url)')
      .order('criado_em', { ascending: false });

    if (error) {
      showToast('Erro ao carregar procurações.', 'error');
      console.error(error);
      return;
    }

    this.data = data || [];
    this.aplicarFiltros();
  },

  aplicarFiltros() {
    const busca = (document.getElementById('procuracoes-busca')?.value || '').trim().toLowerCase();
    const filtroStatus = document.getElementById('procuracoes-filtro-status')?.value || '';

    const filtrados = (this.data || []).filter(p => {
      if (!calcularFiltroStatus(p, filtroStatus)) return false;
      if (!busca) return true;
      const nome = (p.clientes?.nome || '').toLowerCase();
      const docId = String(p.documento_id || '').toLowerCase();
      return [nome, docId].some(v => v.includes(busca));
    });

    ProcuracoesView.renderizarTabela(filtrados);
  },

  bindEvents() {
    document.getElementById('procuracoes-busca')?.addEventListener('input', () => this.aplicarFiltros());
    document.getElementById('procuracoes-filtro-status')?.addEventListener('change', () => this.aplicarFiltros());

    document.getElementById('btn-nova-procuracao')?.addEventListener('click', () => {
      this.abrirModalCriar();
    });

    document.getElementById('lista-procuracoes')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-edit');
      if (!btn) return;
      const id = btn.dataset.id;
      if (!id) return;
      this.abrirModalEditar(id);
    });

    document.getElementById('btn-cancelar')?.addEventListener('click', () => {
      ProcuracoesView.fecharModal();
    });

    document.getElementById('form-procuracao')?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      await this.salvarFromModal();
    });
  },

  abrirModalCriar() {
    document.getElementById('proc-id').value = '';
    document.getElementById('proc-data-emissao').value = '';
    document.getElementById('proc-data-vencimento').value = '';

    // status default via backend/migration (ATIVA)
    ProcuracoesView.abrirModal('Nova Procuração');
  },

  abrirModalEditar(id) {
    const p = (this.data || []).find(x => String(x.id) === String(id));
    if (!p) return;

    document.getElementById('proc-id').value = p.id;
    document.getElementById('proc-cliente-id').value = p.cliente_id || '';
    document.getElementById('proc-data-emissao').value = p.data_emissao || '';
    document.getElementById('proc-data-vencimento').value = p.data_vencimento || '';

    ProcuracoesView.abrirModal('Atualizar Procuração');
  },

  async salvarFromModal() {
    const id = document.getElementById('proc-id').value;
    const cliente_id = document.getElementById('proc-cliente-id').value;
    const data_emissao = document.getElementById('proc-data-emissao').value || null;
    const data_vencimento = document.getElementById('proc-data-vencimento').value || null;

    if (!cliente_id) {
      showToast('Selecione um cliente.', 'error');
      return;
    }

    const payload = {
      cliente_id,
      documento_id: null,
      data_emissao,
      data_vencimento
    };

    try {
      if (id) {
        await supabase.from('procuracoes').update(payload).eq('id', id);
        showToast('Procuração atualizada.', 'success');
      } else {
        await supabase.from('procuracoes').insert(payload);
        showToast('Procuração criada.', 'success');
      }

      ProcuracoesView.fecharModal();
      await this.loadAll();
    } catch (err) {
      console.error(err);
      showToast('Erro ao salvar procuração.', 'error');
    }
  },

  async init() {
    await initSupabase();
    this.bindEvents();
    await this.loadClientes();
    await this.loadAll();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  ProcuracoesController.init();
});

