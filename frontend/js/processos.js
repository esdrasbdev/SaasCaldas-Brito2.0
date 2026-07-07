/*
 * Módulo Processos
 * Suporta múltiplos responsáveis via responsaveis_processo
 */

import { supabase, initSupabase } from './supabase.js';
import { AuthAPI } from './auth.js';
import { showToast } from './utils.js';
import { criarSeletorResponsaveis } from './responsaveis-select.js';

// ==========================================
// MODEL
// ==========================================
const ProcessoModel = {
  async listarTodos() {
    const { data, error } = await supabase
      .from('processos')
      .select(
        '*, clientes(nome), ' +
          'responsaveis_processo(usuario_id, usuarios(nome))'
      )
      .order('criado_em', { ascending: false });

    if (error) throw error;

    // Ordenação extra: ATIVO -> ARQUIVADO -> SUSPENSO (mantém prioridade visível)
    const statusRank = { ATIVO: 0, ARQUIVADO: 1, SUSPENSO: 2 };
    return (data || []).sort((a, b) => {
      const ra = statusRank[(a.status || '').toUpperCase()] ?? 99;
      const rb = statusRank[(b.status || '').toUpperCase()] ?? 99;
      if (ra !== rb) return ra - rb;
      return new Date(b.criado_em) - new Date(a.criado_em);
    });
  },

  async buscarPorId(id) {
    const { data, error } = await supabase
      .from('processos')
      .select(
        '*, clientes(id, nome), ' +
          'responsaveis_processo(usuario_id, usuarios(nome))'
      )
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async deletar(id) {
    const { error } = await supabase.from('processos').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  async criar(processo) {
    const { data, error } = await supabase
      .from('processos')
      .insert([processo])
      .select('id')
      .single();

    if (error) throw error;
    return data;
  },

  async atualizar(id, dados) {
    const { error } = await supabase.from('processos').update(dados).eq('id', id);
    if (error) throw error;
    return true;
  },

  async sincronizarResponsaveis(processoId, selecionados) {
    await supabase.from('responsaveis_processo').delete().eq('processo_id', processoId);

    if (!selecionados.length) return;

    const registros = selecionados.map(u => ({
      processo_id: processoId,
      usuario_id: u.id
    }));

    const { error } = await supabase.from('responsaveis_processo').insert(registros);
    if (error) throw error;
  }
};

// ==========================================
// VIEW
// ==========================================
const ProcessoView = {
  modalEl: () => document.getElementById('modal-container'),
  formEl: () => document.getElementById('form-processo'),

  init() {
    const container = document.getElementById('view-processos-container');
    container.innerHTML = `
      <div class="card-section">
        <div style="display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap;align-items:center;">
          <input id="busca-processo" placeholder="Buscar CNJ/Cliente/Vara..." style="flex:1;">
          <select id="filtro-status" style="width:200px;">
            <option value="">Todos Status</option>
            <option value="ATIVO">Ativos</option>
            <option value="ARQUIVADO">Arquivados</option>
            <option value="SUSPENSO">Suspensos</option>
          </select>
        </div>
        <div class="table-responsive">
          <table class="recent-table">
            <thead>
              <tr>
                <th>Processo/Cliente</th>
                <th>Tribunal/Vara</th>
                <th>Status</th>
                <th>Criação</th>
                <th>Responsáveis</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody id="lista-processos-body"><tr><td colspan="6" class="text-center">Carregando...</td></tr></tbody>
          </table>
        </div>
      </div>
    `;
  },

  renderizarTabela(processos, isAdmin) {
    const tbody = document.getElementById('lista-processos-body');
    if (!processos?.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center p-5"><i class="fa-solid fa-folder-open fa-2x mb-2"></i><br>Nenhum processo.</td></tr>';
      return;
    }

    const formatSituacao = (status) => {
      const s = (status || '').toUpperCase();
      if (s === 'ATIVO') return { label: 'Ativo', badgeClass: 'status-ativo' };
      if (s === 'ARQUIVADO') return { label: 'Arquivado', badgeClass: 'status-arquivado' };
      if (s === 'SUSPENSO') return { label: 'Suspenso', badgeClass: 'status-suspenso' };
      return { label: status || 'N/A', badgeClass: `status-${(status || '').toLowerCase()}` };
    };

    tbody.innerHTML = processos.map(p => {
      const sit = formatSituacao(p.status);
      const resp = (p.responsaveis_processo || [])
        .map(r => r.usuarios?.nome?.split(' ')[0])
        .filter(Boolean)
        .join(', ') || '—';

      return `
        <tr>
          <td>
            <div style="font-weight:600;">${p.clientes?.nome || 'Sem Cliente'}</div>
            <small>${p.numero_cnj || 'S/N'}</small>
          </td>
          <td>
            <div>${p.tribunal || '-'}</div>
            <small>${p.vara || '-'}</small>
          </td>
          <td>
            <span class="status-badge ${sit.badgeClass}">${sit.label}</span>
          </td>
          <td>${p.criado_em ? new Date(p.criado_em).toLocaleDateString('pt-BR') : '-'}</td>
          <td style="max-width:220px;">${resp}</td>
          <td style="text-align:right;">
            <button class="btn-sm btn-view" data-id="${p.id}" title="Visualizar"><i class="fa-solid fa-eye"></i></button>
            <button class="btn-sm btn-edit" data-id="${p.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
            ${isAdmin ? `<button class="btn-sm btn-delete text-red-500" data-id="${p.id}" title="Excluir"><i class="fa-solid fa-trash"></i></button>` : ''}
          </td>
        </tr>
      `;
    }).join('');
  },

  abrirModal(processo = null, isView = false) {
    const modal = this.modalEl();
    const titulo = document.getElementById('modal-titulo');
    const form = this.formEl();
    const btnSalvar = form.querySelector('button[type="submit"]');
    const inputs = form.querySelectorAll('input, select');

    titulo.textContent = isView ? 'Visualizar Processo' : (processo ? 'Editar' : 'Novo');
    form.classList.toggle('mode-view', isView);

    inputs.forEach(el => (el.disabled = isView));
    if (btnSalvar) btnSalvar.style.display = isView ? 'none' : 'block';

    const closeBtn = modal.querySelector('.btn-close-modal');
    if (closeBtn) {
      closeBtn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        modal.style.display = 'none';
      };
    }

    // Populate
    if (processo) {
      document.getElementById('proc-id').value = processo.id;
      document.getElementById('proc-cnj').value = processo.numero_cnj || '';
      document.getElementById('proc-tribunal').value = processo.tribunal || '';
      document.getElementById('proc-vara').value = processo.vara || '';
      document.getElementById('proc-cliente').value = processo.clientes?.id || processo.cliente_id || '';
      document.getElementById('proc-status').value = processo.status || 'ATIVO';
    } else {
      document.getElementById('proc-id').value = '';
      document.getElementById('proc-cnj').value = '';
      document.getElementById('proc-tribunal').value = '';
      document.getElementById('proc-vara').value = '';
      document.getElementById('proc-cliente').value = '';
      document.getElementById('proc-status').value = 'ATIVO';
    }

    modal.style.display = 'flex';
  },

  fecharModal() {
    this.modalEl().style.display = 'none';
    this.formEl().reset();
  }
};

// ==========================================
// CONTROLLER
// ==========================================
const ProcessoController = {
  seletorResp: null,
  data: [],

  async init() {
    ProcessoView.init();
    await this.initResponsaveis();
    this.bindEvents();
    await this.loadAll();

    const clienteIdUrl = new URLSearchParams(window.location.search).get('cliente_id');
    if (clienteIdUrl) {
      const filtrados = this.data.filter(p => String(p.cliente_id || p.clientes?.id || '') === String(clienteIdUrl));
      const isAdmin = AuthAPI.getRole() === 'ADMIN';
      ProcessoView.renderizarTabela(filtrados, isAdmin);
      const nomeCliente = filtrados[0]?.clientes?.nome;
      if (nomeCliente) {
        const buscaEl = document.getElementById('busca-processo');
        if (buscaEl) buscaEl.value = nomeCliente;
      }
    }
  },

  async initResponsaveis() {
    this.seletorResp = criarSeletorResponsaveis({
      inputEl: document.getElementById('proc-responsaveis-busca'),
      dropdownEl: document.getElementById('proc-responsaveis-dropdown'),
      tagsEl: document.getElementById('proc-responsaveis-tags')
    });
    await this.seletorResp.init();
  },

  bindEvents() {
    // Cancel button
    document.getElementById('btn-cancelar').onclick = () => {
      ProcessoView.fecharModal();
      this.seletorResp?.limpar();
      this.seletorResp?.setDisabled(false);
    };

    // Novo
    document.getElementById('btn-novo-processo').onclick = () => {
      ProcessoView.abrirModal(null, false);
      this.seletorResp?.limpar();
      this.seletorResp?.setDisabled(false);

      // habilita inputs novamente
      const form = document.getElementById('form-processo');
      Array.from(form.querySelectorAll('input, select, textarea')).forEach(el => (el.disabled = false));
      form.classList.remove('mode-view');

      document.querySelector('#modal-titulo').textContent = 'Novo Processo';
    };

    document.getElementById('busca-processo').oninput = this.filter.bind(this);
    document.getElementById('filtro-status').onchange = this.filter.bind(this);

    document.getElementById('lista-processos-body').onclick = async (e) => {
      const target = e.target.closest('button');
      if (!target) return;

      const id = target.dataset.id;
      if (!id) return;

      const isAdmin = AuthAPI.getRole() === 'ADMIN';
      if (target.classList.contains('btn-delete')) {
        if (!isAdmin) return;

        const { confirmarExclusao } = await import('./utils.js');
        const ok = await confirmarExclusao({
          title: 'Excluir processo?',
          message: 'Tem certeza que deseja excluir este processo? Esta ação não pode ser desfeita.',
          confirmText: 'Sim, excluir',
          cancelText: 'Cancelar',
          danger: true
        });
        if (!ok) return;

        await ProcessoModel.deletar(id);
        showToast('Excluído!', 'success');
        await this.loadAll();
        return;
      }

      // Para view/edit sempre busca por id completo (para trazer responsáveis)
      const processo = await ProcessoModel.buscarPorId(id);
      const isView = target.classList.contains('btn-view');
      ProcessoView.abrirModal(processo, isView);

      const responsaveis = (processo.responsaveis_processo || []).map(r => ({
        id: r.usuario_id,
        nome: r.usuarios?.nome || ''
      }));

      this.seletorResp?.setSelecionados(responsaveis);
      this.seletorResp?.setDisabled(isView);

      // modo view desabilita submit via view; também desabilita inputs.
      if (isView) {
        const form = document.getElementById('form-processo');
        Array.from(form.querySelectorAll('input, select, textarea')).forEach(el => (el.disabled = true));
      }
    };

    document.getElementById('form-processo').onsubmit = async (e) => {
      e.preventDefault();

      const form = document.getElementById('form-processo');
      if (form.classList.contains('mode-view')) return;

      const selecionados = this.seletorResp?.getSelecionados() || [];
      if (!selecionados.length) {
        showToast('Selecione ao menos um responsável.', 'error');
        return;
      }

      const processoId = document.getElementById('proc-id').value;
      const isEdit = !!processoId;

      const payload = {
        numero_cnj: document.getElementById('proc-cnj').value,
        tribunal: document.getElementById('proc-tribunal').value,
        vara: document.getElementById('proc-vara').value,
        cliente_id: document.getElementById('proc-cliente').value || null,
        status: document.getElementById('proc-status').value,
        // campo legado requerido pelo prompt (se existir no schema)
        advogado_id: selecionados[0].id
      };

      try {
        let savedId = processoId;
        if (isEdit) {
          await ProcessoModel.atualizar(processoId, payload);
        } else {
          const created = await ProcessoModel.criar(payload);
          savedId = created.id;
        }

        await ProcessoModel.sincronizarResponsaveis(savedId, selecionados);

        showToast(isEdit ? 'Processo atualizado!' : 'Processo criado!', 'success');
      } catch (err) {
        console.error(err);
        showToast('Erro ao salvar: ' + (err?.message || err), 'error');
        return;
      } finally {
        ProcessoView.fecharModal();
        this.seletorResp?.limpar();
        await this.loadAll();
      }
    };
  },

  async loadAll() {
    this.data = await ProcessoModel.listarTodos();
    const isAdmin = AuthAPI.getRole() === 'ADMIN';
    ProcessoView.renderizarTabela(this.data, isAdmin);
    await this.loadClientes();
  },

  filter() {
    const termo = document.getElementById('busca-processo').value.toLowerCase();
    const status = document.getElementById('filtro-status').value;

    // Filtro por responsável (pelo seletor do modal: usa primeiro responsável selecionado)
    const selecionadosResp = this.seletorResp?.getSelecionados?.() || [];
    const usuarioIdFiltro = selecionadosResp[0]?.id || null;

    const filtered = this.data.filter(p => {
      const matchTerm =
        p.numero_cnj?.toLowerCase().includes(termo) ||
        p.clientes?.nome?.toLowerCase().includes(termo) ||
        (p.tribunal || '').toLowerCase().includes(termo) ||
        (p.vara || '').toLowerCase().includes(termo);

      const matchStatus = !status || p.status === status;

      if (usuarioIdFiltro) {
        const matchResp = (p.responsaveis_processo || []).some(r => r.usuario_id === usuarioIdFiltro);
        return matchTerm && matchStatus && matchResp;
      }

      return matchTerm && matchStatus;
    });

    ProcessoView.renderizarTabela(filtered, AuthAPI.getRole() === 'ADMIN');
  },


  async loadClientes() {
    const { data } = await supabase.from('clientes').select('id, nome').order('nome');
    const select = document.getElementById('proc-cliente');
    select.innerHTML = '<option value="">Cliente...</option>' + (data || []).map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  await initSupabase();
  await ProcessoController.init();
});



