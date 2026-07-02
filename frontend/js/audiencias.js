/*
 * Módulo Audiências
 * Gerenciamento de audiências vinculadas a processos
 * Suporta múltiplos responsáveis via tabela responsaveis_audiencia
 */

import { supabase, initSupabase } from './supabase.js';
import { AuthAPI } from './auth.js';
import { showToast, formatarHora24h, formatarData } from './utils.js';
import { criarSeletorResponsaveis } from './responsaveis-select.js';

// ==========================================
// 1. MODEL
// ==========================================
const AudienciaModel = {
  async listarTodas() {
    const { data, error } = await supabase
      .from('audiencias')
      .select('*, processos(numero_cnj, clientes(nome)), clientes(nome), usuarios(nome), responsaveis_audiencia(usuario_id, usuarios(nome))')
      .order('data', { ascending: true });

    if (error) throw error;
    return data;
  },

  async criar(audiencia) {
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
      .select('*, responsaveis_audiencia(usuario_id, usuarios(nome))')
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
  },

  async sincronizarResponsaveis(audienciaId, selecionados) {
    // Em edição: apaga e reinsere
    await supabase.from('responsaveis_audiencia').delete().eq('audiencia_id', audienciaId);

    if (!selecionados.length) return;

    const registros = selecionados.map(u => ({
      audiencia_id: audienciaId,
      usuario_id: u.id
    }));

    const { error } = await supabase.from('responsaveis_audiencia').insert(registros);
    if (error) throw error;
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
      tbody.innerHTML = `<tr><td colspan="6" style="padding:0;">
        <div style="min-height:180px; display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--cinza-medio); gap:10px;">
          <i class="fa-regular fa-folder-open" style="font-size:2rem; opacity:0.4;"></i>
          <span style="font-size:0.9rem;">Nenhuma audiência agendada.</span>
        </div>
      </td></tr>`;
      return;
    }

    tbody.innerHTML = lista.map(a => {
      const dataObj = a.data ? new Date(a.data) : null;
      const dataTxt = dataObj ? formatarData(dataObj) : '-';
      const horaTxt = dataObj ? formatarHora24h(dataObj) : '';

      const clienteNome = a.processos?.clientes?.nome || a.clientes?.nome || '—';
      const numeroCnj = a.processos?.numero_cnj || 'S/N';

      // Badge de tipo compacto (judicial/administrativo)
      const tipoBadge = a.tipo
        ? `<span class="status-badge ${a.tipo === 'Judicial' ? 'badge-tipo-judicial' : 'badge-tipo-administrativo'}">${a.tipo}</span>`
        : '';

      // Responsáveis da tabela de junção
      const responsaveis = (a.responsaveis_audiencia || [])
        .map(r => r.usuarios?.nome?.split(' ')[0])
        .filter(Boolean)
        .join(', ') || (a.usuarios?.nome?.split(' ')[0]) || '—';

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
      ${tipoBadge}
    </td>
    <td style="max-width:160px;">
      <div style="font-size:0.8rem; color:var(--cinza-medio);">${responsaveis}</div>
    </td>
    <td style="width:110px; text-align: right; vertical-align:middle;">
      <div style="display:flex; gap:6px; justify-content:flex-end; align-items:center;">
        <button class="btn-sm btn-view" data-id="${a.id}" title="Visualizar">
          <i class="fa-solid fa-eye"></i>
        </button>
        <button class="btn-sm btn-edit" data-id="${a.id}" title="Editar">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="btn-sm btn-delete" data-id="${a.id}" style="color:#ef4444;" title="Excluir">
          <i class="fa-solid fa-trash"></i>
        </button>
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

// Atualizar cabeçalho da tabela para incluir coluna Responsáveis
function atualizarCabecalhoTabela() {
  const thead = document.querySelector('#lista-audiencias')?.closest('table')?.querySelector('thead tr');
  if (!thead) return;
  // Verificar se já tem a coluna
  if (thead.querySelector('th[data-col="responsaveis"]')) return;
  const thAcoes = thead.querySelector('th:last-child');
  const thResp = document.createElement('th');
  thResp.setAttribute('data-col', 'responsaveis');
  thResp.textContent = 'Responsáveis';
  thResp.style.maxWidth = '160px';
  thead.insertBefore(thResp, thAcoes);
}

// ==========================================
// 3. CONTROLLER
// ==========================================
function filtrarAudiencias(lista, termoBusca, tipoFiltro) {
  return lista.filter((a) => {
    if (tipoFiltro && a.tipo !== tipoFiltro) return false;
    if (!termoBusca) return true;

    const cliente = (a.processos?.clientes?.nome || a.clientes?.nome || '').toLowerCase();
    const numeroCnj = (a.processos?.numero_cnj || '').toLowerCase();
    const tipo = (a.tipo || '').toLowerCase();
    const local = (a.local || '').toLowerCase();
    const dataObj = a.data ? new Date(a.data) : null;
    const dtTxt = dataObj ? formatarData(dataObj).toLowerCase() : '';
    const responsaveis = (a.responsaveis_audiencia || [])
      .map(r => r.usuarios?.nome || '').join(' ').toLowerCase();

    return [cliente, numeroCnj, tipo, local, dtTxt, responsaveis].some((v) => v.includes(termoBusca));
  });
}

const AudienciaController = {
  seletorResp: null,

  async init() {
    AudienciaView.init();

    await this.loadClientes();
    await this.loadProcessos();

    // Instanciar o componente de responsáveis
    this.seletorResp = criarSeletorResponsaveis({
      inputEl: document.getElementById('aud-responsaveis-busca'),
      dropdownEl: document.getElementById('aud-responsaveis-dropdown'),
      tagsEl: document.getElementById('aud-responsaveis-tags')
    });
    await this.seletorResp.init();

    const lista = document.getElementById('lista-audiencias');
    if (lista && !lista.dataset.bound) {
      lista.dataset.bound = 'true';
    }

    atualizarCabecalhoTabela();
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

    const selectCliente = document.getElementById('aud-cliente') || document.getElementById('cliente-select');
    if (selectCliente) {
      selectCliente.innerHTML = '<option value="">Selecione...</option>' + (data || [])
        .map(c => `<option value="${c.id}">${c.nome}</option>`)
        .join('');
    }
  },

  async loadProcessos() {
    return;
  },

  async carregarDados() {
    try {
      const dados = await AudienciaModel.listarTodas();
      window.__listaAudienciasCompleta = dados;
      
      const buscaEl = document.getElementById('audiencias-busca');
      const filtroTipoEl = document.getElementById('audiencias-filtro-tipo');
      
      const termo = (buscaEl?.value || '').trim().toLowerCase();
      const tipo = filtroTipoEl?.value || '';
      
      AudienciaView.renderizarTabela(filtrarAudiencias(window.__listaAudienciasCompleta, termo, tipo));
    } catch (error) {
      showToast('Erro ao listar audiências', 'error');
    }
  },

  bindEvents() {
    const buscaEl = document.getElementById('audiencias-busca');
    const filtroTipoEl = document.getElementById('audiencias-filtro-tipo');

    const aplicarFiltros = () => {
      const termo = (buscaEl?.value || '').trim().toLowerCase();
      const tipo = filtroTipoEl?.value || '';
      const base = window.__listaAudienciasCompleta || [];
      AudienciaView.renderizarTabela(filtrarAudiencias(base, termo, tipo));
    };

    buscaEl?.addEventListener('input', aplicarFiltros);
    filtroTipoEl?.addEventListener('change', aplicarFiltros);

    document.getElementById('btn-nova-audiencia').onclick = () => {
      AudienciaView.modal(true);
      document.getElementById('form-audiencia').reset();
      this.seletorResp?.limpar();
      this.seletorResp?.setDisabled(false);

      const idEl = document.getElementById('aud-id');
      if (idEl) idEl.value = '';

      const form = document.getElementById('form-audiencia');
      form.classList.remove('mode-view');
      Array.from(form.querySelectorAll('input, select, textarea')).forEach(el => {
        el.disabled = false;
      });

      document.querySelector('#form-audiencia .modal-header h2').textContent = 'Nova Audiência';
      document.querySelector('#form-audiencia button[type="submit"]').style.display = 'block';
    };

    document.getElementById('btn-cancelar')?.addEventListener('click', () => {
      AudienciaView.modal(false);
      this.seletorResp?.limpar();
      this.seletorResp?.setDisabled(false);

      const form = document.getElementById('form-audiencia');
      if (form) {
        form.classList.remove('mode-view');
        Array.from(form.querySelectorAll('input, select, textarea')).forEach(el => {
          el.disabled = false;
        });
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

        if (audiencia.data) {
          const dt = new Date(audiencia.data);
          document.getElementById('audiencia-data').value = dt.toLocaleDateString('pt-BR', {
            timeZone: 'America/Fortaleza'
          }).split('/').reverse().join('-');
          document.getElementById('audiencia-hora').value = dt.toLocaleTimeString('pt-BR', {
            timeZone: 'America/Fortaleza',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
        }

        document.getElementById('audiencia-tipo').value = audiencia.tipo || 'Conciliação';
        document.getElementById('audiencia-local').value = audiencia.local || '';
        document.getElementById('audiencia-obs').value = audiencia.observacoes || '';

        // Carregar responsáveis
        const responsaveisSelecionados = (audiencia.responsaveis_audiencia || []).map(r => ({
          id: r.usuario_id,
          nome: r.usuarios?.nome || ''
        }));
        this.seletorResp?.setSelecionados(responsaveisSelecionados);
        this.seletorResp?.setDisabled(true);

        const form = document.getElementById('form-audiencia');
        form.classList.add('mode-view');
        Array.from(form.querySelectorAll('input, select, textarea')).forEach(el => {
          el.disabled = true;
        });

        const headerEl = document.querySelector('#form-audiencia .modal-header h2');
        const clienteNome = audiencia.clientes?.nome || audiencia.processos?.clientes?.nome || null;
        if (headerEl) {
          headerEl.textContent = clienteNome ? clienteNome : 'Detalhes da Audiência';
          headerEl.title = clienteNome || '';
        }
        document.querySelector('#form-audiencia button[type="submit"]')?.style &&
          (document.querySelector('#form-audiencia button[type="submit"]').style.display = 'none');

        AudienciaView.modal(true);
      }

      if (btnDelete) {
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
          document.getElementById('audiencia-data').value = dt.toLocaleDateString('pt-BR', {
            timeZone: 'America/Fortaleza'
          }).split('/').reverse().join('-');
          document.getElementById('audiencia-hora').value = dt.toLocaleTimeString('pt-BR', {
            timeZone: 'America/Fortaleza',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
        }

        document.getElementById('audiencia-tipo').value = audiencia.tipo || 'Conciliação';
        document.getElementById('audiencia-local').value = audiencia.local || '';
        document.getElementById('audiencia-obs').value = audiencia.observacoes || '';

        // Carregar responsáveis para edição
        const responsaveisSelecionados = (audiencia.responsaveis_audiencia || []).map(r => ({
          id: r.usuario_id,
          nome: r.usuarios?.nome || ''
        }));
        this.seletorResp?.setSelecionados(responsaveisSelecionados);
        this.seletorResp?.setDisabled(false);

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

      // Validar responsáveis
      const selecionados = this.seletorResp?.getSelecionados() || [];
      if (!selecionados.length) {
        showToast('Selecione ao menos um responsável.', 'error');
        return;
      }

      const dataStr = document.getElementById('audiencia-data')?.value;
      const horaStr = document.getElementById('audiencia-hora')?.value;
      const dataIso = (dataStr && horaStr) ? new Date(`${dataStr}T${horaStr}:00-03:00`).toISOString() : null;

      const clienteSelect = document.getElementById('cliente-select');

      const payload = {
        cliente_id: clienteSelect?.value || null,
        processo_id: null,
        data: dataIso,
        tipo: document.getElementById('audiencia-tipo')?.value || null,
        local: document.getElementById('audiencia-local')?.value || '',
        observacoes: document.getElementById('audiencia-obs')?.value || '',
        advogado_id: selecionados[0].id
      };

      const audId = document.getElementById('aud-id')?.value;
      const isEdit = !!audId;

      try {
        let registroId = audId;
        if (isEdit) {
          await AudienciaModel.atualizar(audId, payload);
          showToast('Audiência atualizada!', 'success');
        } else {
          const nova = await AudienciaModel.criar(payload);
          registroId = nova.id;
          showToast('Audiência agendada!', 'success');
        }

        // Sincronizar responsáveis
        await AudienciaModel.sincronizarResponsaveis(registroId, selecionados);
      } catch (error) {
        console.error(error);
        showToast('Erro ao salvar: ' + error.message, 'error');
      } finally {
        this.seletorResp?.limpar();
        AudienciaView.modal(false);
        this.carregarDados();
      }
    };
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  await initSupabase();
  AudienciaController.init();
});
