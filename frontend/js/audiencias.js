/*
 * Módulo Audiências
 * Gerenciamento de audiências vinculadas a processos
 */

import { supabase } from './supabase.js';
import { AuthAPI } from './auth.js';
import { showToast } from './utils.js';

// Importando explicitamente o handler de logout para evitar
// trechos “soltos” e garantir que o arquivo compile sem erros de sintaxe.
// (O erro “Invalid left-hand side in assignment” geralmente ocorre quando
// há código incompatível/espalhado fora de funções.)


// ==========================================
// 1. MODEL
// ==========================================
const AudienciaModel = {
  async listarTodas() {
    const { data, error } = await supabase
      .from('audiencias')
      .select('*, processos(numero_cnj, clientes(nome)), clientes(nome), usuarios(nome)')
      .order('data', { ascending: true });

    if (error) throw error;
    return data;
  },


  async criar(audiencia) {
    // CORREÇÃO AQUI: Removemos campos que não existem na tabela se vierem nulos
    const { data, error } = await supabase
      .from('audiencias')
      .insert([audiencia])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deletar(id) {
    const { error } = await supabase.from('audiencias').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  async buscarPorId(id) {
    const { data, error } = await supabase
      .from('audiencias')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async atualizar(id, audiencia) {
    const { data, error } = await supabase
      .from('audiencias')
      .update(audiencia)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }
};

// ==========================================
// 2. VIEW
// ==========================================
const AudienciaView = {
  container: document.querySelector('.main-content') || document.body,

  init() {
    // A página já existe no audiencias.html; não recriamos DOM.
  },

  tabelaBody() {
    return document.getElementById('lista-audiencias');
  },

  renderizarTabela(lista) {
    const tbody = this.tabelaBody();
    if (!tbody) return;

    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center">Nenhuma audiência agendada.</td></tr>`;
      return;
    }

    tbody.innerHTML = lista.map(a => {
      const dataObj = a.data ? new Date(a.data) : null;
      const dataTxt = dataObj
        ? dataObj.toLocaleDateString('pt-BR')
        : '-';
const horaTxt = dataObj ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(dataObj) : '';


      const clienteNome = a.processos?.clientes?.nome || '—';
      const numeroCnj = a.processos?.numero_cnj || 'S/N';

      return `
        <tr>
          <td>
            <div style="font-weight: 600; color: var(--azul-escuro);">${dataTxt}</div>
            <div class="text-muted">${horaTxt}</div>
          </td>
          <td>
            <div>${clienteNome}</div>
            <small class="text-muted">CNJ: ${numeroCnj}</small>
          </td>
          <td>
            <div class="text-muted">${a.local || 'Virtual'}</div>
            <span class="status-badge" style="background: #e0f2fe; color: #0284c7;">${a.tipo || '-'}</span>
          </td>
      <td style="text-align: right;">
        <div style="display:flex; gap:8px; justify-content:flex-end; align-items:center;">
          <button class="btn-sm btn-view" data-id="${a.id}" title="Visualizar"><i class="fa-solid fa-eye"></i></button>
          <button class="btn-sm btn-edit" data-id="${a.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-sm btn-delete" data-id="${a.id}" style="color: #ef4444;"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
        </tr>
      `;
    }).join('');
  },

  modalEl() {
    return document.getElementById('form-container');
  },

  modal(abrir) {
    const el = this.modalEl();
    if (!el) return;
    el.style.display = abrir ? 'flex' : 'none';
  },

  ensureHiddenField() {
    if (document.getElementById('aud-id')) return;
    const hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.id = 'aud-id';
    hidden.value = '';
    const form = document.getElementById('form-audiencia');
    if (form) form.insertBefore(hidden, form.firstChild);
  }
};


// ==========================================
// 3. CONTROLLER
// ==========================================
const AudienciaController = {
  async init() {
    AudienciaView.init();

      await this.loadClientes();
    await this.loadProcessos(); // opcional (caso o modal permita)

    // evita duplicar listener/handlers em Hot-reload
    const lista = document.getElementById('lista-audiencias');
    if (lista && !lista.dataset.bound) {
      lista.dataset.bound = 'true';
    }

    AudienciaView.ensureHiddenField();
    await this.carregarDados();
    this.bindEvents();
  },


  async loadClientes() {
    const { data, error } = await supabase
      .from('clientes')
      .select('id, nome')
      .order('nome', { ascending: true });

    if (error) {
      console.error('Erro ao carregar clientes:', error);
      return;
    }

    // O HTML atual usa id="cliente-select".
    const selectCliente = document.getElementById('aud-cliente') || document.getElementById('cliente-select');
    if (selectCliente) {
      selectCliente.innerHTML = '<option value="">Selecione...</option>' + (data || [])
        .map(c => `<option value="${c.id}">${c.nome}</option>`)
        .join('');
    }
  },


  async loadProcessos() {
    // O HTML atual não tem select de processo.
    // Se no futuro houver, este método passará a popular.
    return;
  },


  async carregarDados() {
    try {
      const dados = await AudienciaModel.listarTodas();
      AudienciaView.renderizarTabela(dados);
    } catch (error) {
      showToast('Erro ao listar audiências', 'error');
    }
  },

  bindEvents() {
    document.getElementById('btn-nova-audiencia').onclick = () => {
      AudienciaView.modal(true);
      document.getElementById('form-audiencia').reset();

      // reset hidden id
      const idEl = document.getElementById('aud-id');
      if (idEl) idEl.value = '';

      // garantir modo de edição normal
      const form = document.getElementById('form-audiencia');
      form.classList.remove('mode-view');
      Array.from(form.querySelectorAll('input, select, textarea')).forEach(el => {
        el.disabled = false;
      });

      document.querySelector('#form-audiencia .modal-header h2').textContent = 'Nova Audiência';
      document.querySelector('#form-audiencia button[type="submit"]').style.display = 'block';
    };
    document.getElementById('btn-cancelar')?.addEventListener('click', () => {
      // Fecha modal e retorna o formulário ao modo normal
      AudienciaView.modal(false);

      const form = document.getElementById('form-audiencia');
      if (form) {
        form.classList.remove('mode-view');
        Array.from(form.querySelectorAll('input, select, textarea')).forEach(el => {
          el.disabled = false;
        });
        // Reexibe submit se estiver escondido no modo view
        const submitBtn = document.querySelector('#form-audiencia button[type="submit"]');
        if (submitBtn) submitBtn.style.display = 'block';
        const headerEl = document.querySelector('#form-audiencia .modal-header h2');
        if (headerEl) headerEl.textContent = 'Nova Audiência';
      }
    });

    // Ações em linha (view/edit)
    document.getElementById('lista-audiencias').addEventListener('click', async (e) => {
      const btnView = e.target.closest('.btn-view');
      const btnEdit = e.target.closest('.btn-edit');
      const btnDelete = e.target.closest('.btn-delete');
      const id = (btnView || btnEdit || btnDelete)?.dataset?.id;
      if (!id) return;

      if (btnView) {
        const audiencia = await AudienciaModel.buscarPorId(id);
        if (!audiencia) return;

        document.getElementById('cliente-select').value = audiencia.cliente_id || '';

        // data/hora
        if (audiencia.data) {
          const dt = new Date(audiencia.data);
          document.getElementById('audiencia-data').value = dt.toISOString().slice(0, 10);
          document.getElementById('audiencia-hora').value = dt.toISOString().slice(11, 16);
        }

        document.getElementById('audiencia-tipo').value = audiencia.tipo || 'Conciliação';
        document.getElementById('audiencia-local').value = audiencia.local || '';
        document.getElementById('audiencia-obs').value = audiencia.observacoes || '';

        const form = document.getElementById('form-audiencia');
        form.classList.add('mode-view');
        Array.from(form.querySelectorAll('input, select, textarea')).forEach(el => {
          el.disabled = true;
        });


        const headerEl = document.querySelector('#form-audiencia .modal-header h2');
        if (headerEl) headerEl.textContent = 'Detalhes da Audiência';
        document.querySelector('#form-audiencia button[type="submit"]')?.style &&
          (document.querySelector('#form-audiencia button[type="submit"]').style.display = 'none');

        AudienciaView.modal(true);
      }

      if (btnDelete) {
        // IMPORTANTE: garantir que o botão delete tenha sido clicado
        const ok = confirm('Excluir esta audiência?');
        if (!ok) return;

        try {
          await AudienciaModel.deletar(id);
          showToast('Audiência excluída!', 'success');
          await this.carregarDados();
        } catch (err) {
          console.error(err);
          showToast('Erro ao excluir audiência: ' + (err?.message || err), 'error');
        }
        return;
      }

      if (btnEdit) {
        const audiencia = await AudienciaModel.buscarPorId(id);
        if (!audiencia) return;

        document.getElementById('cliente-select').value = audiencia.cliente_id || '';

        if (audiencia.data) {
          const dt = new Date(audiencia.data);
          document.getElementById('audiencia-data').value = dt.toISOString().slice(0, 10);
          document.getElementById('audiencia-hora').value = dt.toISOString().slice(11, 16);
        }

        document.getElementById('audiencia-tipo').value = audiencia.tipo || 'Conciliação';
        document.getElementById('audiencia-local').value = audiencia.local || '';
        document.getElementById('audiencia-obs').value = audiencia.observacoes || '';

        const form = document.getElementById('form-audiencia');
        form.classList.remove('mode-view');
        Array.from(form.querySelectorAll('input, select, textarea')).forEach(el => (el.disabled = false));

        const headerEl = document.querySelector('#form-audiencia .modal-header h2');
        if (headerEl) headerEl.textContent = 'Editar Audiência';
        document.querySelector('#form-audiencia button[type="submit"]')?.style &&
          (document.querySelector('#form-audiencia button[type="submit"]').style.display = 'block');

        document.getElementById('aud-id').value = id;
        AudienciaView.modal(true);
      }


    });

    // Hidden id para edição
    if (!document.getElementById('aud-id')) {
      const hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.id = 'aud-id';
      hidden.value = '';
      document.getElementById('form-audiencia').insertBefore(hidden, document.getElementById('form-audiencia').firstChild);
    }

    document.getElementById('form-audiencia').onsubmit = async (e) => {

      e.preventDefault();
      
      const dataStr = document.getElementById('audiencia-data')?.value;
      const horaStr = document.getElementById('audiencia-hora')?.value;

      // Se data/hora não estiverem preenchidos, não salvamos o campo
      const dataIso = (dataStr && horaStr) ? new Date(`${dataStr}T${horaStr}`).toISOString() : null;

      // Recupera ID do usuário atual para ser o "advogado_id"
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showToast('Usuário não autenticado', 'error');
        return;
      }
      
      // Busca ID na tabela usuarios com null check
      const { data: uData, error: userError } = await supabase
        .from('usuarios')
        .select('id')
        .eq('email', user.email)
        .single();
      
      if (userError || !uData) {
        showToast('Usuário não encontrado no banco', 'error');
        return;
      }

      const clienteSelect = document.getElementById('cliente-select');

      const payload = {
        cliente_id: clienteSelect?.value || null,
        processo_id: null, // nesta tela o modal não inclui select de processo
        data: dataIso,
        tipo: document.getElementById('audiencia-tipo')?.value || null,
        local: document.getElementById('audiencia-local')?.value || '',
        observacoes: document.getElementById('audiencia-obs')?.value || '',
        advogado_id: uData.id
      };

      const audId = document.getElementById('aud-id')?.value;
      const isEdit = !!audId;

      try {
        if (isEdit) {
          await AudienciaModel.atualizar(audId, payload);
          showToast('Audiência atualizada!', 'success');
        } else {
          await AudienciaModel.criar(payload);
          showToast('Audiência agendada!', 'success');
        }
      } catch (error) {
        console.error(error);
        showToast('Erro ao salvar: ' + error.message, 'error');
      } finally {
        AudienciaView.modal(false);
        this.carregarDados();
      }
    };
  }
};

document.addEventListener('DOMContentLoaded', () => AudienciaController.init());