/*
 * Módulo Processos - Production Ready (Senior Review)
 * Modal view exact cliente style, robust error handling
 */

import { supabase, initSupabase } from './supabase.js';
import { AuthAPI } from './auth.js';
import { showToast } from './utils.js';

// MODEL
const ProcessoModel = {
  async listarTodos() {
    try {
      const { data, error } = await supabase
        .from('processos')
        .select('*, clientes(nome)');
      if (error) throw error;

      // Ordenação: ATIVOS (mais recente primeiro) -> ARQUIVADOS -> SUSPENSOS
      const statusRank = { ATIVO: 0, ARQUIVADO: 1, SUSPENSO: 2 };
      return (data || []).sort((a, b) => {
        const ra = statusRank[(a.status || '').toUpperCase()] ?? 99;
        const rb = statusRank[(b.status || '').toUpperCase()] ?? 99;
        if (ra !== rb) return ra - rb;
        return new Date(b.criado_em) - new Date(a.criado_em);
      });
    } catch (error) {
      console.error('listarTodos error:', error);
      throw error;
    }
  },
  async deletar(id) {
    const { error } = await supabase.from('processos').delete().eq('id', id);
    if (error) throw error;
    return true;
  },
  async criar(processo) {
    const { error } = await supabase.from('processos').insert([processo]);
    if (error) throw error;
    return true;
  },
  async atualizar(id, dados) {
    const { error } = await supabase.from('processos').update(dados).eq('id', id);
    if (error) throw error;
    return true;
  }
};

// VIEW
const ProcessoView = {
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
            <thead><tr><th>Processo/Cliente</th><th>Tribunal/Vara</th><th>Status</th><th>Criação</th><th>Ações</th></tr></thead>
            <tbody id="lista-processos-body"><tr><td colspan="5" class="text-center">Carregando...</td></tr></tbody>
          </table>
        </div>
      </div>
    `;
  },

  renderizarTabela(processos, isAdmin) {
    const tbody = document.getElementById('lista-processos-body');
    if (!processos?.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center p-5"><i class="fa-solid fa-folder-open fa-2x mb-2"></i><br>Nenhum processo.</td></tr>';
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
      return `
        <tr>
          <td><div style="font-weight:600;">${p.clientes?.nome || 'Sem Cliente'}</div><small>${p.numero_cnj || 'S/N'}</small></td>
          <td><div>${p.tribunal || '-'}</div><small>${p.vara || '-'}</small></td>
          <td>
            <span class="status-badge ${sit.badgeClass}">${sit.label}</span>
          </td>
          <td>${new Date(p.criado_em).toLocaleDateString('pt-BR')}</td>
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
    const modal = document.getElementById('modal-container');
    const titulo = document.getElementById('modal-titulo');
    const form = document.getElementById('form-processo');
    const btnSalvar = form.querySelector('button[type="submit"]');
    const inputs = form.querySelectorAll('input, select');
    
    // Title & mode
    titulo.textContent = isView ? 'Visualizar Processo' : (processo ? 'Editar' : 'Novo');
    form.classList.toggle('mode-view', isView);
    inputs.forEach(el => el.disabled = isView);
    btnSalvar.style.display = isView ? 'none' : 'block';

    // Close X (garante que funcione sempre e fecha modal)
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
      // default para novo
      const procStatus = document.getElementById('proc-status');
      if (procStatus) procStatus.value = 'ATIVO';
    }

    // Troca visual do status em view (mesmo que view esteja escondida)
    modal.style.display = 'flex';
  },

  fecharModal() {
    document.getElementById('modal-container').style.display = 'none';
    document.getElementById('form-processo').reset();
  }
};

// CONTROLLER
const ProcessoController = {
  async init() {
    const isAdmin = AuthAPI.getRole() === 'ADMIN';
    ProcessoView.init();
    this.bindEvents(isAdmin);
    await this.loadAll();
  },

  bindEvents(isAdmin) {
    // Cancel button
    document.getElementById('btn-cancelar').onclick = () => ProcessoView.fecharModal();

    // Novo
    document.getElementById('btn-novo-processo').onclick = () => ProcessoView.abrirModal();

    // Form submit
    document.getElementById('form-processo').onsubmit = async e => {
      e.preventDefault();
      const id = document.getElementById('proc-id').value;
      const payload = {
        numero_cnj: document.getElementById('proc-cnj').value,
        tribunal: document.getElementById('proc-tribunal').value,
        vara: document.getElementById('proc-vara').value,
        cliente_id: document.getElementById('proc-cliente').value || null,
        status: document.getElementById('proc-status').value
      };
      try {
        if (id) await ProcessoModel.atualizar(id, payload);
        else await ProcessoModel.criar(payload);
        showToast(id ? 'Atualizado!' : 'Criado!', 'success');
      } catch (err) {
        showToast('Erro: ' + err.message, 'error');
      } finally {
        ProcessoView.fecharModal();
        await this.loadAll();
      }
    };

    // Filter
    document.getElementById('busca-processo').oninput = this.filter.bind(this);
    document.getElementById('filtro-status').onchange = this.filter.bind(this);

    // Table clicks
    document.getElementById('lista-processos-body').onclick = async e => {
      const target = e.target.closest('button');
      if (!target) return;
      
      const id = target.dataset.id;
      if (!id) return;

      if (target.classList.contains('btn-view')) {
        const processo = this.data.find(p => p.id === id);
        ProcessoView.abrirModal(processo, true);
      } else if (target.classList.contains('btn-edit')) {
        const processo = this.data.find(p => p.id === id);
        ProcessoView.abrirModal(processo, false);
      } else if (target.classList.contains('btn-delete')) {
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
    const filtered = this.data.filter(p => 
      p.numero_cnj?.toLowerCase().includes(termo) || 
      p.clientes?.nome.toLowerCase().includes(termo) || 
      (!status || p.status === status)
    );
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
  ProcessoController.init();
});


